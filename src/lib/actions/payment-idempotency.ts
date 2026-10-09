import 'server-only';

export type IdempotencyMismatchReason =
  | 'STATUS_INELIGIBLE'
  | 'STUDENT_MISMATCH'
  | 'SEMESTER_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'METHOD_MISMATCH'
  | 'STUDENT_DUE_MISMATCH';

export interface IdempotencyValidationResult {
  isMatch: boolean;
  mismatchReason?: IdempotencyMismatchReason;
}

export interface PersistedTransactionIdempotencyRecord {
  student_id: string;
  semester_id: string;
  amount: number | string;
  payment_method: string;
  status: string;
  student_due_id?: string | null;
}

export interface IncomingPaymentIdempotencyRequest {
  studentId: string;
  semesterId: string;
  amount: number;
  paymentMethod: string;
  studentDueId?: string | null;
}

/**
 * Validates whether an incoming payment request matches an existing persisted transaction
 * sharing the same idempotency key.
 *
 * Enforces strict financial integrity:
 * 1. Only transactions in 'COMPLETED' status are eligible for duplicate replay.
 *    Voided transactions cannot be replayed as successful payments.
 * 2. The existing transaction must strictly match the incoming request's student_id,
 *    semester_id, amount, and payment_method.
 * 3. If a student_due_id is supplied in the request, it must match the persisted student_due_id.
 *
 * Pure function: independent of Supabase, Next.js request context, or database queries.
 */
export function validateIdempotencyReplay(
  persisted: PersistedTransactionIdempotencyRecord,
  incoming: IncomingPaymentIdempotencyRequest
): IdempotencyValidationResult {
  if (persisted.status !== 'COMPLETED') {
    return { isMatch: false, mismatchReason: 'STATUS_INELIGIBLE' };
  }
  if (persisted.student_id !== incoming.studentId) {
    return { isMatch: false, mismatchReason: 'STUDENT_MISMATCH' };
  }
  if (persisted.semester_id !== incoming.semesterId) {
    return { isMatch: false, mismatchReason: 'SEMESTER_MISMATCH' };
  }
  if (Number(persisted.amount) !== incoming.amount) {
    return { isMatch: false, mismatchReason: 'AMOUNT_MISMATCH' };
  }
  if (persisted.payment_method !== incoming.paymentMethod) {
    return { isMatch: false, mismatchReason: 'METHOD_MISMATCH' };
  }
  if (
    incoming.studentDueId != null &&
    persisted.student_due_id !== incoming.studentDueId
  ) {
    return {
      isMatch: false,
      mismatchReason: 'STUDENT_DUE_MISMATCH',
    };
  }
  return { isMatch: true };
}
