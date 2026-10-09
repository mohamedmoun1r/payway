import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';
import {
  MOCK_PROFILES,
  MOCK_STUDENTS,
  MOCK_SEMESTERS,
  MOCK_STUDENT_DUES,
  MOCK_TRANSACTIONS,
  MOCK_ADMINS,
  isDevMockEnabled,
  isSupabaseConfigured,
} from './mock-data';

export interface TreasuryClosingMetrics {
  filterDate: string | null;
  totalTransactionsCount: number;
  completedCount: number;
  voidedCount: number;
  grossCompletedAmount: number;
  voidedAdjustmentsAmount: number;
  netReconciledAmount: number;
  methodBreakdown: {
    cashAmount: number;
    cashCount: number;
    posAmount: number;
    posCount: number;
    bankTransferAmount: number;
    bankTransferCount: number;
    otherAmount: number;
    otherCount: number;
  };
  cashierBreakdown: {
    cashierId: string;
    cashierNameAr: string;
    cashierNameEn: string;
    employeeId: string;
    completedCount: number;
    completedAmount: number;
    voidedCount: number;
    voidedAmount: number;
    cashAmount: number;
    posAmount: number;
    bankTransferAmount: number;
  }[];
  voidedTransactions: {
    id: string;
    transactionNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    studentNumber: string;
    studentNameAr: string;
    studentNameEn: string;
    voidReason: string | null;
    voidedAt: string | null;
    cashierNameAr: string;
    cashierNameEn: string;
  }[];
}

export interface DepartmentRecoveryMetric {
  department: string;
  studentCount: number;
  originalAmount: number;
  discountAmount: number;
  netDueAmount: number;
  paidAmount: number;
  remainingBalance: number;
  collectionRate: number;
  statusBreakdown: {
    paid: number;
    partiallyPaid: number;
    unpaid: number;
  };
}

export interface AcademicAnalyticsSummary {
  semesterCode: string;
  semesterNameAr: string;
  semesterNameEn: string;
  totalStudents: number;
  totalAssessed: number;
  totalDiscount: number;
  totalNetDue: number;
  totalCollected: number;
  totalOutstanding: number;
  overallCollectionRate: number;
  departmentMetrics: DepartmentRecoveryMetric[];
}

type RawJoinedTxn = Database['public']['Tables']['transactions']['Row'] & {
  student?: {
    student_number: string;
    profile?: { full_name_ar: string; full_name_en: string };
  };
  admin?: {
    employee_id: string;
    profile?: { full_name_ar: string; full_name_en: string };
  };
  semester?: { code: string; name_ar: string; name_en: string };
};

/**
 * Calculates treasury daily closing and cashier reconciliation metrics.
 * Strictly adheres to:
 * 1. Only COMPLETED transactions count toward gross collections.
 * 2. VOIDED transactions are accounted separately under voided adjustments.
 * 3. Net reconciled position = Gross completed collections.
 * Fails closed: Never falls back to mock data unless isDevMockEnabled() is explicitly true.
 */
