'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { voidTransactionAction } from '@/lib/actions/payment.actions';
import type { Locale } from '@/lib/i18n/config';

export interface VoidableTransaction {
  id: string;
  transactionNumber: string;
  receiptNumber?: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  studentName: string;
  studentNumber: string;
  semesterName?: string;
}

interface VoidTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: VoidableTransaction;
  locale?: Locale;
  onSuccess?: (restoredBalance: number) => void;
}

export function VoidTransactionModal({
  isOpen,
  onClose,
  transaction,
  locale = 'ar',
  onSuccess,
}: VoidTransactionModalProps) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ restoredBalance: number } | null>(null);

  if (!isOpen) return null;

  const isAr = locale === 'ar';
  const reasonLength = reason.trim().length;
  const isReasonValid = reasonLength >= 10;
  const canSubmit = isReasonValid && confirmed && !loading;

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await voidTransactionAction(
        {
          transactionId: transaction.id,
          voidReason: reason.trim(),
          confirmed: true,
        },
        locale
      );

      if (!res.success) {
        setErrorMessage(res.error || (isAr ? 'فشلت عملية الإلغاء' : 'Failed to void transaction'));
        return;
      }

      const restored = res.data?.restoredBalance ?? 0;
      setSuccessInfo({ restoredBalance: restored });

      if (onSuccess) {
        onSuccess(restored);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || (isAr ? 'حدث خطأ غير متوقع' : 'Unexpected error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 z-10 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAr ? 'إلغاء المعاملة المالية (Void)' : 'Void Financial Transaction'}
              </h3>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                {transaction.transactionNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {successInfo ? (
          <div className="py-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {isAr ? 'تم إلغاء المعاملة المالية بنجاح' : 'Transaction Successfully Voided'}
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                {isAr
                  ? `تم عكس المبلغ وإعادة الرصيد المستحق بذمة الطالب إلى: ${successInfo.restoredBalance.toLocaleString()} جنيه مصري`
                  : `Amount reversed. Outstanding student balance restored to: ${successInfo.restoredBalance.toLocaleString()} EGP`}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                {isAr ? 'إغلاق ومتابعة' : 'Close & Continue'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVoidSubmit} className="py-4 space-y-4 text-sm">
            {/* Transaction Summary Card */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{isAr ? 'الطالب:' : 'Student:'}</span>
                <span className="font-semibold text-slate-900">
                  {transaction.studentName} ({transaction.studentNumber})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{isAr ? 'المبلغ المسدد:' : 'Payment Amount:'}</span>
                <span className="font-bold text-base text-red-700">
                  {Number(transaction.amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  EGP
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{isAr ? 'تاريخ وطريقة السداد:' : 'Date & Method:'}</span>
                <span className="text-slate-700">
                  {transaction.paymentDate} • {transaction.paymentMethod}
                </span>
              </div>
              {transaction.receiptNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{isAr ? 'رقم الإيصال المرتبط:' : 'Linked Receipt:'}</span>
                  <span className="font-mono text-slate-700">{transaction.receiptNumber}</span>
                </div>
              )}
            </div>

            {/* Structured Irreversibility Warning */}
            <div className="bg-red-50/80 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 space-y-1.5 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                {isAr
                  ? '⚠️ تنبيه مالي هام — إجراء إلغاء المعاملة:'
                  : '⚠️ Important Financial Notice — Transaction Voiding:'}
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-red-800/90 pr-1">
                {isAr ? (
                  <>
                    <li>
                      <strong>إلغاء دائم:</strong> سيتم تصنيف هذه المعاملة بشكل نهائي كمعاملة ملغاة (VOIDED) من واجهة النظام العادية ولا يمكن إعادة تفعيلها.
                    </li>
                    <li>
                      <strong>حفظ التاريخ المالي:</strong> لن يتم حذف المعاملة من قاعدة البيانات، بل ستبقى محفوظة بسجل الحركات وسجل التدقيق لأغراض الحوكمة والرقابة المالية.
                    </li>
                    <li>
                      <strong>حفظ الإيصال الأصلي:</strong> يظل الإيصال المالي مرتبطاً بالمعاملة في النظام مع عكس حالته تلقائياً إلى &quot;ملغى&quot; في صفحة التحقق الإلكتروني وشهادة السداد.
                    </li>
                    <li>
                      <strong>استعادة الرصيد المستحق:</strong> سيتم خصم هذا المبلغ من إجمالي المسدد وإعادته بالكامل إلى الرصيد المستحق بذمة الطالب فور تأكيد الإلغاء.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>Permanent Status:</strong> This transaction will be permanently marked as VOIDED from the standard UI and cannot be re-activated.
                    </li>
                    <li>
                      <strong>Preserved Financial History:</strong> The transaction is not deleted; complete ledger records and immutable audit logs are permanently preserved.
                    </li>
                    <li>
                      <strong>Preserved Receipt Record:</strong> The original receipt remains linked to this transaction, with its public verification status dynamically updated to &quot;VOIDED&quot;.
                    </li>
                    <li>
                      <strong>Balance Reversal:</strong> The payment amount will be reversed and immediately restored to the student&apos;s outstanding balance upon confirmation.
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-100/80 border border-red-300 rounded-lg text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Mandatory Void Reason Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="void-reason-input" className="font-bold text-slate-700">
                  {isAr ? 'سبب الإلغاء التفصيلي (إلزامي):' : 'Detailed Void Reason (Required):'}
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    isReasonValid ? 'text-slate-500' : 'text-red-600 font-bold'
                  }`}
                >
                  {reasonLength} / 500 {isAr ? '(الحد الأدنى 10 أحرف)' : '(Min 10 chars)'}
                </span>
              </div>
              <textarea
                id="void-reason-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isAr
                    ? 'أدخل سبب إلغاء المعاملة بدقة (مثال: خطأ في إدخال قيمة القسيمة الورقية بالخزينة)...'
                    : 'Provide the specific justification for this void (e.g., duplicated cashier slip entry)...'
                }
                disabled={loading}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition"
              />
            </div>

            {/* Confirmation Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="font-medium">
                  {isAr
                    ? 'أؤكد مسؤوليتي بصفتي مشرفاً مالياً عن إلغاء هذه المعاملة واستعادة المبلغ لذمة الطالب.'
                    : 'I confirm my financial authority to void this transaction and restore the student due balance.'}
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg transition shadow-sm ${
                  canSubmit
                    ? 'bg-red-600 hover:bg-red-700 cursor-pointer'
                    : 'bg-red-300 cursor-not-allowed opacity-60'
                }`}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {loading
                    ? isAr
                      ? 'جاري الإلغاء...'
                      : 'Voiding...'
                    : isAr
                    ? 'تأكيد إلغاء المعاملة'
                    : 'Confirm Void Transaction'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
