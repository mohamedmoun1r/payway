'use client';

import React from 'react';
import {
  Banknote,
  CreditCard,
  Building2,
  FileSpreadsheet,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { formatCurrency } from '@/lib/utils';
import type { TreasuryClosingMetrics } from '@/lib/data/reports';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

interface TreasuryClosingCardProps {
  metrics: TreasuryClosingMetrics;
  locale: Locale;
  selectedDate?: string;
}

export function TreasuryClosingCard({
  metrics,
  locale,
  selectedDate,
}: TreasuryClosingCardProps) {
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  const exportUrl = `/api/admin/export/reconciliation${selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : ''}`;

  return (
    <div className="space-y-6">
      {/* 1. Header with Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">{dict.admin.closingTitle}</h2>
          <p className="text-xs text-slate-500 mt-1">{dict.admin.closingSubtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => window.print()}
            className="print:hidden"
          >
            {dict.admin.printSummary}
          </Button>

          <a href={exportUrl} download className="print:hidden">
            <Button
              size="sm"
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {dict.admin.exportClosingCsv}
            </Button>
          </a>
        </div>
      </div>

      {/* 2. Executive Reconciled Position Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gross Completed */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {dict.admin.grossCompleted}
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-blue-900 pt-1">
              {formatCurrency(metrics.grossCompletedAmount, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr
                ? `${metrics.completedCount} حركة مكتملة ومعتمدة`
                : `${metrics.completedCount} completed transactions`}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Void Adjustments */}
        <Card className="border-rose-200 bg-rose-50/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800 uppercase">
                {dict.admin.voidedAdjustments}
              </span>
              <div className="p-2 rounded-xl bg-rose-100 text-rose-800">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-rose-700 pt-1">
              {formatCurrency(metrics.voidedAdjustmentsAmount, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-rose-600 font-medium">
              {isAr
                ? `${metrics.voidedCount} حركة ملغاة (تم استرداد أرصدتها)`
                : `${metrics.voidedCount} voided reversals (restored)`}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Net Reconciled Position */}
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase">
                {dict.admin.netPosition}
              </span>
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-900">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-emerald-800 pt-1">
              {formatCurrency(metrics.netReconciledAmount, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-emerald-700">
              {isAr ? 'الرصيد الفعلي المحصل بالخزينة' : 'Actual net collections retained'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 3. Payment Method Segregation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{dict.admin.filterByMethod}</CardTitle>
          <CardDescription className="text-xs">
            {isAr
              ? 'توزيع المبالغ المعتمدة حسب القنوات المصرفية والنقدية'
              : 'Breakdown of completed collections across cash and banking channels'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Cash Drawer */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">{dict.admin.cashDrawer}</div>
                <div className="text-lg font-black text-slate-900">
                  {formatCurrency(metrics.methodBreakdown.cashAmount, dict.common.currency)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {metrics.methodBreakdown.cashCount} {isAr ? 'إيصالات نقداً' : 'cash slips'}
                </div>
              </div>
            </div>

            {/* POS Card Slips */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-800 shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">{dict.admin.posSlips}</div>
                <div className="text-lg font-black text-slate-900">
                  {formatCurrency(metrics.methodBreakdown.posAmount, dict.common.currency)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {metrics.methodBreakdown.posCount} {isAr ? 'تسويات ماكينة POS' : 'POS slips'}
                </div>
              </div>
            </div>

            {/* Bank Deposit Vouchers */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-800 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">{dict.admin.bankVouchers}</div>
                <div className="text-lg font-black text-slate-900">
                  {formatCurrency(metrics.methodBreakdown.bankTransferAmount, dict.common.currency)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {metrics.methodBreakdown.bankTransferCount} {isAr ? 'إيداعات بنكية' : 'bank vouchers'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Cashier Station Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-900" />
            <CardTitle className="text-base">{dict.admin.cashierDeskBreakdown}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {metrics.cashierBreakdown.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              {isAr ? 'لا توجد حركات مسجلة بالفترة المحددة' : 'No records in selected period'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.admin.employeeId}</TableHead>
                    <TableHead>{dict.admin.cashierName}</TableHead>
                    <TableHead>{dict.admin.completedTxns}</TableHead>
                    <TableHead>{dict.admin.cashDrawer}</TableHead>
                    <TableHead>{dict.admin.posSlips}</TableHead>
                    <TableHead>{dict.admin.bankVouchers}</TableHead>
                    <TableHead>{dict.admin.grossCompleted}</TableHead>
                    <TableHead>{dict.admin.voidedTxns}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.cashierBreakdown.map((c) => (
                    <TableRow key={c.cashierId}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">
                        {c.employeeId}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900">
                        {isAr ? c.cashierNameAr : c.cashierNameEn}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-700">
                        {c.completedCount}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 whitespace-nowrap">
                        {formatCurrency(c.cashAmount, dict.common.currency)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 whitespace-nowrap">
                        {formatCurrency(c.posAmount, dict.common.currency)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 whitespace-nowrap">
                        {formatCurrency(c.bankTransferAmount, dict.common.currency)}
                      </TableCell>
                      <TableCell className="font-extrabold text-blue-900 text-xs whitespace-nowrap">
                        {formatCurrency(c.completedAmount, dict.common.currency)}
                      </TableCell>
                      <TableCell>
                        {c.voidedCount > 0 ? (
                          <Badge variant="destructive">
                            {c.voidedCount} ({formatCurrency(c.voidedAmount, dict.common.currency)})
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Void Adjustments & Cancellations Audit Section */}
      {metrics.voidedTransactions.length > 0 && (
        <Card className="border-rose-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-700" />
              <CardTitle className="text-base text-rose-900">{dict.admin.reconciliationAudit}</CardTitle>
            </div>
            <CardDescription className="text-xs text-rose-700">
              {isAr
                ? 'توثيق العمليات الملغاة وأسباب التراجع لضمان سلامة التدقيق والمطابقة المحاسبية'
                : 'Documentation of reversed transactions and justifications for accounting audit compliance'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.student.transactionNumber}</TableHead>
                    <TableHead>{dict.admin.studentNumber}</TableHead>
                    <TableHead>{dict.admin.studentName}</TableHead>
                    <TableHead>{dict.student.amount}</TableHead>
                    <TableHead>{dict.student.date}</TableHead>
                    <TableHead>{dict.student.voidReason}</TableHead>
                    <TableHead>{dict.student.voidedAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.voidedTransactions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono font-bold text-rose-700 text-xs">
                        {v.transactionNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-700 font-semibold">
                        {v.studentNumber}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-900">
                        {isAr ? v.studentNameAr : v.studentNameEn}
                      </TableCell>
                      <TableCell className="font-extrabold text-rose-700 text-xs whitespace-nowrap">
                        {formatCurrency(v.amount, dict.common.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {v.paymentDate}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-xs truncate" title={v.voidReason || ''}>
                        {v.voidReason || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                        {v.voidedAt ? new Date(v.voidedAt).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
