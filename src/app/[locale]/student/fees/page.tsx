import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireStudent } from '@/lib/auth/guards';
import { getStudentFeesData } from '@/lib/data/student';
import { formatCurrency } from '@/lib/utils';

export default async function StudentFeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  const context = await requireStudent(locale, `/${locale}/student/fees`);

  // 2. Fetch Isolated Fees Data
  const feesData = await getStudentFeesData(context.user.id);

  if (!feesData) {
    return (
      <div className="py-12">
        <EmptyState
          title={dict.common.error.somethingWentWrong}
          description={dict.common.error.tryAgain}
        />
      </div>
    );
  }

  const { dues, totalDue, totalPaid, totalRemaining } = feesData;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">{dict.common.status.paid}</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning">{dict.common.status.partiallyPaid}</Badge>;
      default:
        return <Badge variant="destructive">{dict.common.status.unpaid}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">{dict.student.feesPageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.student.feesPageSubtitle}</p>
      </div>

      {/* 2. Institutional Pilot Notice */}
      <Alert variant="info" title={isAr ? 'تعليمات السداد المالي' : 'Financial Payment Notice'}>
        {isAr
          ? 'المصروفات الدراسية تُسدد حصراً لدى خزينة كلية الهندسة (المبنى الرئيسي). الدفع الإلكتروني عبر البوابات الخارجية معطل خلال المرحلة التجريبية.'
          : 'Tuition and laboratory fees are payable exclusively at the Faculty of Engineering Treasury (Main Building). Online payment gateways are disabled in this pilot.'}
      </Alert>

      {/* 3. Aggregate Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {dict.student.currentSemesterDue}
            </span>
            <CardTitle className="text-2xl font-black text-slate-900 pt-1">
              {formatCurrency(totalDue, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr ? 'إجمالي المقررات والتخفيضات' : 'Cumulative assessed semester dues'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {dict.student.totalPaid}
            </span>
            <CardTitle className="text-2xl font-black text-emerald-700 pt-1">
              {formatCurrency(totalPaid, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-emerald-600 font-medium">
              {isAr ? 'إجمالي المبالغ المسددة' : 'Total payments received by treasury'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className={
            totalRemaining > 0
              ? 'border-amber-200/90 bg-amber-50/30'
              : 'border-emerald-200/90 bg-emerald-50/30'
          }
        >
          <CardHeader className="pb-2">
            <span
              className={`text-xs font-bold uppercase ${
                totalRemaining > 0 ? 'text-amber-800' : 'text-emerald-800'
              }`}
            >
              {dict.student.remainingBalance}
            </span>
            <CardTitle
              className={`text-2xl font-black pt-1 ${
                totalRemaining > 0 ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              {formatCurrency(totalRemaining, dict.common.currency)}
            </CardTitle>
            <CardDescription
              className={`text-xs ${
                totalRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {totalRemaining > 0
                ? isAr
                  ? 'مستحق السداد بالخزينة'
                  : 'Pending collection'
                : isAr
                ? 'تم سداد كامل الالتزامات'
                : 'All obligations fulfilled'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 4. Dues Ledger Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{dict.admin.duesLedger}</CardTitle>
          <CardDescription>
            {isAr
              ? 'بيان بالمصروفات المقررة لكل فصل دراسي مع توضيح أي منح أو تخفيضات معتمدة'
              : 'Detailed breakdown of assessed fees per academic semester with applicable scholarships'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dues.length === 0 ? (
            <EmptyState
              title={dict.common.empty.noDataFound}
              description={
                isAr
                  ? 'لم يتم إدراج استحقاقات مالية في سجلك الأكاديمي حتى الآن.'
                  : 'No semester fee assessments registered on this account.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.student.semester}</TableHead>
                    <TableHead>{dict.student.dueAmount}</TableHead>
                    <TableHead>{dict.student.discount}</TableHead>
                    <TableHead>{dict.student.netDue}</TableHead>
                    <TableHead>{dict.student.paid}</TableHead>
                    <TableHead>{dict.student.balance}</TableHead>
                    <TableHead>{dict.student.dueDate}</TableHead>
                    <TableHead>{dict.admin.filterByStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dues.map((due) => {
                    const netDue = Number(due.original_amount) - Number(due.discount_amount);
                    const remaining = Math.max(0, netDue - Number(due.paid_amount));
                    const semName = isAr ? due.semester?.name_ar : due.semester?.name_en;

                    return (
                      <TableRow key={due.id}>
                        <TableCell>
                          <div className="font-bold text-slate-900 text-sm">{semName}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {due.semester?.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700">
                          {formatCurrency(Number(due.original_amount), dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-emerald-700">
                          {Number(due.discount_amount) > 0 ? (
                            `-${formatCurrency(Number(due.discount_amount), dict.common.currency)}`
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-bold text-blue-900">
                          {formatCurrency(netDue, dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-sm font-bold text-emerald-700">
                          {formatCurrency(Number(due.paid_amount), dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-sm font-black">
                          <span className={remaining > 0 ? 'text-amber-700' : 'text-slate-500'}>
                            {formatCurrency(remaining, dict.common.currency)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {due.due_date || '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(due.status)}</TableCell>
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
