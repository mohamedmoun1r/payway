import React from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminPayments } from '@/lib/data/admin';
import { formatCurrency } from '@/lib/utils';
import { ManualPaymentModalShell } from '@/components/admin/ManualPaymentModalShell';
import { VoidTransactionButton } from '@/components/admin/VoidTransactionButton';

export default async function AdminPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; method?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { q, status = 'ALL', method = 'ALL' } = await searchParams;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  const adminContext = await requireAdmin(locale, `/${locale}/admin/payments`);
  const canVoid = adminContext.profile.role === 'SUPER_ADMIN' || adminContext.admin.can_void_payments === true;

  // 2. Fetch Filtered Payments from DAL
  const transactions = await getAdminPayments({
    query: q,
    status,
    method,
  });

  const getMethodBadge = (m: string) => {
    switch (m) {
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

  const exportUrl = `/api/admin/export/payments?status=${encodeURIComponent(status)}&method=${encodeURIComponent(method)}`;

  return (
    <div className="space-y-6">
      {/* 1. Header with Record Payment Modal Shell */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{dict.admin.paymentsTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">{dict.admin.paymentsSubtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a href={exportUrl} download>
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              {dict.admin.exportPaymentsCsv}
            </Button>
          </a>
          <ManualPaymentModalShell locale={locale} />
        </div>
      </div>

      {/* 2. Search & Filters Bar */}
      <Card className="p-4 sm:p-5">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input
              name="q"
              defaultValue={q || ''}
              placeholder={
                isAr
                  ? 'ابحث برقم المعاملة، رقم الإيصال، اسم الطالب أو رقم القيد...'
                  : 'Search by Txn #, Receipt #, Student Name, or Student ID...'
              }
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div>
            <select
              name="status"
              defaultValue={status}
              className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="ALL">{dict.admin.allStatuses}</option>
              <option value="COMPLETED">{dict.common.status.completed}</option>
              <option value="VOIDED">{dict.common.status.voided}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              name="method"
              defaultValue={method}
              className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="ALL">{dict.admin.allMethods}</option>
              <option value="CASH">{dict.common.methods.cash}</option>
              <option value="POS">{dict.common.methods.pos}</option>
              <option value="BANK_TRANSFER">{dict.common.methods.bankTransfer}</option>
            </select>

            <Button type="submit" size="sm" className="h-[38px]">
              {dict.admin.searchQuery}
            </Button>

            {(q || status !== 'ALL' || method !== 'ALL') && (
              <Link href={`/${locale}/admin/payments`}>
                <Button variant="outline" type="button" size="sm" className="h-[38px]" icon={<X className="w-3.5 h-3.5" />}>
                  {dict.admin.clearFilter}
                </Button>
              </Link>
            )}
          </div>
        </form>
      </Card>

      {/* 3. Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{dict.admin.paymentsTitle}</CardTitle>
              <CardDescription>
                {isAr
                  ? `النتائج المعروضة: ${transactions.length} حركة مالية`
                  : `Showing ${transactions.length} payment records`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <EmptyState
              title={dict.common.empty.noTransactionsFound}
              description={
                isAr
                  ? 'لم يتم العثور على أي معاملات تطابق معايير التصفية والبحث.'
                  : 'No payment records match the specified filters.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.student.transactionNumber}</TableHead>
                    <TableHead>{dict.student.receiptNumber}</TableHead>
                    <TableHead>{dict.admin.studentName}</TableHead>
                    <TableHead>{dict.student.semester}</TableHead>
                    <TableHead>{dict.student.method}</TableHead>
                    <TableHead>{dict.student.amount}</TableHead>
                    <TableHead>{dict.student.date}</TableHead>
                    <TableHead>{dict.admin.filterByStatus}</TableHead>
                    <TableHead className="text-end">{dict.admin.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => {
                    const studentName = isAr ? txn.student_name_ar : txn.student_name_en;
                    const semName = isAr ? txn.semester_name_ar : txn.semester_name_en;

                    return (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono font-bold text-blue-900 text-xs">
                          {txn.transaction_number}
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-slate-700 text-xs">
                          {txn.receipt_number || (
                            <span className="text-slate-400 italic">
                              {dict.student.receiptPending}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 text-xs">{studentName}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {txn.student_number}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {semName || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getMethodBadge(txn.payment_method)}
                        </TableCell>
                        <TableCell className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                          {formatCurrency(Number(txn.amount), dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          <div>{txn.payment_date}</div>
                          <div className="text-[11px] text-slate-400">{txn.payment_time}</div>
                        </TableCell>
                        <TableCell>
                          {txn.status === 'COMPLETED' ? (
                            <Badge variant="success">{dict.common.status.completed}</Badge>
                          ) : (
                            <Badge variant="destructive">{dict.common.status.voided}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-2">
                            {canVoid && txn.status === 'COMPLETED' && (
                              <VoidTransactionButton
                                transaction={{
                                  id: txn.id,
                                  transactionNumber: txn.transaction_number,
                                  receiptNumber: txn.receipt_number,
                                  amount: Number(txn.amount),
                                  paymentDate: txn.payment_date,
                                  paymentMethod: txn.payment_method,
                                  studentName,
                                  studentNumber: txn.student_number,
                                  semesterName: semName,
                                }}
                                locale={locale}
                                canVoid={canVoid}
                              />
                            )}
                            <Link href={`/${locale}/admin/students/${txn.student_id}`}>
                              <Button variant="outline" size="sm" className="text-xs">
                                {dict.admin.viewLedger}
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
