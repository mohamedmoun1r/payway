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
 * Checks whether remote Supabase has reachable credentials configured.
 */
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes('placeholder-project') && !url.includes('your-project-id'));
}

/**
 * Fetches dashboard financial data for an authenticated student.
 */
export async function getStudentDashboardData(
  studentId: string
): Promise<StudentDashboardData | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();

      // 1. Fetch Profile and Student
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', studentId).single();
      const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();

      if (!profile || !student) return null;

      // 2. Fetch Current Semester
      const { data: currentSemester } = await supabase
        .from('semesters')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();

      // 3. Fetch All Dues for Student
      const { data: allDues } = await supabase
        .from('student_dues')
        .select('*, semester:semesters(*)')
        .eq('student_id', studentId);

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
      const { data: txns } = await supabase
        .from('transactions')
        .select('*, receipt:receipts(receipt_number), semester:semesters(name_ar, name_en)')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false })
        .limit(5);

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
    } catch (err) {
      console.warn('[STUDENT_DATA_FALLBACK] Error querying Supabase, falling back to mock dataset:', err);
    }
  }

  // Fallback to synthetic demo dataset
  const profile = MOCK_PROFILES.find((p) => p.id === studentId) || MOCK_PROFILES[2]; // Default to Student 1
  const student = MOCK_STUDENTS.find((s) => s.id === profile.id) || MOCK_STUDENTS[0];
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

/**
 * Fetches all semester dues and breakdown for an authenticated student.
 */
export async function getStudentFeesData(studentId: string): Promise<StudentFeesData | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', studentId).single();
      const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();

      if (!profile || !student) return null;

      const { data: dues } = await supabase
        .from('student_dues')
        .select('*, semester:semesters(*)')
        .eq('student_id', studentId);

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
    } catch (err) {
      console.warn('[STUDENT_FEES_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

  const profile = MOCK_PROFILES.find((p) => p.id === studentId) || MOCK_PROFILES[2];
  const student = MOCK_STUDENTS.find((s) => s.id === profile.id) || MOCK_STUDENTS[0];

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

/**
 * Fetches all transactions for an authenticated student.
 */
export async function getStudentTransactions(studentId: string): Promise<TransactionWithDetails[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: txns } = await supabase
        .from('transactions')
        .select('*, receipt:receipts(receipt_number), semester:semesters(name_ar, name_en)')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false });

      if (txns) {
        const rawTxns = txns as unknown as RawJoinedTxn[];
        return rawTxns.map((t) => ({
          ...t,
          receipt_number: t.receipt?.[0]?.receipt_number || null,
          semester_name_ar: t.semester?.name_ar || null,
          semester_name_en: t.semester?.name_en || null,
        }));
      }
    } catch (err) {
      console.warn('[STUDENT_TXNS_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

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

/**
 * Fetches a single transaction by ID, strictly enforcing student ownership.
 */
export async function getStudentTransactionById(
  studentId: string,
  transactionId: string
): Promise<TransactionWithDetails | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: txn } = await supabase
        .from('transactions')
        .select('*, receipt:receipts(receipt_number), semester:semesters(name_ar, name_en)')
        .eq('id', transactionId)
        .eq('student_id', studentId)
        .single();

      if (txn) {
        const t = txn as unknown as RawJoinedTxn;
        return {
          ...t,
          receipt_number: t.receipt?.[0]?.receipt_number || null,
          semester_name_ar: t.semester?.name_ar || null,
          semester_name_en: t.semester?.name_en || null,
        };
      }
    } catch (err) {
      console.warn('[STUDENT_TXN_BY_ID_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

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

/**
 * Fetches profile details for an authenticated student.
 */
export async function getStudentProfile(studentId: string): Promise<StudentProfileData | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', studentId).single();
      const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();

      if (profile && student) {
        return { profile, student };
      }
    } catch (err) {
      console.warn('[STUDENT_PROFILE_FALLBACK] Error querying Supabase, using mock dataset:', err);
    }
  }

  const profile = MOCK_PROFILES.find((p) => p.id === studentId) || MOCK_PROFILES[2];
  const student = MOCK_STUDENTS.find((s) => s.id === profile.id) || MOCK_STUDENTS[0];

  return { profile, student };
}