export async function getTreasuryClosingMetrics(filters?: {
  date?: string;
  fromDate?: string;
  toDate?: string;
  semesterId?: string;
}): Promise<TreasuryClosingMetrics> {
  const targetDate = filters?.date;
  const fromDate = filters?.fromDate;
  const toDate = filters?.toDate;
  const semesterId = filters?.semesterId;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    let query = supabase.from('transactions').select(`
      *,
      student:students(student_number, profile:profiles(full_name_ar, full_name_en)),
      admin:admins(employee_id, profile:profiles(full_name_ar, full_name_en)),
      semester:semesters(code, name_ar, name_en)
    `);

    if (targetDate) {
      query = query.eq('payment_date', targetDate);
    } else {
      if (fromDate) query = query.gte('payment_date', fromDate);
      if (toDate) query = query.lte('payment_date', toDate);
    }

    if (semesterId) {
      query = query.eq('semester_id', semesterId);
    }

    const { data: rawTxns, error } = await query.order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to retrieve transactions for closing report: ${error.message}`);
    }

    const txns = (rawTxns || []) as unknown as RawJoinedTxn[];

    let completedCount = 0;
    let voidedCount = 0;
    let grossCompletedAmount = 0;
    let voidedAdjustmentsAmount = 0;

    let cashAmount = 0;
    let cashCount = 0;
    let posAmount = 0;
    let posCount = 0;
    let bankTransferAmount = 0;
    let bankTransferCount = 0;
    let otherAmount = 0;
    let otherCount = 0;

    const cashierMap = new Map<string, TreasuryClosingMetrics['cashierBreakdown'][0]>();
    const voidedTransactions: TreasuryClosingMetrics['voidedTransactions'] = [];

    txns.forEach((t) => {
      const amt = Number(t.amount);
      const cashierId = t.recorded_by || 'unknown';
      const cashierNameAr = t.admin?.profile?.full_name_ar || 'غير محدد';
      const cashierNameEn = t.admin?.profile?.full_name_en || 'Unknown';
      const employeeId = t.admin?.employee_id || 'N/A';

      if (!cashierMap.has(cashierId)) {
        cashierMap.set(cashierId, {
          cashierId,
          cashierNameAr,
          cashierNameEn,
          employeeId,
          completedCount: 0,
          completedAmount: 0,
          voidedCount: 0,
          voidedAmount: 0,
          cashAmount: 0,
          posAmount: 0,
          bankTransferAmount: 0,
        });
      }
      const cashier = cashierMap.get(cashierId)!;

      if (t.status === 'COMPLETED') {
        completedCount++;
        grossCompletedAmount += amt;
        cashier.completedCount++;
        cashier.completedAmount += amt;

        switch (t.payment_method) {
          case 'CASH':
            cashAmount += amt;
            cashCount++;
            cashier.cashAmount += amt;
            break;
          case 'POS':
            posAmount += amt;
            posCount++;
            cashier.posAmount += amt;
            break;
          case 'BANK_TRANSFER':
            bankTransferAmount += amt;
            bankTransferCount++;
            cashier.bankTransferAmount += amt;
            break;
          default:
            otherAmount += amt;
            otherCount++;
            break;
        }
      } else if (t.status === 'VOIDED') {
        voidedCount++;
        voidedAdjustmentsAmount += amt;
        cashier.voidedCount++;
        cashier.voidedAmount += amt;

        voidedTransactions.push({
          id: t.id,
          transactionNumber: t.transaction_number,
          amount: amt,
          paymentMethod: t.payment_method,
          paymentDate: t.payment_date,
          studentNumber: t.student?.student_number || 'N/A',
          studentNameAr: t.student?.profile?.full_name_ar || 'طالب',
          studentNameEn: t.student?.profile?.full_name_en || 'Student',
          voidReason: t.void_reason,
          voidedAt: t.voided_at,
          cashierNameAr,
          cashierNameEn,
        });
      }
    });

    return {
      filterDate: targetDate || null,
      totalTransactionsCount: txns.length,
      completedCount,
      voidedCount,
      grossCompletedAmount,
      voidedAdjustmentsAmount,
      netReconciledAmount: grossCompletedAmount,
      methodBreakdown: {
        cashAmount,
        cashCount,
        posAmount,
        posCount,
        bankTransferAmount,
        bankTransferCount,
        otherAmount,
        otherCount,
      },
      cashierBreakdown: Array.from(cashierMap.values()),
      voidedTransactions,
    };
  }

  if (isDevMockEnabled()) {
    let txns = [...MOCK_TRANSACTIONS];
    if (targetDate) {
      txns = txns.filter((t) => t.payment_date === targetDate);
    }
    if (semesterId) {
      txns = txns.filter((t) => t.semester_id === semesterId);
    }

    let completedCount = 0;
    let voidedCount = 0;
    let grossCompletedAmount = 0;
    let voidedAdjustmentsAmount = 0;

    let cashAmount = 0;
    let cashCount = 0;
    let posAmount = 0;
    let posCount = 0;
    let bankTransferAmount = 0;
    let bankTransferCount = 0;
    let otherAmount = 0;
    let otherCount = 0;

    const cashierMap = new Map<string, TreasuryClosingMetrics['cashierBreakdown'][0]>();
    const voidedTransactions: TreasuryClosingMetrics['voidedTransactions'] = [];

    txns.forEach((t) => {
      const amt = Number(t.amount);
      const cashierAdmin = MOCK_ADMINS.find((a) => a.id === t.recorded_by);
      const cashierProfile = MOCK_PROFILES.find((p) => p.id === t.recorded_by);
      const cashierId = t.recorded_by;
      const cashierNameAr = cashierProfile?.full_name_ar || 'مسؤول الخزينة';
      const cashierNameEn = cashierProfile?.full_name_en || 'Treasury Cashier';
      const employeeId = cashierAdmin?.employee_id || 'DEMO-ADM';

      if (!cashierMap.has(cashierId)) {
        cashierMap.set(cashierId, {
          cashierId,
          cashierNameAr,
          cashierNameEn,
          employeeId,
          completedCount: 0,
          completedAmount: 0,
          voidedCount: 0,
          voidedAmount: 0,
          cashAmount: 0,
          posAmount: 0,
          bankTransferAmount: 0,
        });
      }
      const cashier = cashierMap.get(cashierId)!;

      if (t.status === 'COMPLETED') {
        completedCount++;
        grossCompletedAmount += amt;
        cashier.completedCount++;
        cashier.completedAmount += amt;

        switch (t.payment_method) {
          case 'CASH':
            cashAmount += amt;
            cashCount++;
            cashier.cashAmount += amt;
            break;
          case 'POS':
            posAmount += amt;
            posCount++;
            cashier.posAmount += amt;
            break;
          case 'BANK_TRANSFER':
            bankTransferAmount += amt;
            bankTransferCount++;
            cashier.bankTransferAmount += amt;
            break;
          default:
            otherAmount += amt;
            otherCount++;
            break;
        }
      } else if (t.status === 'VOIDED') {
        voidedCount++;
        voidedAdjustmentsAmount += amt;
        cashier.voidedCount++;
        cashier.voidedAmount += amt;

        const student = MOCK_STUDENTS.find((s) => s.id === t.student_id);
        const studentProfile = MOCK_PROFILES.find((p) => p.id === t.student_id);

        voidedTransactions.push({
          id: t.id,
          transactionNumber: t.transaction_number,
          amount: amt,
          paymentMethod: t.payment_method,
          paymentDate: t.payment_date,
          studentNumber: student?.student_number || 'N/A',
          studentNameAr: studentProfile?.full_name_ar || 'طالب',
          studentNameEn: studentProfile?.full_name_en || 'Student',
          voidReason: t.void_reason,
          voidedAt: t.voided_at,
          cashierNameAr,
          cashierNameEn,
        });
      }
    });

    return {
      filterDate: targetDate || null,
      totalTransactionsCount: txns.length,
      completedCount,
      voidedCount,
      grossCompletedAmount,
      voidedAdjustmentsAmount,
      netReconciledAmount: grossCompletedAmount,
      methodBreakdown: {
        cashAmount,
        cashCount,
        posAmount,
        posCount,
        bankTransferAmount,
        bankTransferCount,
        otherAmount,
        otherCount,
      },
      cashierBreakdown: Array.from(cashierMap.values()),
      voidedTransactions,
    };
  }

  throw new Error('Treasury database is not configured and development mock data is disabled.');
}

/**
 * Calculates fee recovery metrics grouped by academic department and level.
 * Strictly operates over existing columns in public.students and public.student_dues.
 * Fails closed: Never falls back to mock data unless isDevMockEnabled() is explicitly true.
 */
export async function getDepartmentRecoveryMetrics(
  semesterId?: string
): Promise<AcademicAnalyticsSummary> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();

    // Resolve target semester
    let semQuery = supabase.from('semesters').select('*');
    if (semesterId) {
      semQuery = semQuery.eq('id', semesterId);
    } else {
      semQuery = semQuery.eq('is_current', true);
    }
    const { data: semData, error: semErr } = await semQuery.maybeSingle();

    if (semErr) {
      throw new Error(`Failed to query target semester: ${semErr.message}`);
    }

    let semester = semData;
    if (!semester) {
      const { data: firstSem, error: firstSemErr } = await supabase
        .from('semesters')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (firstSemErr) {
        throw new Error(`Failed to query fallback semester: ${firstSemErr.message}`);
      }
      semester = firstSem;
    }

    if (!semester) {
      // Clean empty result when no semesters exist in database
      return {
        semesterCode: '',
        semesterNameAr: '',
        semesterNameEn: '',
        totalStudents: 0,
        totalAssessed: 0,
        totalDiscount: 0,
        totalNetDue: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        overallCollectionRate: 0,
        departmentMetrics: [],
      };
    }

    // Query dues joined with students table
    const { data: duesData, error: duesErr } = await supabase
      .from('student_dues')
      .select(`
        *,
        student:students!inner(
          id,
          student_number,
          academic_department,
          academic_program,
          academic_level
        )
      `)
      .eq('semester_id', semester.id);

    if (duesErr) {
      throw new Error(`Failed to query student dues for department recovery metrics: ${duesErr.message}`);
    }

    type DueWithStudent = Database['public']['Tables']['student_dues']['Row'] & {
      student: Database['public']['Tables']['students']['Row'];
    };
    const dues = (duesData || []) as unknown as DueWithStudent[];

    const deptMap = new Map<string, DepartmentRecoveryMetric>();

    let totalAssessed = 0;
    let totalDiscount = 0;
    let totalNetDue = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    dues.forEach((d) => {
      const dept = d.student?.academic_department || 'General Engineering';
      const orig = Number(d.original_amount);
      const disc = Number(d.discount_amount || 0);
      const net = orig - disc;
      const paid = Number(d.paid_amount || 0);
      const rem = Math.max(0, net - paid);

      totalAssessed += orig;
      totalDiscount += disc;
      totalNetDue += net;
      totalCollected += paid;
      totalOutstanding += rem;

      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          studentCount: 0,
          originalAmount: 0,
          discountAmount: 0,
          netDueAmount: 0,
          paidAmount: 0,
          remainingBalance: 0,
          collectionRate: 0,
          statusBreakdown: { paid: 0, partiallyPaid: 0, unpaid: 0 },
        });
      }

      const item = deptMap.get(dept)!;
      item.studentCount++;
      item.originalAmount += orig;
      item.discountAmount += disc;
      item.netDueAmount += net;
      item.paidAmount += paid;
      item.remainingBalance += rem;

      if (d.status === 'PAID') item.statusBreakdown.paid++;
      else if (d.status === 'PARTIALLY_PAID') item.statusBreakdown.partiallyPaid++;
      else item.statusBreakdown.unpaid++;
    });

    // Calculate collection rates per department
    deptMap.forEach((item) => {
      item.collectionRate =
        item.netDueAmount > 0
          ? Math.round((item.paidAmount / item.netDueAmount) * 1000) / 10
          : 0;
    });

    const overallCollectionRate =
      totalNetDue > 0 ? Math.round((totalCollected / totalNetDue) * 1000) / 10 : 0;

    return {
      semesterCode: semester.code,
      semesterNameAr: semester.name_ar,
      semesterNameEn: semester.name_en,
      totalStudents: dues.length,
      totalAssessed,
      totalDiscount,
      totalNetDue,
      totalCollected,
      totalOutstanding,
      overallCollectionRate,
      departmentMetrics: Array.from(deptMap.values()).sort((a, b) => b.netDueAmount - a.netDueAmount),
    };
  }

  if (isDevMockEnabled()) {
    const currentSemester = MOCK_SEMESTERS.find((s) => (semesterId ? s.id === semesterId : s.is_current)) || MOCK_SEMESTERS[0];
    const dues = MOCK_STUDENT_DUES.filter((d) => d.semester_id === currentSemester.id);

    const deptMap = new Map<string, DepartmentRecoveryMetric>();
    let totalAssessed = 0;
    let totalDiscount = 0;
    let totalNetDue = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    dues.forEach((d) => {
      const student = MOCK_STUDENTS.find((s) => s.id === d.student_id);
      const dept = student?.academic_department || 'General Engineering';
      const orig = Number(d.original_amount);
      const disc = Number(d.discount_amount || 0);
      const net = orig - disc;
      const paid = Number(d.paid_amount || 0);
      const rem = Math.max(0, net - paid);

      totalAssessed += orig;
      totalDiscount += disc;
      totalNetDue += net;
      totalCollected += paid;
      totalOutstanding += rem;

      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          studentCount: 0,
          originalAmount: 0,
          discountAmount: 0,
          netDueAmount: 0,
          paidAmount: 0,
          remainingBalance: 0,
          collectionRate: 0,
          statusBreakdown: { paid: 0, partiallyPaid: 0, unpaid: 0 },
        });
      }

      const item = deptMap.get(dept)!;
      item.studentCount++;
      item.originalAmount += orig;
      item.discountAmount += disc;
      item.netDueAmount += net;
      item.paidAmount += paid;
      item.remainingBalance += rem;

      if (d.status === 'PAID') item.statusBreakdown.paid++;
      else if (d.status === 'PARTIALLY_PAID') item.statusBreakdown.partiallyPaid++;
      else item.statusBreakdown.unpaid++;
    });

    deptMap.forEach((item) => {
      item.collectionRate =
        item.netDueAmount > 0
          ? Math.round((item.paidAmount / item.netDueAmount) * 1000) / 10
          : 0;
    });

    const overallCollectionRate =
      totalNetDue > 0 ? Math.round((totalCollected / totalNetDue) * 1000) / 10 : 0;

    return {
      semesterCode: currentSemester.code,
      semesterNameAr: currentSemester.name_ar,
      semesterNameEn: currentSemester.name_en,
      totalStudents: dues.length,
      totalAssessed,
      totalDiscount,
      totalNetDue,
      totalCollected,
      totalOutstanding,
      overallCollectionRate,
      departmentMetrics: Array.from(deptMap.values()).sort((a, b) => b.netDueAmount - a.netDueAmount),
    };
  }

  throw new Error('Academic analytics database is not configured and development mock data is disabled.');
}
