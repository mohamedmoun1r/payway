import 'server-only';
import type { Database } from '@/types/database.types';

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

export interface NormalizedReceiptSummary {
  id: string | null;
  receiptNumber: string | null;
}

/**
 * Normalizes the shape of embedded receipt relations returned from Supabase queries.
 * PostgREST returns a single object for 1:1 foreign key relationships, but may return
 * an array, null, or empty array depending on client drivers and relation types.
 *
 * Guarantees:
 * - If receipt data exists, extracts non-empty string IDs and receipt numbers.
 * - If receipt data is missing, returns null for both (never fabricates identifiers).
 */
export function extractReceiptSummary(receiptData: unknown): NormalizedReceiptSummary {
  if (!receiptData) {
    return { id: null, receiptNumber: null };
  }

  if (Array.isArray(receiptData)) {
    if (receiptData.length === 0 || !receiptData[0] || typeof receiptData[0] !== 'object') {
      return { id: null, receiptNumber: null };
    }
    const item = receiptData[0] as Record<string, unknown>;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : null;
    const receiptNumber =
      typeof item.receipt_number === 'string' && item.receipt_number.trim()
        ? item.receipt_number.trim()
        : null;
    return { id, receiptNumber };
  }

  if (typeof receiptData === 'object') {
    const obj = receiptData as Record<string, unknown>;
    const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : null;
    const receiptNumber =
      typeof obj.receipt_number === 'string' && obj.receipt_number.trim()
        ? obj.receipt_number.trim()
        : null;
    return { id, receiptNumber };
  }

  return { id: null, receiptNumber: null };
}

/**
 * Constructs a fail-closed localized error message when an existing completed transaction
 * is detected during idempotency replay, but its receipt cannot be retrieved or validated.
 *
 * Guarantees:
 * - Directs the cashier to inspect the transaction ledger.
 * - Safely incorporates the transaction number only if it is a non-empty string.
 * - Localized for Arabic and English.
 */
export function buildMissingReceiptReplayError(
  transactionNumber: string | null | undefined,
  isAr: boolean
): string {
  const safeTxnNum =
    typeof transactionNumber === 'string' && transactionNumber.trim()
      ? transactionNumber.trim()
      : null;

  if (isAr) {
    return safeTxnNum
      ? `تم تسجيل معاملة مسبقاً برقم (${safeTxnNum})، ولكن تعذر استرجاع الإيصال الخاص بها. يرجى مراجعة سجل المعاملات.`
      : 'تم تسجيل معاملة مسبقاً بهذا المفتاح، ولكن تعذر استرجاع الإيصال الخاص بها. يرجى مراجعة سجل المعاملات.';
  }

  return safeTxnNum
    ? `A previous transaction was found (${safeTxnNum}), but its receipt could not be retrieved. Please check the transaction ledger.`
    : 'A previous transaction was found for this key, but its receipt could not be retrieved. Please check the transaction ledger.';
}

export interface ReplayableTransactionRecord {
  id: string;
  transaction_number?: string | null;
  receipt?: unknown;
  student_id: string;
  amount: number | string;
  payment_method: Database['public']['Enums']['payment_method'] | string;
  payment_date: string;
  payment_time: string;
  status: Database['public']['Enums']['transaction_status'] | string;
  student?: {
    student_number?: string | null;
    profile?: { full_name_ar?: string | null; full_name_en?: string | null } | null;
  } | null;
  student_due?: {
    original_amount: number | string;
    discount_amount: number | string;
    paid_amount: number | string;
  } | null;
}

export type IdempotencyReplayOutcome =
  | {
      success: true;
      data: {
        transactionId: string;
        receiptId: string;
        transactionNumber: string;
        receiptNumber: string;
        studentId: string;
        studentNameAr: string;
        studentNameEn: string;
        studentNumber: string;
        amount: number;
        paymentMethod: Database['public']['Enums']['payment_method'];
        paymentDate: string;
        paymentTime: string;
        newRemainingBalance: number;
        status: Database['public']['Enums']['transaction_status'];
        isDuplicate: true;
      };
    }
  | {
      success: false;
      error: string;
    };

/**
 * Resolves an idempotency replay for an existing completed transaction.
 *
 * Enforces fail-closed financial integrity:
 * - When an existing transaction is confirmed as COMPLETED, but its receipt cannot
 *   be retrieved or extractReceiptSummary() returns a missing/invalid receipt ID or receipt number:
 *   * Returns success: false (never falsely claims success with blank receipts).
 *   * Directs the cashier to inspect the transaction ledger.
 *   * Includes the existing transaction number safely if present.
 *   * Does not fabricate receipt identifiers.
 * - When a valid receipt is found, returns success: true with the extracted receipt details.
 */
export function resolveCompletedTransactionReplay(
  raw: ReplayableTransactionRecord,
  isAr: boolean
): IdempotencyReplayOutcome {
  const normalizedReceipt = extractReceiptSummary(raw.receipt);
  if (!normalizedReceipt.id || !normalizedReceipt.receiptNumber) {
    return {
      success: false,
      error: buildMissingReceiptReplayError(raw.transaction_number, isAr),
    };
  }

  const remBal = raw.student_due
    ? Math.max(
        0,
        Number(raw.student_due.original_amount) -
          Number(raw.student_due.discount_amount) -
          Number(raw.student_due.paid_amount)
      )
    : 0;

  return {
    success: true,
    data: {
      transactionId: raw.id,
      receiptId: normalizedReceipt.id,
      transactionNumber: raw.transaction_number || '',
      receiptNumber: normalizedReceipt.receiptNumber,
      studentId: raw.student_id,
      studentNameAr: raw.student?.profile?.full_name_ar || '',
      studentNameEn: raw.student?.profile?.full_name_en || '',
      studentNumber: raw.student?.student_number || '',
      amount: Number(raw.amount),
      paymentMethod: raw.payment_method as Database['public']['Enums']['payment_method'],
      paymentDate: raw.payment_date,
      paymentTime: raw.payment_time,
      newRemainingBalance: remBal,
      status: raw.status as Database['public']['Enums']['transaction_status'],
      isDuplicate: true,
    },
  };
}
