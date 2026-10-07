import React from 'react';
import Link from 'next/link';
import {
  Receipt,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  Building2,
  Tag,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireStudent } from '@/lib/auth/guards';
import { getStudentTransactionById } from '@/lib/data/student';
import { formatCurrency } from '@/lib/utils';

export default async function StudentTransactionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  // 1. Strict Server Authorization Guard
  const context = await requireStudent(locale, `/${locale}/student/transactions`);

  // 2. Fetch Isolated Transaction (strictly enforcing student ownership)
  const txn = await getStudentTransactionById(context.user.id, id);

  if (!txn) {
    return (
      <div className="py-12 space-y-4 max-w-lg mx-auto">
        <EmptyState
          title={isAr ? 'المعاملة غير موجودة' : 'Transaction Not Found'}
          description={
            isAr
              ? 'لم يتم العثور على المعاملة المطلوبة، أو ليس لديك صلاحية للوصول إليها.'
              : 'The requested transaction was not found or you lack permission to access it.'
          }
        />
        <div className="text-center">
          <Link href={`/${locale}/student/transactions`}>
            <Button variant="outline" icon={<BackIcon className="w-4 h-4" />}>
              {dict.student.backToTransactions}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const semName = isAr ? txn.semester_name_ar : txn.semester_name_en;

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH':
        return dict.common.methods.cash;
      case 'POS':
        return dict.common.methods.pos;
      case 'BANK_TRANSFER':
        return dict.common.methods.bankTransfer;
      default:
        return dict.common.methods.other;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 1. Back Navigation */}
      <div>
        <Link href={`/${locale}/student/transactions`}>
          <Button variant="ghost" size="sm" icon={<BackIcon className="w-4 h-4" />}>
            {dict.student.backToTransactions}
          </Button>
        </Link>
      </div>

      {/* 2. Transaction Overview Card */}
      <Card className="border-slate-200/90 shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              {dict.student.transactionNumber}
            </div>
            <div className="text-2xl font-black font-mono tracking-tight mt-1">
              {txn.transaction_number}
            </div>
            <div className="text-xs text-slate-300 mt-1">{semName || '-'}</div>
          </div>

          <div className="text-start sm:text-end">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              {dict.student.amount}
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-1">
              {formatCurrency(Number(txn.amount), dict.common.currency)}
            </div>
            <div className="mt-2">
              {txn.status === 'COMPLETED' ? (
                <Badge variant="success">{dict.common.status.completed}</Badge>
              ) : (
                <Badge variant="destructive">{dict.common.status.voided}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* 3. Void Notice Alert if Voided */}
        {txn.status === 'VOIDED' && (
          <div className="p-6 bg-red-50/70 border-b border-red-200">
            <Alert variant="destructive" title={dict.student.voidReason}>
              <div className="space-y-1 text-xs">
                <p>{txn.void_reason || 'Reversed by finance supervisor'}</p>
                {txn.voided_at && (
                  <p className="text-red-700 font-mono">
                    {dict.student.voidedAt}: {new Date(txn.voided_at).toLocaleString()}
                  </p>
                )}
              </div>
            </Alert>
          </div>
        )}

        {/* 4. Structured Details Grid */}
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-900" />
                {dict.student.receiptNumber}
              </span>
              <p className="text-base font-bold font-mono text-slate-900">
                {txn.receipt_number || (
                  <span className="text-slate-400 font-normal italic text-sm">
                    {dict.student.receiptPending}
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-900" />
                {dict.student.method}
              </span>
              <p className="text-base font-bold text-slate-900">
                {getMethodLabel(txn.payment_method)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-900" />
                {dict.student.date}
              </span>
              <p className="text-base font-bold text-slate-900">{txn.payment_date}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-900" />
                {dict.student.time}
              </span>
              <p className="text-base font-bold text-slate-900 font-mono">{txn.payment_time}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-900" />
                {dict.student.referenceNumber}
              </span>
              <p className="text-base font-mono font-bold text-slate-900">
                {txn.reference_number || '-'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-900" />
                {dict.student.semester}
              </span>
              <p className="text-base font-bold text-slate-900">{semName || '-'}</p>
            </div>
          </div>

          {/* Notes */}
          {txn.notes && (
            <div className="pt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-400">{dict.student.notes}</span>
              <p className="text-sm text-slate-700 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {txn.notes}
              </p>
            </div>
          )}

          {/* Pilot PDF Notice */}
          <div className="pt-4 border-t border-slate-100 bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-xs text-blue-900">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-blue-800" />
              {isAr ? 'الإيصال معتمد ومسجل بالخزينة' : 'Receipt Authenticated at Treasury'}
            </div>
            <p className="text-slate-600 leading-relaxed">
              {isAr
                ? 'إمكانية تحميل ملف الإيصال بصيغة PDF والتحقق عبر رمز الاستجابة السريعة QR ستتاح في المرحلة القادمة (Phase 6).'
                : 'PDF receipt streaming and QR verification features will be activated in Phase 6.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
