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
  isDevMockEnabled,
  isSupabaseConfigured,
} from './mock-data';

export type StudentDueWithSemester = Database['public']['Tables']['student_dues']['Row'] & {
  semester: Database['public']['Tables']['semesters']['Row'];
};

export type TransactionWithDetails = Database['public']['Tables']['transactions']['Row'] & {
  receipt_number?: string | null;
  semester_name_ar?: string | null;
  semester_name_en?: string | null;
};

type RawJoinedTxn = Database['public']['Tables']['transactions']['Row'] & {
  receipt?: { receipt_number: string }[];
  semester?: { name_ar: string; name_en: string };
};

export interface StudentDashboardData {
  profile: Database['public']['Tables']['profiles']['Row'];
  student: Database['public']['Tables']['students']['Row'];
  currentSemester: Database['public']['Tables']['semesters']['Row'] | null;
  currentSemesterDue: StudentDueWithSemester | null;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  overallStatus: Database['public']['Enums']['due_status'];
  recentTransactions: TransactionWithDetails[];
}

export interface StudentFeesData {
  profile: Database['public']['Tables']['profiles']['Row'];
  student: Database['public']['Tables']['students']['Row'];
  dues: StudentDueWithSemester[];
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
}

export interface StudentProfileData {
  profile: Database['public']['Tables']['profiles']['Row'];
  student: Database['public']['Tables']['students']['Row'];
}

/**
 * Fetches dashboard financial data for an authenticated student.
 * Fails closed: Never falls back to mock data unless isDevMockEnabled() is explicitly true.
 * NEVER substitutes one student's profile for another.
 */
export async function getStudentDashboardData(
  studentId: string
): Promise<StudentDashboardData | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();

    // 1. Fetch Profile and Student
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`Failed to query student profile: ${profileErr.message}`);
    }

    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr) {
      throw new Error(`Failed to query student record: ${studentErr.message}`);
    }

    if (!profile || !student) return null;

    // 2. Fetch Current Semester
    const { data: currentSemester, error: semErr } = await supabase
      .from('semesters')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();

    if (semErr) {
      throw new Error(`Failed to query current semester: ${semErr.message}`);
    }

    // 3. Fetch All Dues for Student
    const { data: allDues, error: duesErr } = await supabase
      .from('student_dues')
      .select('*, semester:semesters(*)')
      .eq('student_id', studentId);

    if (duesErr) {
      throw new Error(`Failed to query student dues: ${duesErr.message}`);
    }

    const duesList = (allDues || []) as unknown as StudentDueWithSemester[];

    let totalDue = 0;
    let totalPaid = 0;
    duesList.forEach((d) => {
      const net = Number(d.original_amount) - Number(d.discount_amount);
      totalDue += net;
      totalPaid += Number(d.paid_amount);
    });
    const totalRemaining = Math.max(0, totalDue - totalPaid);

    const currentDue = currentSemester
      ? duesList.find((d) => d.semester_id === currentSemester.id) || null
      : null;

    // 4. Fetch Recent Transactions
    const { data: txns, error: txnsErr } = await supabase
      .from('transactions')
      .select('*, receipt:receipts(receipt_number), semester:semesters(name_ar, name_en)')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false })
      .limit(5);

    if (txnsErr) {
      throw new Error(`Failed to query student transactions: ${txnsErr.message}`);
    }

    const rawTxns = (txns || []) as unknown as RawJoinedTxn[];
    const recentTransactions: TransactionWithDetails[] = rawTxns.map((t) => ({
      ...t,
      receipt_number: t.receipt?.[0]?.receipt_number || null,
      semester_name_ar: t.semester?.name_ar || null,
      semester_name_en: t.semester?.name_en || null,
    }));

    const overallStatus =
      totalRemaining === 0 && totalPaid > 0
        ? 'PAID'
        : totalPaid > 0
        ? 'PARTIALLY_PAID'
        : 'UNPAID';

    return {
      profile,
      student,
      currentSemester: currentSemester || null,
      currentSemesterDue: currentDue,
      totalDue,
      totalPaid,
      totalRemaining,
      overallStatus,
      recentTransactions,
    };
  }

  if (isDevMockEnabled()) {
    const profile = MOCK_PROFILES.find((p) => p.id === studentId);
    if (!profile) return null;
    const student = MOCK_STUDENTS.find((s) => s.id === profile.id);
    if (!student) return null;

    const currentSemester = MOCK_SEMESTERS.find((s) => s.is_current) || MOCK_SEMESTERS[0];
    const studentDues = MOCK_STUDENT_DUES.filter((d) => d.student_id === student.id).map((due) => ({
      ...due,
      semester: MOCK_SEMESTERS.find((s) => s.id === due.semester_id) || currentSemester,
    }));

    let totalDue = 0;
    let totalPaid = 0;
    studentDues.forEach((d) => {
      const net = Number(d.original_amount) - Number(d.discount_amount);
      totalDue += net;
      totalPaid += Number(d.paid_amount);
    });
    const totalRemaining = Math.max(0, totalDue - totalPaid);

    const currentDue = studentDues.find((d) => d.semester_id === currentSemester.id) || null;

    const txns = MOCK_TRANSACTIONS.filter((t) => t.student_id === student.id)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 5)
      .map((t) => {
        const r = MOCK_RECEIPTS.find((rcp) => rcp.transaction_id === t.id);
        const sem = MOCK_SEMESTERS.find((s) => s.id === t.semester_id);
        return {
          ...t,
          receipt_number: r?.receipt_number || null,
          semester_name_ar: sem?.name_ar || null,
          semester_name_en: sem?.name_en || null,
        };
      });

    const overallStatus =
      totalRemaining === 0 && totalPaid > 0 ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    return {
      profile,
      student,
      currentSemester,
      currentSemesterDue: currentDue,
      totalDue,
      totalPaid,
      totalRemaining,
      overallStatus,
      recentTransactions: txns,
    };
  }

  throw new Error('Student database is not configured and development mock data is disabled.');
}

