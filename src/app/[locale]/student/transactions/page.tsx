import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireStudent } from '@/lib/auth/guards';
import { getStudentTransactions } from '@/lib/data/student';
import { formatCurrency } from '@/lib/utils';

export default async function StudentTransactionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  const context = await requireStudent(locale, `/${locale}/student/transactions`);

  // 2. Fetch Isolated Transactions for Authenticated Student
  const transactions = await getStudentTransactions(context.user.id);

  const getMethodBadge = (method: string) => {
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
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">
          {dict.student.transactionsPageTitle}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {dict.student.transactionsPageSubtitle}
        </p>
      </div>

      {/* 2. Transactions Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{dict.student.transactionsPageTitle}</CardTitle>
              <CardDescription>
                {isAr
                  ? `إجمالي المعاملات المسجلة: ${transactions.length}`
                  : `Total recorded transactions: ${transactions.length}`}
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
                  ? 'لم يتم تسجيل أي عمليات سداد نقدية أو بنكية في حسابك حتى الآن.'
                  : 'No payment transactions recorded for this account yet.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.student.transactionNumber}</TableHead>
                    <TableHead>{dict.student.receiptNumber}</TableHead>
                    <TableHead>{dict.student.semester}</TableHead>
                    <TableHead>{dict.student.date}</TableHead>
                    <TableHead>{dict.student.method}</TableHead>
                    <TableHead>{dict.student.amount}</TableHead>
                    <TableHead>{dict.admin.filterByStatus}</TableHead>
                    <TableHead className="text-end">{dict.admin.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => {
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
                        <TableCell className="text-xs text-slate-600">
                          {semName || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                          <div>{txn.payment_date}</div>
                          <div className="text-[11px] text-slate-400">{txn.payment_time}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {getMethodBadge(txn.payment_method)}
                        </TableCell>
                        <TableCell className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                          {formatCurrency(Number(txn.amount), dict.common.currency)}
                        </TableCell>
                        <TableCell>
                          {txn.status === 'COMPLETED' ? (
                            <Badge variant="success">{dict.common.status.completed}</Badge>
                          ) : (
                            <Badge variant="destructive">{dict.common.status.voided}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <Link href={`/${locale}/student/transactions/${txn.id}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              {dict.common.actions.details}
                            </Button>
                          </Link>
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
