import React from 'react';
import Link from 'next/link';
import {
  Receipt,
  FileText,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireStudent } from '@/lib/auth/guards';
import { getStudentDashboardData } from '@/lib/data/student';
import { formatCurrency } from '@/lib/utils';

export default async function StudentDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  // 1. Strict Server Authorization Guard
  const context = await requireStudent(locale, `/${locale}/student/dashboard`);

  // 2. Fetch Isolated Financial Data for Authenticated Student
  const data = await getStudentDashboardData(context.user.id);

  if (!data) {
    return (
      <div className="py-12">
        <EmptyState
          title={dict.common.error.somethingWentWrong}
          description={dict.common.error.tryAgain}
        />
      </div>
    );
  }

  const {
    profile,
    student,
    currentSemester,
    totalDue,
    totalPaid,
    totalRemaining,
    overallStatus,
    recentTransactions,
  } = data;

  const studentName = isAr ? profile.full_name_ar : profile.full_name_en;
  const semesterName = isAr ? currentSemester?.name_ar : currentSemester?.name_en;

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
      {/* 1. Student Identity & Academic Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-900 text-white font-extrabold text-lg shadow-sm">
            {studentName.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{studentName}</h1>
              {getStatusBadge(overallStatus)}
              {profile.is_demo && (
                <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                  DEMO DATA
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              <span>
                {dict.student.academicNumber}:{' '}
                <strong className="text-slate-800 font-mono">{student.student_number}</strong>
              </span>
              <span>•</span>
              <span>
                {dict.student.department}:{' '}
                <strong className="text-slate-800">{student.academic_department}</strong>
              </span>
              <span>•</span>
              <span>
                {dict.student.program}:{' '}
                <strong className="text-slate-800">{student.academic_program}</strong>
              </span>
              <span>•</span>
              <span>
                {dict.student.level}:{' '}
                <strong className="text-slate-800">{student.academic_level}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/${locale}/student/profile`}>
            <Button variant="outline" size="sm" icon={<UserCheck className="w-4 h-4" />}>
              {dict.nav.studentProfile}
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Key Financial Indicators (Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {dict.student.currentSemesterDue}
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-slate-900 pt-1">
              {formatCurrency(totalDue, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs">{semesterName || '-'}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {dict.student.totalPaid}
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-emerald-700 pt-1">
              {formatCurrency(totalPaid, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-emerald-600 font-medium">
              {isAr ? 'سداد مثبت بقسائم الخزينة' : 'Confirmed official treasury payments'}
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
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold uppercase ${
                  totalRemaining > 0 ? 'text-amber-800' : 'text-emerald-800'
                }`}
              >
                {dict.student.remainingBalance}
              </span>
              <div
                className={`p-2 rounded-xl ${
                  totalRemaining > 0
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
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
                  : 'Due for manual payment at treasury'
                : isAr
                ? 'تم سداد كامل المستحقات'
                : 'All dues fully settled'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 3. Quick Action Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href={`/${locale}/student/fees`} className="group">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-900 hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-900 group-hover:bg-blue-900 group-hover:text-white transition-colors">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{dict.student.viewFees}</h3>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? 'استعراض تفاصيل المصروفات والتخفيضات'
                    : 'View full semester fee assessment breakdown'}
                </p>
              </div>
            </div>
            <ArrowIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-900 transition-colors" />
          </div>
        </Link>

        <Link href={`/${locale}/student/transactions`} className="group">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-900 hover:shadow-xs transition-all">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{dict.student.viewReceipts}</h3>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? 'سجل المعاملات وتفاصيل الإيصالات الرسمية'
                    : 'Official transactions ledger and receipt records'}
                </p>
              </div>
            </div>
            <ArrowIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-900 transition-colors" />
          </div>
        </Link>
      </div>

      {/* 4. Recent Transactions Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{dict.student.recentTransactions}</CardTitle>
              <CardDescription>{dict.student.transactionsPageSubtitle}</CardDescription>
            </div>
            <Link href={`/${locale}/student/transactions`}>
              <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                {dict.common.actions.view}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <EmptyState
              title={dict.student.noRecentTransactions}
              description={
                isAr
                  ? 'لم يتم تسجيل أي عمليات سداد بحسابك حتى الآن.'
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
                    <TableHead>{dict.student.date}</TableHead>
                    <TableHead>{dict.student.method}</TableHead>
                    <TableHead>{dict.student.amount}</TableHead>
                    <TableHead>{dict.admin.filterByStatus}</TableHead>
                    <TableHead className="text-end">{dict.admin.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((txn) => (
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
                      <TableCell className="text-xs whitespace-nowrap">
                        {txn.payment_date}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
