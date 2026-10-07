import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';
import {
  MOCK_PROFILES,
  MOCK_STUDENTS,
  MOCK_SEMESTERS,
  MOCK_STUDENT_DUES,
  MOCK_TRANSACTIONS,
  MOCK_RECEIPTS,
  MOCK_AUDIT_LOGS,
} from './mock-data';

export interface AdminDashboardMetrics {
  totalStudents: number;
  studentsWithBalance: number;
  studentsFullyPaid: number;
  totalDue: number;
  totalCollected: number;
  totalOutstanding: number;
  recentTransactions: AdminTransactionItem[];
}

export interface AdminStudentSearchResult {
  id: string;
  studentNumber: string;
  nameAr: string;
  nameEn: string;
  email: string;
  department: string;
  level: number;
  currentSemesterDue: number;
  currentSemesterPaid: number;
  outstandingBalance: number;
  status: Database['public']['Enums']['due_status'];
}

export interface AdminStudentFinancialProfile {
  profile: Database['public']['Tables']['profiles']['Row'];
  student: Database['public']['Tables']['students']['Row'];
  currentSemester: Database['public']['Tables']['semesters']['Row'] | null;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  overallStatus: Database['public']['Enums']['due_status'];
  dues: (Database['public']['Tables']['student_dues']['Row'] & {
    semester: Database['public']['Tables']['semesters']['Row'];
  })[];
  transactions: AdminTransactionItem[];
}

export type AdminTransactionItem = Database['public']['Tables']['transactions']['Row'] & {
  student_number: string;
  student_name_ar: string;
  student_name_en: string;
  receipt_number: string | null;
  semester_code: string;
  semester_name_ar: string;
  semester_name_en: string;
};

type RawAdminJoinedTxn = Database['public']['Tables']['transactions']['Row'] & {
  receipt?: { receipt_number: string }[];
  semester?: { code: string; name_ar: string; name_en: string };
  student?: {
    student_number: string;
    profile?: { full_name_ar: string; full_name_en: string };
  };
};

type RawStudentSearchItem = {
  id: string;
  student_number: string;
  academic_department: string;
  academic_level: number;
  profile?: { full_name_ar: string; full_name_en: string; email: string };
  dues?: Database['public']['Tables']['student_dues']['Row'][];
};

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes('placeholder-project') && !url.includes('your-project-id'));
}

