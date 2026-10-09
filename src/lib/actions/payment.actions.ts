'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireAdminWithVoidPermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import {
  manualPaymentSchema,
  type ManualPaymentInput,
  voidTransactionSchema,
  type VoidTransactionInput,
} from '@/lib/validations/payment.schema';
import { generateReceiptVerificationHash } from '@/lib/auth/receipt-hash';
import {
  searchStudents,
  getStudentDuesForPayment,
  type AdminStudentSearchResult,
  type StudentDueForPayment,
} from '@/lib/data/admin';
import {
  MOCK_STUDENTS,
  MOCK_PROFILES,
  MOCK_STUDENT_DUES,
  MOCK_TRANSACTIONS,
  MOCK_RECEIPTS,
  MOCK_AUDIT_LOGS,
  isDevMockEnabled,
  isSupabaseConfigured,
} from '@/lib/data/mock-data';
import { validateIdempotencyReplay } from './payment-idempotency';
import type { Locale } from '@/lib/i18n/config';
import type { Database } from '@/types/database.types';

export interface PaymentActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: {
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
    isDuplicate: boolean;
  };
}

export interface VoidActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: {
    transactionId: string;
    restoredBalance: number;
    voidedAt: string;
    status: 'VOIDED';
  };
}

/**
 * Searches students for the manual payment modal picker.
 * Strictly requires active administrator session.
 */
export async function searchStudentsAction(
  query?: string,
  locale: Locale = 'ar'
): Promise<{ success: boolean; students?: AdminStudentSearchResult[]; error?: string }> {
  try {
    await requireAdmin(locale, `/${locale}/admin/payments`);
    const results = await searchStudents(query);
    return { success: true, students: results };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return { success: false, error: message };
  }
}

/**
 * Fetches eligible semester dues for a student for the payment modal.
 * Strictly requires active administrator session.
 */
export async function getStudentDuesAction(
  studentId: string,
  locale: Locale = 'ar'
): Promise<{ success: boolean; dues?: StudentDueForPayment[]; error?: string }> {
  try {
    await requireAdmin(locale, `/${locale}/admin/payments`);
    const dues = await getStudentDuesForPayment(studentId);
    return { success: true, dues };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return { success: false, error: message };
  }
}

/**
 * Records a manual payment using the atomic PostgreSQL function record_manual_payment_atomic.
 * The ONLY financial mutation path in the application.
 */