/**
 * Fetches all semester dues and breakdown for an authenticated student.
 * Fails closed: Never falls back to mock data unless isDevMockEnabled() is explicitly true.
 */
export async function getStudentFeesData(studentId: string): Promise<StudentFeesData | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`Failed to query student profile: ${profileErr.message}`);
    }

    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr) {
      throw new Error(`Failed to query student record: ${studentErr.message}`);
    }

    if (!profile || !student) return null;

    const { data: dues, error: duesErr } = await supabase
      .from('student_dues')
      .select('*, semester:semesters(*)')
      .eq('student_id', studentId);

    if (duesErr) {
      throw new Error(`Failed to query student dues: ${duesErr.message}`);
    }

    const duesList = (dues || []) as unknown as StudentDueWithSemester[];

    let totalDue = 0;
    let totalPaid = 0;
    duesList.forEach((d) => {
      const net = Number(d.original_amount) - Number(d.discount_amount);
      totalDue += net;
      totalPaid += Number(d.paid_amount);
    });

    return {
      profile,
      student,
      dues: duesList,
      totalDue,
      totalPaid,
      totalRemaining: Math.max(0, totalDue - totalPaid),
    };
  }

  if (isDevMockEnabled()) {
    const profile = MOCK_PROFILES.find((p) => p.id === studentId);
    if (!profile) return null;
    const student = MOCK_STUDENTS.find((s) => s.id === profile.id);
    if (!student) return null;

    const dues = MOCK_STUDENT_DUES.filter((d) => d.student_id === student.id).map((due) => ({
      ...due,
      semester: MOCK_SEMESTERS.find((s) => s.id === due.semester_id) || MOCK_SEMESTERS[0],
    }));

    let totalDue = 0;
    let totalPaid = 0;
    dues.forEach((d) => {
      const net = Number(d.original_amount) - Number(d.discount_amount);
      totalDue += net;
      totalPaid += Number(d.paid_amount);
    });

    return {
      profile,
      student,
      dues,
      totalDue,
      totalPaid,
      totalRemaining: Math.max(0, totalDue - totalPaid),
    };
  }

  throw new Error('Student fee database is not configured and development mock data is disabled.');
}

