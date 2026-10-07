import React from 'react';
import Link from 'next/link';
import {
  Banknote,
  Users,
  Receipt,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminDashboardMetrics } from '@/lib/data/admin';
import { formatCurrency } from '@/lib/utils';

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  await requireAdmin(locale, `/${locale}/admin/dashboard`);

  // 2. Fetch Admin Dashboard Metrics from DAL
  const metrics = await getAdminDashboardMetrics();

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
    <div className="space-y-8">
      {/* 1. Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900">{dict.admin.dashboardTitle}</h1>
            <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
              PILOT METRICS
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{dict.admin.dashboardSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/${locale}/admin/students`}>
            <Button icon={<Users className="w-4 h-4" />}>
              {dict.admin.studentsTitle}
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Pilot KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Students */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {dict.admin.allStudents}
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-slate-900 pt-1">
              {metrics.totalStudents}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr ? 'إجمالي المقيدين (تجريبي)' : 'Enrolled students (demo)'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Total Dues Assessed */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {dict.admin.totalDue}
              </span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-900">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-blue-900 pt-1">
              {formatCurrency(metrics.totalDue, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr ? 'المقررات الدراسية الصافية' : 'Net assessed obligations'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Total Collected */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {dict.admin.totalCollected}
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-emerald-700 pt-1">
              {formatCurrency(metrics.totalCollected, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-emerald-600 font-medium">
              {isAr ? 'المحصل بالخزينة' : 'Collected via treasury'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Remaining Outstanding */}
        <Card className="border-amber-200/80 bg-amber-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase">
                {dict.admin.totalOutstanding}
              </span>
              <div className="p-2 rounded-xl bg-amber-100 text-amber-900">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-amber-900 pt-1">
              {formatCurrency(metrics.totalOutstanding, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-amber-700">
              {isAr ? 'مستحق قيد التحصيل' : 'Pending collection'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Ratio: Outstanding vs Fully Paid */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {dict.admin.fullyPaidStudents}
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-emerald-700 pt-1">
              {metrics.studentsFullyPaid}{' '}
              <span className="text-xs font-normal text-slate-500">
                / {metrics.totalStudents}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {isAr
                ? `${metrics.studentsWithBalance} طلاب عليهم متبقي`
                : `${metrics.studentsWithBalance} with balance`}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 3. Quick Navigation Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href={`/${locale}/admin/students`} className="group">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-900 hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-900 group-hover:bg-blue-900 group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{dict.admin.studentsTitle}</h3>
                <p className="text-xs text-slate-500">
                  {isAr ? 'البحث في كشوفات الطلاب واستعراض الحسابات' : 'Search and inspect student ledgers'}
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-900 transition-colors" />
          </div>
        </Link>

        <Link href={`/${locale}/admin/payments`} className="group">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-900 hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{dict.admin.paymentsTitle}</h3>
                <p className="text-xs text-slate-500">
                  {isAr ? 'سجل الحركات وإيصالات الخزينة' : 'Payment registry and transaction logs'}
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-900 transition-colors" />
          </div>
        </Link>

        <Link href={`/${locale}/admin/audit-logs`} className="group">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-900 hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-900 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{dict.admin.auditTitle}</h3>
                <p className="text-xs text-slate-500">
                  {isAr ? 'سجل العمليات والرقابة المالية' : 'Audit logs and compliance trail'}
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-900 transition-colors" />
          </div>
        </Link>
      </div>

      {/* 4. Recent Treasury Operations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{dict.admin.recentTransactions}</CardTitle>
              <CardDescription>{dict.admin.paymentsSubtitle}</CardDescription>
            </div>
            <Link href={`/${locale}/admin/payments`}>
              <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                {dict.common.actions.view}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {metrics.recentTransactions.length === 0 ? (
            <EmptyState
              title={dict.common.empty.noTransactionsFound}
              description={
                isAr
                  ? 'لم يتم تسجيل أي عمليات بالخزينة حتى الآن.'
                  : 'No treasury operations recorded yet.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.student.transactionNumber}</TableHead>
                    <TableHead>{dict.admin.studentNumber}</TableHead>
                    <TableHead>{dict.admin.studentName}</TableHead>
                    <TableHead>{dict.student.method}</TableHead>
                    <TableHead>{dict.student.amount}</TableHead>
                    <TableHead>{dict.student.date}</TableHead>
                    <TableHead>{dict.admin.filterByStatus}</TableHead>
                    <TableHead className="text-end">{dict.admin.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.recentTransactions.map((txn) => {
                    const studentName = isAr ? txn.student_name_ar : txn.student_name_en;

                    return (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono font-bold text-blue-900 text-xs">
                          {txn.transaction_number}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-slate-700">
                          {txn.student_number}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 text-xs">
                          {studentName}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getMethodBadge(txn.payment_method)}
                        </TableCell>
                        <TableCell className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                          {formatCurrency(Number(txn.amount), dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {txn.payment_date} {txn.payment_time}
                        </TableCell>
                        <TableCell>
                          {txn.status === 'COMPLETED' ? (
                            <Badge variant="success">{dict.common.status.completed}</Badge>
                          ) : (
                            <Badge variant="destructive">{dict.common.status.voided}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <Link href={`/${locale}/admin/students/${txn.student_id}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              {dict.admin.viewLedger}
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