export async function recordManualPaymentAction(
  input: ManualPaymentInput,
  locale: Locale = 'ar'
): Promise<PaymentActionResult> {
  const isAr = locale === 'ar';

  // 1. Strict Server-Side Authentication & Admin Guard
  let adminContext;
  try {
    adminContext = await requireAdmin(locale, `/${locale}/admin/payments`);
  } catch {
    return {
      success: false,
      error:
        isAr
          ? 'غير مصرح: يجب تسجيل الدخول بحساب مسؤول نشط ومخول بالخزينة'
          : 'Unauthorized: Active authorized administrator session required',
    };
  }

  const adminId = adminContext.admin.id;

  // 2. Strict Input Validation via Zod Schema
  const parseResult = manualPaymentSchema.safeParse(input);
  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    const firstErrorMessage =
      parseResult.error.issues[0]?.message ||
      (isAr ? 'بيانات السداد غير مكتملة أو غير صالحة' : 'Invalid payment form submission');

    return {
      success: false,
      error: firstErrorMessage,
      fieldErrors,
    };
  }

  const validated = parseResult.data;

  // 3. Fail closed if financial persistence or receipt signing is misconfigured.
  // Demo/mock financial writes are permitted only when explicitly enabled in development.
  if (!isSupabaseConfigured() && !isDevMockEnabled()) {
    return {
      success: false,
      error: isAr
        ? 'إعدادات قاعدة البيانات غير مكتملة. تم إيقاف عملية السداد لحماية البيانات المالية.'
        : 'Financial database configuration is incomplete. Payment was blocked.',
    };
  }

  if (!process.env.RECEIPT_HMAC_SECRET?.trim()) {
    return {
      success: false,
      error: isAr
        ? 'إعدادات توقيع الإيصالات غير مكتملة. لم يتم تسجيل أي عملية سداد.'
        : 'Receipt signing is not configured. No payment was recorded.',
    };
  }

  // 4. Server-side Pre-computation of Verification Hash (HMAC SHA-256)
  // RECEIPT_HMAC_SECRET remains strictly in server runtime; never sent to PostgreSQL as a secret
  const verificationHash = generateReceiptVerificationHash({
    studentId: validated.studentId,
    semesterId: validated.semesterId,
    amount: validated.amount,
    paymentDate: validated.paymentDate,
    idempotencyKey: validated.idempotencyKey,
  });

  // 5. Execution via Supabase RPC or non-production mock layer
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();

      // 4.1 Check Idempotency: Has this transaction already been recorded?
      const { data: existingTxn, error: idempotencyLookupError } = await supabase
        .from('transactions')
        .select(`
          id,
          transaction_number,
          student_id,
          semester_id,
          student_due_id,
          amount,
          payment_method,
          payment_date,
          payment_time,
          status,
          receipt:receipts(id, receipt_number),
          student:students!inner(
            student_number,
            profile:profiles!inner(full_name_ar, full_name_en)
          ),
          student_due:student_dues!inner(original_amount, discount_amount, paid_amount)
        `)
        .eq('idempotency_key', validated.idempotencyKey)
        .maybeSingle();

      if (idempotencyLookupError) {
        console.error('[IDEMPOTENCY_LOOKUP_ERROR]', idempotencyLookupError);
        return {
          success: false,
          error: isAr
            ? 'حدث خطأ أثناء التحقق من تكرار العملية. يرجى إعادة المحاولة.'
            : 'Error verifying transaction idempotency. Please retry.',
        };
      }

      if (existingTxn) {
        type RawExistingTxn = typeof existingTxn & {
          receipt?: { id: string; receipt_number: string }[];
          student?: {
            student_number: string;
            profile?: { full_name_ar: string; full_name_en: string };
          };
          student_due?: { original_amount: number; discount_amount: number; paid_amount: number };
        };
        const raw = existingTxn as unknown as RawExistingTxn;

        // Verify that the persisted transaction matches the requested parameters using shared helper
        const replayValidation = validateIdempotencyReplay(raw, validated);
        if (!replayValidation.isMatch) {
          return {
            success: false,
            error: isAr
              ? 'تعارض في مفتاح منع التكرار: تم استخدام هذا المفتاح مسبقاً مع بيانات سداد مختلفة أو لمعاملة غير مؤهلة.'
              : 'Idempotency conflict: The provided idempotency key was previously used with different parameters or for an ineligible transaction.',
          };
        }

        const receipt = raw.receipt?.[0];
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
            receiptId: receipt?.id || '',
            transactionNumber: raw.transaction_number,
            receiptNumber: receipt?.receipt_number || '',
            studentId: raw.student_id,
            studentNameAr: raw.student?.profile?.full_name_ar || '',
            studentNameEn: raw.student?.profile?.full_name_en || '',
            studentNumber: raw.student?.student_number || '',
            amount: Number(raw.amount),
            paymentMethod: raw.payment_method,
            paymentDate: raw.payment_date,
            paymentTime: raw.payment_time,
            newRemainingBalance: remBal,
            status: raw.status,
            isDuplicate: true,
          },
        };
      }

      // 4.2 Execute atomic PostgreSQL function
      const { data, error } = await supabase.rpc('record_manual_payment_atomic', {
        p_student_id: validated.studentId,
        p_semester_id: validated.semesterId,
        p_amount: validated.amount,
        p_payment_method: validated.paymentMethod,
        p_payment_date: validated.paymentDate,
        p_payment_time: validated.paymentTime,
        p_reference_number: validated.referenceNumber,
        p_notes: validated.notes,
        p_admin_id: adminId,
        p_idempotency_key: validated.idempotencyKey,
        p_verification_hash: verificationHash,
      });

      if (error) {
        // Handle specific error codes thrown by record_manual_payment_atomic
        const errorMsg = error.message || '';

        if (errorMsg.includes('OVERPAYMENT')) {
          return {
            success: false,
            error: isAr
              ? 'مبلغ السداد يتجاوز الرصيد المستحق على الطالب'
              : 'Payment amount exceeds outstanding balance',
          };
        }
        if (errorMsg.includes('DUPLICATE_SUBMISSION')) {
          // Idempotency collision during concurrent execution; retry lookup
          const { data: retryTxn, error: retryErr } = await supabase
            .from('transactions')
            .select(`
              id,
              transaction_number,
              student_id,
              semester_id,
              student_due_id,
              amount,
              payment_method,
              payment_date,
              payment_time,
              status,
              receipt:receipts(id, receipt_number),
              student:students!inner(
                student_number,
                profile:profiles!inner(full_name_ar, full_name_en)
              ),
              student_due:student_dues!inner(original_amount, discount_amount, paid_amount)
            `)
            .eq('idempotency_key', validated.idempotencyKey)
            .maybeSingle();

          if (retryErr || !retryTxn) {
            return {
              success: false,
              error: isAr
                ? 'تم تسجيل معاملة مسبقاً بهذا المفتاح ولكن تعذر استرجاع بياناتها.'
                : 'A duplicate transaction was detected, but its details could not be retrieved.',
            };
          }

          type RawRetry = typeof retryTxn & {
            receipt?: { id: string; receipt_number: string }[];
            student?: {
              student_number: string;
              profile?: { full_name_ar: string; full_name_en: string };
            };
            student_due?: { original_amount: number; discount_amount: number; paid_amount: number };
          };
          const rawRetry = retryTxn as unknown as RawRetry;

          const retryValidation = validateIdempotencyReplay(rawRetry, validated);
          if (!retryValidation.isMatch) {
            return {
              success: false,
              error: isAr
                ? 'تعارض في مفتاح منع التكرار: تم استخدام هذا المفتاح مسبقاً مع بيانات سداد مختلفة أو لمعاملة غير مؤهلة.'
                : 'Idempotency conflict: The provided idempotency key was previously used with different parameters or for an ineligible transaction.',
            };
          }

          const receipt = rawRetry.receipt?.[0];
          const remBal = rawRetry.student_due
            ? Math.max(
                0,
                Number(rawRetry.student_due.original_amount) -
                  Number(rawRetry.student_due.discount_amount) -
                  Number(rawRetry.student_due.paid_amount)
              )
            : 0;

          return {
            success: true,
            data: {
              transactionId: rawRetry.id,
              receiptId: receipt?.id || '',
              transactionNumber: rawRetry.transaction_number,
              receiptNumber: receipt?.receipt_number || '',
              studentId: rawRetry.student_id,
              studentNameAr: rawRetry.student?.profile?.full_name_ar || '',
              studentNameEn: rawRetry.student?.profile?.full_name_en || '',
              studentNumber: rawRetry.student?.student_number || '',
              amount: Number(rawRetry.amount),
              paymentMethod: rawRetry.payment_method,
              paymentDate: rawRetry.payment_date,
              paymentTime: rawRetry.payment_time,
              newRemainingBalance: remBal,
              status: rawRetry.status,
              isDuplicate: true,
            },
          };
        }
        if (errorMsg.includes('DUE_NOT_FOUND')) {
          return {
            success: false,
            error: isAr
              ? 'لم يتم العثور على مستحق مالي لهذا الطالب في الفصل الدراسي المحدد'
              : 'No fee record found for student in the specified semester',
          };
        }
        if (errorMsg.includes('UNAUTHORIZED') || errorMsg.includes('FORBIDDEN')) {
          return {
            success: false,
            error: isAr
              ? 'ليس لديك صلاحية لتسجيل السداد بالخزينة'
              : 'Unauthorized to record payments in this treasury desk',
          };
        }

        console.error('[MANUAL_PAYMENT_DB_ERROR]', error);
        return {
          success: false,
          error: isAr
            ? 'حدث خطأ في قاعدة البيانات أثناء حفظ السداد. يرجى المحاولة مرة أخرى.'
            : 'A database error occurred while recording payment. Please try again.',
        };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          error: isAr ? 'فشلت معالجة السداد' : 'Payment processing failed',
        };
      }

      const row = data[0];

      // Fetch student info and new remaining balance for confirmation
      const { data: studentInfo } = await supabase
        .from('students')
        .select('student_number, profile:profiles(full_name_ar, full_name_en)')
        .eq('id', validated.studentId)
        .single();

      const { data: updatedDue } = await supabase
        .from('student_dues')
        .select('original_amount, discount_amount, paid_amount')
        .eq('student_id', validated.studentId)
        .eq('semester_id', validated.semesterId)
        .single();

      type RawStudentInfo = typeof studentInfo & {
        profile?: { full_name_ar: string; full_name_en: string };
      };
      const rawInfo = studentInfo as unknown as RawStudentInfo;
      const newRem = updatedDue
        ? Math.max(
            0,
            Number(updatedDue.original_amount) -
              Number(updatedDue.discount_amount) -
              Number(updatedDue.paid_amount)
          )
        : 0;

      // 4.3 Revalidate Next.js cache across views
      revalidatePath(`/${locale}/admin/payments`);
      revalidatePath(`/${locale}/admin/students`);
      revalidatePath(`/${locale}/admin/students/${validated.studentId}`);
      revalidatePath(`/${locale}/admin/dashboard`);
      revalidatePath(`/${locale}/student/dashboard`);
      revalidatePath(`/${locale}/student/fees`);
      revalidatePath(`/${locale}/student/transactions`);

      return {
        success: true,
        data: {
          transactionId: row.transaction_id,
          receiptId: row.receipt_id,
          transactionNumber: row.transaction_number,
          receiptNumber: row.receipt_number,
          studentId: validated.studentId,
          studentNameAr: rawInfo?.profile?.full_name_ar || '',
          studentNameEn: rawInfo?.profile?.full_name_en || '',
          studentNumber: rawInfo?.student_number || '',
          amount: validated.amount,
          paymentMethod: validated.paymentMethod,
          paymentDate: validated.paymentDate,
          paymentTime: validated.paymentTime,
          newRemainingBalance: newRem,
          status: 'COMPLETED',
          isDuplicate: false,
        },
      };
    } catch (err) {
      console.error('[MANUAL_PAYMENT_EXCEPTION]', err);
      return {
        success: false,
        error: isAr
          ? 'تعذر الاتصال بالخادم لحفظ السداد. يرجى إعادة المحاولة.'
          : 'Unable to reach server to commit payment. Please retry.',
      };
    }
  }

  // Mock dataset is permitted only when explicit development flag is active.
  if (!isDevMockEnabled()) {
    return {
      success: false,
      error: isAr
        ? 'تعذر الاتصال بقاعدة البيانات المالية. تم إيقاف عملية السداد.'
        : 'Financial database unavailable. Payment was blocked.',
    };
  }

  // =========================================================================
  // 6. NON-PRODUCTION MOCK LAYER (Strict Business & Security Logic)
  // =========================================================================

  // 6.1 Idempotency Check
  const existingMockTxn = MOCK_TRANSACTIONS.find(
    (t) => t.idempotency_key === validated.idempotencyKey
  );

  if (existingMockTxn) {
    const mockValidation = validateIdempotencyReplay(existingMockTxn, validated);
    if (!mockValidation.isMatch) {
      return {
        success: false,
        error: isAr
          ? 'تعارض في مفتاح منع التكرار: تم استخدام هذا المفتاح مسبقاً مع بيانات سداد مختلفة أو لمعاملة غير مؤهلة.'
          : 'Idempotency conflict: The provided idempotency key was previously used with different parameters or for an ineligible transaction.',
      };
    }

    const rcp = MOCK_RECEIPTS.find((r) => r.transaction_id === existingMockTxn.id);
    const stu = MOCK_STUDENTS.find((s) => s.id === existingMockTxn.student_id);
    const prof = MOCK_PROFILES.find((p) => p.id === existingMockTxn.student_id);
    const due = MOCK_STUDENT_DUES.find((d) => d.id === existingMockTxn.student_due_id);
    const rem = due
      ? Math.max(0, Number(due.original_amount) - Number(due.discount_amount) - Number(due.paid_amount))
      : 0;

    return {
      success: true,
      data: {
        transactionId: existingMockTxn.id,
        receiptId: rcp?.id || '',
        transactionNumber: existingMockTxn.transaction_number,
        receiptNumber: rcp?.receipt_number || '',
        studentId: existingMockTxn.student_id,
        studentNameAr: prof?.full_name_ar || '',
        studentNameEn: prof?.full_name_en || '',
        studentNumber: stu?.student_number || '',
        amount: Number(existingMockTxn.amount),
        paymentMethod: existingMockTxn.payment_method,
        paymentDate: existingMockTxn.payment_date,
        paymentTime: existingMockTxn.payment_time,
        newRemainingBalance: rem,
        status: existingMockTxn.status,
        isDuplicate: true,
      },
    };
  }

  // 5.2 Validate Due Existence & Ownership
  const targetDue = MOCK_STUDENT_DUES.find(
    (d) => d.student_id === validated.studentId && d.semester_id === validated.semesterId
  );

  if (!targetDue) {
    return {
      success: false,
      error: isAr
        ? 'لم يتم العثور على سجل مستحقات مالية لهذا الطالب في هذا الفصل'
        : 'No fee record found for student in the selected semester',
    };
  }

  // 5.3 Overpayment Check
  const currentNetDue = Number(targetDue.original_amount) - Number(targetDue.discount_amount);
  const currentRemaining = Math.max(0, currentNetDue - Number(targetDue.paid_amount));

  if (validated.amount > currentRemaining) {
    return {
      success: false,
      error: isAr
        ? `مبلغ السداد (${validated.amount} ج.م) يتجاوز الرصيد المتبقي المستحق (${currentRemaining} ج.م)`
        : `Payment amount (${validated.amount} EGP) exceeds remaining balance (${currentRemaining} EGP)`,
    };
  }

  // 5.4 Sequence Generation
  const now = new Date();
  const yearStr = now.getFullYear().toString();
  const nextTxnSeq = MOCK_TRANSACTIONS.length + 1;
  const nextRcpSeq = MOCK_RECEIPTS.length + 1;
  const txnNumber = `CUFE-TXN-${yearStr}-${String(nextTxnSeq).padStart(6, '0')}`;
  const rcpNumber = `CUFE-RCP-${yearStr}-${String(nextRcpSeq).padStart(6, '0')}`;
  const txnId = `mock-txn-${Date.now()}-${nextTxnSeq}`;
  const rcpId = `mock-rcp-${Date.now()}-${nextRcpSeq}`;

  // 5.5 Atomic Mutation: Update Due
  targetDue.paid_amount = Number(targetDue.paid_amount) + validated.amount;
  const newRemaining = Math.max(0, currentNetDue - Number(targetDue.paid_amount));
  targetDue.status = newRemaining === 0 ? 'PAID' : 'PARTIALLY_PAID';
  targetDue.updated_at = now.toISOString();

  // 5.6 Create Transaction
  const newTxn: Database['public']['Tables']['transactions']['Row'] = {
    id: txnId,
    transaction_number: txnNumber,
    student_id: validated.studentId,
    semester_id: validated.semesterId,
    student_due_id: targetDue.id,
    amount: validated.amount,
    currency: 'EGP',
    payment_method: validated.paymentMethod,
    payment_date: validated.paymentDate,
    payment_time: validated.paymentTime,
    recorded_at: now.toISOString(),
    reference_number: validated.referenceNumber,
    notes: validated.notes,
    status: 'COMPLETED',
    idempotency_key: validated.idempotencyKey,
    recorded_by: adminId,
    void_reason: null,
    voided_at: null,
    voided_by: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  MOCK_TRANSACTIONS.unshift(newTxn);

  // 5.7 Create Receipt
  const newRcp: Database['public']['Tables']['receipts']['Row'] = {
    id: rcpId,
    receipt_number: rcpNumber,
    transaction_id: txnId,
    student_id: validated.studentId,
    issued_at: now.toISOString(),
    total_amount: validated.amount,
    currency: 'EGP',
    verification_hash: verificationHash,
    metadata: {
      recorded_by: adminId,
      payment_method: validated.paymentMethod,
      payment_date: validated.paymentDate,
      reference_number: validated.referenceNumber,
      txn_number: txnNumber,
    },
    created_at: now.toISOString(),
  };
  MOCK_RECEIPTS.unshift(newRcp);

  // 5.8 Append Audit Log
  const newAudit: Database['public']['Tables']['audit_logs']['Row'] = {
    id: MOCK_AUDIT_LOGS.length + 1,
    actor_id: adminId,
    actor_role: adminContext.profile.role,
    action: 'PAYMENT_RECORDED',
    entity_name: 'transactions',
    entity_id: txnId,
    before_state: { previous_balance: currentRemaining },
    after_state: {
      amount: validated.amount,
      new_balance: newRemaining,
      txn_number: txnNumber,
      rcp_number: rcpNumber,
      student_id: validated.studentId,
    },
    ip_address: '127.0.0.1',
    user_agent: 'Next.js Server Action (Pre-Production Pilot)',
    created_at: now.toISOString(),
  };
  MOCK_AUDIT_LOGS.unshift(newAudit);

  // Student details for confirmation UI
  const stu = MOCK_STUDENTS.find((s) => s.id === validated.studentId);
  const prof = MOCK_PROFILES.find((p) => p.id === validated.studentId);

  // 5.9 Revalidate Next.js cache
  revalidatePath(`/${locale}/admin/payments`);
  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/students/${validated.studentId}`);
  revalidatePath(`/${locale}/admin/dashboard`);
  revalidatePath(`/${locale}/student/dashboard`);
  revalidatePath(`/${locale}/student/fees`);
  revalidatePath(`/${locale}/student/transactions`);

  return {
    success: true,
    data: {
      transactionId: txnId,
      receiptId: rcpId,
      transactionNumber: txnNumber,
      receiptNumber: rcpNumber,
      studentId: validated.studentId,
      studentNameAr: prof?.full_name_ar || '',
      studentNameEn: prof?.full_name_en || '',
      studentNumber: stu?.student_number || '',
      amount: validated.amount,
      paymentMethod: validated.paymentMethod,
      paymentDate: validated.paymentDate,
      paymentTime: validated.paymentTime,
      newRemainingBalance: newRemaining,
      status: 'COMPLETED',
      isDuplicate: false,
    },
  };
}

/**
 * Voids a completed financial payment transaction with atomic balance reversal and audit logging.
 * Strictly restricted to administrators possessing can_void_payments privileges.
 */
export async function voidTransactionAction(
  input: VoidTransactionInput,
  locale: Locale = 'ar'
): Promise<VoidActionResult> {
  const isAr = locale === 'ar';

  // 1. Authorization Guard: Require Admin with explicit can_void_payments privileges
  let adminContext;
  try {
    adminContext = await requireAdminWithVoidPermission(locale);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg.includes('FORBIDDEN')
        ? (isAr ? 'ليس لديك صلاحية لإلغاء المعاملات المالية (صلاحية المشرف المالي مطلوبة)' : 'Forbidden: Administrator lacks void permissions')
        : (isAr ? 'جلسة غير صالحة أو غير مصرح بها' : 'Unauthorized: Session invalid or expired'),
    };
  }

  // 2. Schema Validation
  const parseResult = voidTransactionSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: isAr ? 'بيانات طلب الإلغاء غير مكتملة أو غير صحيحة' : 'Invalid void request payload',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const { transactionId, voidReason } = parseResult.data;

  // 3. Mock financial void is permitted only when explicitly enabled in development.
  if (!isSupabaseConfigured() && !isDevMockEnabled()) {
    return {
      success: false,
      error: isAr
        ? 'إعدادات قاعدة البيانات غير مكتملة. تم إيقاف إلغاء المعاملة.'
        : 'Financial database configuration is incomplete. Transaction void was blocked.',
    };
  }

  // 4. Supabase Live Path
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();

      // Invoke atomic void stored procedure
      const { data, error } = await supabase.rpc('void_transaction_atomic', {
        p_transaction_id: transactionId,
        p_void_reason: voidReason,
        p_admin_id: adminContext.user.id,
      });

      if (error) {
        if (error.message.includes('ALREADY_VOIDED')) {
          return {
            success: false,
            error: isAr
              ? 'المعاملة ملغاة بالفعل مسبقاً ولا يمكن إلغاؤها مجدداً'
              : 'ALREADY_VOIDED: This transaction has already been voided',
          };
        }
        if (error.message.includes('TRANSACTION_NOT_FOUND')) {
          return {
            success: false,
            error: isAr
              ? 'المعاملة المالية غير موجودة'
              : 'TRANSACTION_NOT_FOUND: Transaction does not exist',
          };
        }
        if (error.message.includes('FORBIDDEN')) {
          return {
            success: false,
            error: isAr
              ? 'ليس لديك صلاحية لإلغاء المعاملات المالية'
              : 'FORBIDDEN: Administrator lacks void permissions',
          };
        }
        if (error.message.includes('INVALID_REASON')) {
          return {
            success: false,
            error: isAr
              ? 'يجب إدخال سبب تفصيلي للإلغاء لا يقل عن 10 أحرف'
              : 'INVALID_REASON: A detailed void reason of at least 10 characters is required',
          };
        }
        return {
          success: false,
          error: error.message || (isAr ? 'فشلت عملية إلغاء المعاملة' : 'Failed to void transaction'),
        };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          error: isAr ? 'لم يتم إرجاع بيانات نتيجة الإلغاء' : 'No result returned from void operation',
        };
      }

      const resultRow = data[0];
      const restoredBalance = Number(resultRow.restored_balance || 0);

      // Fetch student_id for targeted cache revalidation
      const { data: txnRow } = await supabase
        .from('transactions')
        .select('student_id')
        .eq('id', transactionId)
        .maybeSingle();

      const studentId = txnRow?.student_id;

      // Revalidate cache paths
      revalidatePath(`/${locale}/admin/payments`);
      revalidatePath(`/${locale}/admin/students`);
      if (studentId) {
        revalidatePath(`/${locale}/admin/students/${studentId}`);
      }
      revalidatePath(`/${locale}/admin/audit-logs`);
      revalidatePath(`/${locale}/admin/dashboard`);
      revalidatePath(`/${locale}/student/dashboard`);
      revalidatePath(`/${locale}/student/fees`);
      revalidatePath(`/${locale}/student/transactions`);
      revalidatePath(`/${locale}/student/transactions/${transactionId}`);

      return {
        success: true,
        data: {
          transactionId,
          restoredBalance,
          voidedAt: new Date().toISOString(),
          status: 'VOIDED',
        },
      };
    } catch (err: unknown) {
      console.error('[VOID_TRANSACTION_EXCEPTION]', err);
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: msg || (isAr ? 'حدث خطأ غير متوقع أثناء إلغاء المعاملة' : 'Unexpected error while voiding transaction'),
      };
    }
  }

  // Mock dataset fallback is permitted only when explicit development flag is active.
  if (!isDevMockEnabled()) {
    return {
      success: false,
      error: isAr
        ? 'قاعدة البيانات المالية غير متاحة. تم إيقاف إلغاء المعاملة.'
        : 'Financial database unavailable. Transaction void was blocked.',
    };
  }

  // 5. Non-production mock dataset fallback
  const txnIndex = MOCK_TRANSACTIONS.findIndex((t) => t.id === transactionId);
  if (txnIndex === -1) {
    return {
      success: false,
      error: isAr ? 'المعاملة غير موجودة' : 'Transaction not found in demo records',
    };
  }

  const txn = MOCK_TRANSACTIONS[txnIndex];
  if (txn.status === 'VOIDED') {
    return {
      success: false,
      error: isAr ? 'المعاملة ملغاة بالفعل مسبقاً' : 'ALREADY_VOIDED: Transaction is already voided',
    };
  }

  const now = new Date();
  const due = MOCK_STUDENT_DUES.find((d) => d.id === txn.student_due_id);
  let restoredBalance = 0;

  if (due) {
    due.paid_amount = Math.max(0, Number(due.paid_amount) - Number(txn.amount));
    due.status = due.paid_amount <= 0 ? 'UNPAID' : 'PARTIALLY_PAID';
    due.updated_at = now.toISOString();
    restoredBalance = Number(due.original_amount) - Number(due.discount_amount) - Number(due.paid_amount);
  }

  txn.status = 'VOIDED';
  txn.void_reason = voidReason;
  txn.voided_at = now.toISOString();
  txn.voided_by = adminContext.user.id;
  txn.updated_at = now.toISOString();

  // Audit log
  MOCK_AUDIT_LOGS.unshift({
    id: MOCK_AUDIT_LOGS.length + 1,
    actor_id: adminContext.user.id,
    actor_role: adminContext.profile.role,
    action: 'PAYMENT_VOIDED',
    entity_name: 'transactions',
    entity_id: transactionId,
    before_state: { status: 'COMPLETED', amount: txn.amount },
    after_state: { status: 'VOIDED', void_reason: voidReason, restored_balance: restoredBalance },
    ip_address: '127.0.0.1',
    user_agent: 'Next.js Server Action (Pre-Production Pilot)',
    created_at: now.toISOString(),
  });

  revalidatePath(`/${locale}/admin/payments`);
  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/students/${txn.student_id}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  revalidatePath(`/${locale}/admin/dashboard`);
  revalidatePath(`/${locale}/student/dashboard`);
  revalidatePath(`/${locale}/student/fees`);
  revalidatePath(`/${locale}/student/transactions`);
  revalidatePath(`/${locale}/student/transactions/${transactionId}`);

  return {
    success: true,
    data: {
      transactionId,
      restoredBalance,
      voidedAt: now.toISOString(),
      status: 'VOIDED',
    },
  };
}