/**
 * Calculates dashboard metrics for administrators.
 */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();

      // 1. Fetch Students count
      const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });

      // 2. Fetch Dues summary
      const { data: dues } = await supabase.from('student_dues').select('original_amount, discount_amount, paid_amount, status');

      let totalDue = 0;
      let totalCollected = 0;
      (dues || []).forEach((d) => {
        totalDue += Number(d.original_amount) - Number(d.discount_amount);
        totalCollected += Number(d.paid_amount);
      });
      const totalOutstanding = Math.max(0, totalDue - totalCollected);

      const studentsWithBalance = (dues || []).filter((d) => d.status === 'UNPAID' || d.status === 'PARTIALLY_PAID').length;
      const studentsFullyPaid = (dues || []).filter((d) => d.status === 'PAID').length;

      // 3. Fetch Recent Transactions
      const { data: txns } = await supabase
        .from('transactions')
        .select(`
          *,
          receipt:receipts(receipt_number),
          semester:semesters(code, name_ar, name_en),
          student:students!inner(student_number, profile:profiles!inner(full_name_ar, full_name_en))
        `)
        .order('payment_date', { ascending: false })
        .limit(5);

      const rawTxns = (txns || []) as unknown as RawAdminJoinedTxn[];
      const recentTransactions: AdminTransactionItem[] = rawTxns.map((t) => ({
        ...t,
        student_number: t.student?.student_number || 'N/A',
        student_name_ar: t.student?.profile?.full_name_ar || 'غير محدد',
        student_name_en: t.student?.profile?.full_name_en || 'Unknown',
        receipt_number: t.receipt?.[0]?.receipt_number || null,
        semester_code: t.semester?.code || '',
        semester_name_ar: t.semester?.name_ar || '',
        semester_name_en: t.semester?.name_en || '',
      }));

      return {
        totalStudents: totalStudents || 0,
        studentsWithBalance,
        studentsFullyPaid,
        totalDue,
        totalCollected,
        totalOutstanding,
        recentTransactions,
      };
    } catch (err) {
      console.warn('[ADMIN_DASHBOARD_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

  // Fallback using mock data
  const totalStudents = MOCK_STUDENTS.length;
  let totalDue = 0;
  let totalCollected = 0;
  MOCK_STUDENT_DUES.forEach((d) => {
    totalDue += Number(d.original_amount) - Number(d.discount_amount);
    totalCollected += Number(d.paid_amount);
  });
  const totalOutstanding = Math.max(0, totalDue - totalCollected);

  // Group by student to see who has balance
  const studentBalanceMap = new Map<string, number>();
  MOCK_STUDENT_DUES.forEach((d) => {
    const net = Number(d.original_amount) - Number(d.discount_amount);
    const bal = net - Number(d.paid_amount);
    studentBalanceMap.set(d.student_id, (studentBalanceMap.get(d.student_id) || 0) + bal);
  });

  let studentsWithBalance = 0;
  let studentsFullyPaid = 0;
  studentBalanceMap.forEach((bal) => {
    if (bal > 0) studentsWithBalance++;
    else studentsFullyPaid++;
  });

  const recentTransactions: AdminTransactionItem[] = MOCK_TRANSACTIONS.slice(0, 5).map((t) => {
    const student = MOCK_STUDENTS.find((s) => s.id === t.student_id);
    const profile = MOCK_PROFILES.find((p) => p.id === t.student_id);
    const receipt = MOCK_RECEIPTS.find((r) => r.transaction_id === t.id);
    const semester = MOCK_SEMESTERS.find((s) => s.id === t.semester_id);

    return {
      ...t,
      student_number: student?.student_number || 'N/A',
      student_name_ar: profile?.full_name_ar || 'طالب تجريبي',
      student_name_en: profile?.full_name_en || 'Demo Student',
      receipt_number: receipt?.receipt_number || null,
      semester_code: semester?.code || '',
      semester_name_ar: semester?.name_ar || '',
      semester_name_en: semester?.name_en || '',
    };
  });

  return {
    totalStudents,
    studentsWithBalance,
    studentsFullyPaid,
    totalDue,
    totalCollected,
    totalOutstanding,
    recentTransactions,
  };
}

/**
 * Searches students by student number, name, or email.
 */
export async function searchStudents(query?: string): Promise<AdminStudentSearchResult[]> {
  const normalizedQuery = (query || '').trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      let req = supabase.from('students').select(`
        id,
        student_number,
        academic_department,
        academic_level,
        profile:profiles!inner(full_name_ar, full_name_en, email),
        dues:student_dues(*)
      `);

      if (normalizedQuery) {
        req = req.or(
          `student_number.ilike.%${normalizedQuery}%,profile.full_name_ar.ilike.%${normalizedQuery}%,profile.full_name_en.ilike.%${normalizedQuery}%,profile.email.ilike.%${normalizedQuery}%`
        );
      }

      const { data } = await req;
      if (data) {
        const rawItems = data as unknown as RawStudentSearchItem[];
        return rawItems.map((item) => {
          const dues = item.dues || [];
          let totalDue = 0;
          let totalPaid = 0;
          dues.forEach((d) => {
            totalDue += Number(d.original_amount) - Number(d.discount_amount);
            totalPaid += Number(d.paid_amount);
          });
          const remaining = Math.max(0, totalDue - totalPaid);

          return {
            id: item.id,
            studentNumber: item.student_number,
            nameAr: item.profile?.full_name_ar || '',
            nameEn: item.profile?.full_name_en || '',
            email: item.profile?.email || '',
            department: item.academic_department,
            level: item.academic_level,
            currentSemesterDue: totalDue,
            currentSemesterPaid: totalPaid,
            outstandingBalance: remaining,
            status: remaining === 0 && totalPaid > 0 ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
          };
        });
      }
    } catch (err) {
      console.warn('[ADMIN_SEARCH_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

  // Fallback using mock data
  return MOCK_STUDENTS.map((student) => {
    const profile = MOCK_PROFILES.find((p) => p.id === student.id);
    const dues = MOCK_STUDENT_DUES.filter((d) => d.student_id === student.id);

    let totalDue = 0;
    let totalPaid = 0;
    dues.forEach((d) => {
      totalDue += Number(d.original_amount) - Number(d.discount_amount);
      totalPaid += Number(d.paid_amount);
    });
    const remaining = Math.max(0, totalDue - totalPaid);

    return {
      id: student.id,
      studentNumber: student.student_number,
      nameAr: profile?.full_name_ar || '',
      nameEn: profile?.full_name_en || '',
      email: profile?.email || '',
      department: student.academic_department,
      level: student.academic_level,
      currentSemesterDue: totalDue,
      currentSemesterPaid: totalPaid,
      outstandingBalance: remaining,
      status: (remaining === 0 && totalPaid > 0 ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID') as Database['public']['Enums']['due_status'],
    };
  }).filter((s) => {
    if (!normalizedQuery) return true;
    return (
      s.studentNumber.toLowerCase().includes(normalizedQuery) ||
      s.nameAr.toLowerCase().includes(normalizedQuery) ||
      s.nameEn.toLowerCase().includes(normalizedQuery) ||
      s.email.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Fetches complete financial ledger profile of a student for administrators.
 */
export async function getAdminStudentProfile(
  studentId: string
): Promise<AdminStudentFinancialProfile | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', studentId).single();
      const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();

      if (!profile || !student) return null;

      const { data: currentSemester } = await supabase
        .from('semesters')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();

      const { data: rawDues } = await supabase
        .from('student_dues')
        .select('*, semester:semesters(*)')
        .eq('student_id', studentId);

      const dues = (rawDues || []) as unknown as (Database['public']['Tables']['student_dues']['Row'] & {
        semester: Database['public']['Tables']['semesters']['Row'];
      })[];

      let totalDue = 0;
      let totalPaid = 0;
      dues.forEach((d) => {
        totalDue += Number(d.original_amount) - Number(d.discount_amount);
        totalPaid += Number(d.paid_amount);
      });
      const totalRemaining = Math.max(0, totalDue - totalPaid);

      const { data: txns } = await supabase
        .from('transactions')
        .select('*, receipt:receipts(receipt_number), semester:semesters(code, name_ar, name_en)')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false });

      const rawTxns = (txns || []) as unknown as RawAdminJoinedTxn[];
      const transactions: AdminTransactionItem[] = rawTxns.map((t) => ({
        ...t,
        student_number: student.student_number,
        student_name_ar: profile.full_name_ar,
        student_name_en: profile.full_name_en,
        receipt_number: t.receipt?.[0]?.receipt_number || null,
        semester_code: t.semester?.code || '',
        semester_name_ar: t.semester?.name_ar || '',
        semester_name_en: t.semester?.name_en || '',
      }));

      const overallStatus =
        totalRemaining === 0 && totalPaid > 0 ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      return {
        profile,
        student,
        currentSemester: currentSemester || null,
        totalDue,
        totalPaid,
        totalRemaining,
        overallStatus,
        dues,
        transactions,
      };
    } catch (err) {
      console.warn('[ADMIN_STUDENT_PROFILE_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

  const profile = MOCK_PROFILES.find((p) => p.id === studentId);
  const student = MOCK_STUDENTS.find((s) => s.id === studentId);
  if (!profile || !student) return null;

  const currentSemester = MOCK_SEMESTERS.find((s) => s.is_current) || MOCK_SEMESTERS[0];
  const dues = MOCK_STUDENT_DUES.filter((d) => d.student_id === studentId).map((due) => ({
    ...due,
    semester: MOCK_SEMESTERS.find((s) => s.id === due.semester_id) || currentSemester,
  }));

  let totalDue = 0;
  let totalPaid = 0;
  dues.forEach((d) => {
    totalDue += Number(d.original_amount) - Number(d.discount_amount);
    totalPaid += Number(d.paid_amount);
  });
  const totalRemaining = Math.max(0, totalDue - totalPaid);

  const transactions: AdminTransactionItem[] = MOCK_TRANSACTIONS.filter((t) => t.student_id === studentId).map(
    (t) => {
      const receipt = MOCK_RECEIPTS.find((r) => r.transaction_id === t.id);
      const semester = MOCK_SEMESTERS.find((s) => s.id === t.semester_id);
      return {
        ...t,
        student_number: student.student_number,
        student_name_ar: profile.full_name_ar,
        student_name_en: profile.full_name_en,
        receipt_number: receipt?.receipt_number || null,
        semester_code: semester?.code || '',
        semester_name_ar: semester?.name_ar || '',
        semester_name_en: semester?.name_en || '',
      };
    }
  );

  const overallStatus =
    totalRemaining === 0 && totalPaid > 0 ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

  return {
    profile,
    student,
    currentSemester,
    totalDue,
    totalPaid,
    totalRemaining,
    overallStatus,
    dues,
    transactions,
  };
}

/**
 * Fetches filtered payments list for administrators.
 */
export async function getAdminPayments(filters?: {
  query?: string;
  status?: string;
  method?: string;
}): Promise<AdminTransactionItem[]> {
  const queryStr = (filters?.query || '').trim().toLowerCase();
  const statusFilter = filters?.status || 'ALL';
  const methodFilter = filters?.method || 'ALL';

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      let req = supabase
        .from('transactions')
        .select(`
          *,
          receipt:receipts(receipt_number),
          semester:semesters(code, name_ar, name_en),
          student:students!inner(student_number, profile:profiles!inner(full_name_ar, full_name_en))
        `)
        .order('payment_date', { ascending: false });

      if (statusFilter !== 'ALL') {
        req = req.eq('status', statusFilter as Database['public']['Enums']['transaction_status']);
      }
      if (methodFilter !== 'ALL') {
        req = req.eq('payment_method', methodFilter as Database['public']['Enums']['payment_method']);
      }

      const { data } = await req;
      if (data) {
        const rawItems = data as unknown as RawAdminJoinedTxn[];
        let items: AdminTransactionItem[] = rawItems.map((t) => ({
          ...t,
          student_number: t.student?.student_number || 'N/A',
          student_name_ar: t.student?.profile?.full_name_ar || 'غير محدد',
          student_name_en: t.student?.profile?.full_name_en || 'Unknown',
          receipt_number: t.receipt?.[0]?.receipt_number || null,
          semester_code: t.semester?.code || '',
          semester_name_ar: t.semester?.name_ar || '',
          semester_name_en: t.semester?.name_en || '',
        }));

        if (queryStr) {
          items = items.filter(
            (i) =>
              i.transaction_number.toLowerCase().includes(queryStr) ||
              (i.receipt_number && i.receipt_number.toLowerCase().includes(queryStr)) ||
              i.student_number.toLowerCase().includes(queryStr) ||
              i.student_name_ar.toLowerCase().includes(queryStr) ||
              i.student_name_en.toLowerCase().includes(queryStr)
          );
        }

        return items;
      }
    } catch (err) {
      console.warn('[ADMIN_PAYMENTS_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

  // Fallback using mock data
  let list: AdminTransactionItem[] = MOCK_TRANSACTIONS.map((t) => {
    const student = MOCK_STUDENTS.find((s) => s.id === t.student_id);
    const profile = MOCK_PROFILES.find((p) => p.id === t.student_id);
    const receipt = MOCK_RECEIPTS.find((r) => r.transaction_id === t.id);
    const semester = MOCK_SEMESTERS.find((s) => s.id === t.semester_id);

    return {
      ...t,
      student_number: student?.student_number || 'N/A',
      student_name_ar: profile?.full_name_ar || 'طالب تجريبي',
      student_name_en: profile?.full_name_en || 'Demo Student',
      receipt_number: receipt?.receipt_number || null,
      semester_code: semester?.code || '',
      semester_name_ar: semester?.name_ar || '',
      semester_name_en: semester?.name_en || '',
    };
  });

  if (statusFilter !== 'ALL') {
    list = list.filter((t) => t.status === statusFilter);
  }
  if (methodFilter !== 'ALL') {
    list = list.filter((t) => t.payment_method === methodFilter);
  }
  if (queryStr) {
    list = list.filter(
      (t) =>
        t.transaction_number.toLowerCase().includes(queryStr) ||
        (t.receipt_number && t.receipt_number.toLowerCase().includes(queryStr)) ||
        t.student_number.toLowerCase().includes(queryStr) ||
        t.student_name_ar.toLowerCase().includes(queryStr) ||
        t.student_name_en.toLowerCase().includes(queryStr)
    );
  }

  return list;
}

export interface AdminAuditLogFilters {
  limit?: number;
  action?: string;
  actorId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Fetches immutable audit logs for administrators with optional filtering.
 */
export async function getAdminAuditLogs(
  options?: number | AdminAuditLogFilters
): Promise<Database['public']['Tables']['audit_logs']['Row'][]> {
  const filters: AdminAuditLogFilters = typeof options === 'number' ? { limit: options } : options || {};
  const limit = Math.min(filters.limit || 50, 200);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      let query = supabase.from('audit_logs').select('*');

      if (filters.action && filters.action !== 'ALL') {
        query = query.eq('action', filters.action);
      }
      if (filters.actorId) {
        query = query.eq('actor_id', filters.actorId);
      }
      if (filters.fromDate) {
        query = query.gte('created_at', `${filters.fromDate}T00:00:00Z`);
      }
      if (filters.toDate) {
        query = query.lte('created_at', `${filters.toDate}T23:59:59Z`);
      }

      const { data } = await query.order('created_at', { ascending: false }).limit(limit);

      if (data) return data;
    } catch (err) {
      console.warn('[ADMIN_AUDIT_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

  let list = [...MOCK_AUDIT_LOGS];
  if (filters.action && filters.action !== 'ALL') {
    list = list.filter((l) => l.action === filters.action);
  }
  if (filters.actorId) {
    list = list.filter((l) => l.actor_id === filters.actorId);
  }

  return list.slice(0, limit);
}

export interface StudentDueForPayment {
  id: string;
  semesterId: string;
  semesterCode: string;
  semesterNameAr: string;
  semesterNameEn: string;
  titleAr: string;
  titleEn: string;
  originalAmount: number;
  discountAmount: number;
  netDueAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: Database['public']['Enums']['due_status'];
  dueDate: string | null;
  isEligible: boolean;
}

/**
 * Fetches all semester dues for a student to determine payment eligibility.
 */
export async function getStudentDuesForPayment(
  studentId: string
): Promise<StudentDueForPayment[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('student_dues')
        .select('*, semester:semesters(*)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (data) {
        type RawDueItem = Database['public']['Tables']['student_dues']['Row'] & {
          semester?: Database['public']['Tables']['semesters']['Row'];
        };
        const rawItems = data as unknown as RawDueItem[];
        return rawItems.map((d) => {
          const orig = Number(d.original_amount);
          const disc = Number(d.discount_amount || 0);
          const paid = Number(d.paid_amount || 0);
          const net = orig - disc;
          const remaining = Math.max(0, net - paid);
          return {
            id: d.id,
            semesterId: d.semester_id,
            semesterCode: d.semester?.code || '',
            semesterNameAr: d.semester?.name_ar || '',
            semesterNameEn: d.semester?.name_en || '',
            titleAr: d.title_ar,
            titleEn: d.title_en,
            originalAmount: orig,
            discountAmount: disc,
            netDueAmount: net,
            paidAmount: paid,
            remainingBalance: remaining,
            status: d.status,
            dueDate: d.due_date,
            isEligible: remaining > 0,
          };
        });
      }
    } catch (err) {
      console.warn('[ADMIN_DUES_FALLBACK] Error querying Supabase dues, using mock dataset:', err);
    }
  }

  // Mock fallback
  const dues = MOCK_STUDENT_DUES.filter((d) => d.student_id === studentId);
  return dues.map((d) => {
    const sem = MOCK_SEMESTERS.find((s) => s.id === d.semester_id);
    const orig = Number(d.original_amount);
    const disc = Number(d.discount_amount || 0);
    const paid = Number(d.paid_amount || 0);
    const net = orig - disc;
    const remaining = Math.max(0, net - paid);
    return {
      id: d.id,
      semesterId: d.semester_id,
      semesterCode: sem?.code || '',
      semesterNameAr: sem?.name_ar || '',
      semesterNameEn: sem?.name_en || '',
      titleAr: d.title_ar,
      titleEn: d.title_en,
      originalAmount: orig,
      discountAmount: disc,
      netDueAmount: net,
      paidAmount: paid,
      remainingBalance: remaining,
      status: d.status,
      dueDate: d.due_date,
      isEligible: remaining > 0,
    };
  });
}

