import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthorizedReceiptDetails {
  receipt: Database['public']['Tables']['receipts']['Row'];
  transaction: Database['public']['Tables']['transactions']['Row'];
  student: Database['public']['Tables']['students']['Row'];
  profile: Database['public']['Tables']['profiles']['Row'];
  semester: Database['public']['Tables']['semesters']['Row'];
  cashierEmployeeId: string;
}

export type ReceiptAuthorizationError =
  | 'UNAUTHENTICATED'
  | 'INACTIVE_PROFILE'
  | 'STUDENT_RECORD_MISSING'
  | 'FORBIDDEN'
  | 'NOT_FOUND';

export interface GetReceiptResult {
  data?: AuthorizedReceiptDetails;
  error?: ReceiptAuthorizationError;
}

/**
 * Retrieves full receipt details strictly through the user's authenticated SSR session
 * and verifies domain ownership through the auth.users -> profiles -> students -> receipts chain.
 *
 * ZERO use of service_role to bypass Row Level Security.
 */
export async function getAuthorizedReceiptData(
  receiptId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<GetReceiptResult> {
  const supabase = supabaseClient ?? (await createClient());

  // 1. Authenticate session caller
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'UNAUTHENTICATED' };
  }

  // 2. Resolve domain profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return { error: 'INACTIVE_PROFILE' };
  }

  // 3. Resolve role-based authorization chain
  let verifiedStudentId: string | null = null;

  if (profile.role === 'STUDENT') {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', profile.id)
      .single();

    if (studentError || !student) {
      return { error: 'STUDENT_RECORD_MISSING' };
    }

    verifiedStudentId = student.id;
  } else if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
    return { error: 'FORBIDDEN' };
  }

  // 4. Fetch receipt under RLS with user credentials
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select(`
      *,
      transaction:transactions!inner(
        *,
        semester:semesters!inner(*)
      ),
      student:students!inner(
        *,
        profile:profiles!inner(*)
      )
    `)
    .eq('id', receiptId)
    .maybeSingle();

  if (receiptError || !receipt) {
    return { error: 'NOT_FOUND' };
  }

  type RawJoinedReceipt = typeof receipt & {
    transaction: Database['public']['Tables']['transactions']['Row'] & {
      semester: Database['public']['Tables']['semesters']['Row'];
    };
    student: Database['public']['Tables']['students']['Row'] & {
      profile: Database['public']['Tables']['profiles']['Row'];
    };
  };

  const raw = receipt as unknown as RawJoinedReceipt;

  // 5. Strict Student Ownership Check: receipts.student_id must match verified student.id
  if (verifiedStudentId && raw.student_id !== verifiedStudentId) {
    return { error: 'FORBIDDEN' };
  }

  // Fetch cashier employee_id from metadata or admins table
  let cashierEmployeeId = 'DEMO-ADM-001';
  if (raw.transaction.recorded_by) {
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('employee_id')
      .eq('id', raw.transaction.recorded_by)
      .maybeSingle();

    if (adminRecord?.employee_id) {
      cashierEmployeeId = adminRecord.employee_id;
    } else if (raw.metadata && typeof raw.metadata === 'object' && 'recorded_by' in raw.metadata) {
      cashierEmployeeId = String((raw.metadata as Record<string, unknown>).recorded_by || 'DEMO-ADM-001');
    }
  }

  return {
    data: {
      receipt: {
        id: raw.id,
        receipt_number: raw.receipt_number,
        transaction_id: raw.transaction_id,
        student_id: raw.student_id,
        issued_at: raw.issued_at,
        total_amount: raw.total_amount,
        currency: raw.currency,
        verification_hash: raw.verification_hash,
        metadata: raw.metadata,
        created_at: raw.created_at,
      },
      transaction: raw.transaction,
      student: raw.student,
      profile: raw.student.profile,
      semester: raw.transaction.semester,
      cashierEmployeeId,
    },
  };
}