/**
 * Fetches all transactions for an authenticated student.
 * Fails closed: Never falls back to mock data unless isDevMockEnabled() is explicitly true.
 */
export async function getStudentTransactions(studentId: string): Promise<TransactionWithDetails[]> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: txns, error } = await supabase
      .from('transactions')
      .select('*, receipt:receipts(receipt_number), semester:semesters(name_ar, name_en)')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to query student transactions: ${error.message}`);
    }

    const rawTxns = (txns || []) as unknown as RawJoinedTxn[];
    return rawTxns.map((t) => ({
      ...t,
      receipt_number: t.receipt?.[0]?.receipt_number || null,
      semester_name_ar: t.semester?.name_ar || null,
      semester_name_en: t.semester?.name_en || null,
    }));
  }

  if (isDevMockEnabled()) {
    return MOCK_TRANSACTIONS.filter((t) => t.student_id === studentId)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .map((t) => {
        const r = MOCK_RECEIPTS.find((rcp) => rcp.transaction_id === t.id);
        const sem = MOCK_SEMESTERS.find((s) => s.id === t.semester_id);
        return {
          ...t,
          receipt_number: r?.receipt_number || null,
          semester_name_ar: sem?.name_ar || null,
          semester_name_en: sem?.name_en || null,
        };
      });
  }

  throw new Error('Transaction database is not configured and development mock data is disabled.');
}

/**
 * Fetches a single transaction by ID, strictly enforcing student ownership.
 * Fails closed: Never falls back to mock data unless isDevMockEnabled() is explicitly true.
 */
export async function getStudentTransactionById(
  studentId: string,
  transactionId: string
): Promise<TransactionWithDetails | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: txn, error } = await supabase
      .from('transactions')
      .select('*, receipt:receipts(receipt_number), semester:semesters(name_ar, name_en)')
      .eq('id', transactionId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query student transaction: ${error.message}`);
    }

    if (!txn) return null;

    const t = txn as unknown as RawJoinedTxn;
    return {
      ...t,
      receipt_number: t.receipt?.[0]?.receipt_number || null,
      semester_name_ar: t.semester?.name_ar || null,
      semester_name_en: t.semester?.name_en || null,
    };
  }

  if (isDevMockEnabled()) {
    const txn = MOCK_TRANSACTIONS.find((t) => t.id === transactionId && t.student_id === studentId);
    if (!txn) return null;

    const r = MOCK_RECEIPTS.find((rcp) => rcp.transaction_id === txn.id);
    const sem = MOCK_SEMESTERS.find((s) => s.id === txn.semester_id);

    return {
      ...txn,
      receipt_number: r?.receipt_number || null,
      semester_name_ar: sem?.name_ar || null,
      semester_name_en: sem?.name_en || null,
    };
  }

  throw new Error('Transaction database is not configured and development mock data is disabled.');
}

/**
 * Fetches profile details for an authenticated student.
 * Fails closed: Never falls back to mock data unless isDevMockEnabled() is explicitly true.
 * NEVER substitutes one student's profile for another.
 */
export async function getStudentProfile(studentId: string): Promise<StudentProfileData | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (profileErr) {
      throw new Error(`Failed to query profile: ${profileErr.message}`);
    }

    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (studentErr) {
      throw new Error(`Failed to query student: ${studentErr.message}`);
    }

    if (profile && student) {
      return { profile, student };
    }
    return null;
  }

  if (isDevMockEnabled()) {
    const profile = MOCK_PROFILES.find((p) => p.id === studentId);
    if (!profile) return null;
    const student = MOCK_STUDENTS.find((s) => s.id === profile.id);
    if (!student) return null;

    return { profile, student };
  }

  throw new Error('Profile database is not configured and development mock data is disabled.');
}
