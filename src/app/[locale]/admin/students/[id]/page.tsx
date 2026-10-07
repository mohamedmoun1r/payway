import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminStudentProfile } from '@/lib/data/admin';
import { formatCurrency } from '@/lib/utils';
import { ManualPaymentModalShell } from '@/components/admin/ManualPaymentModalShell';
import { VoidTransactionButton } from '@/components/admin/VoidTransactionButton';

export default async function AdminStudentDetailPage({
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
  const adminContext = await requireAdmin(locale, `/${locale}/admin/students`);
  const canVoid = adminContext.profile.role === 'SUPER_ADMIN' || adminContext.admin.can_void_payments === true;

  // 2. Fetch Complete Student Financial Profile
  const profileData = await getAdminStudentProfile(id);

  if (!profileData) {
    return (
      <div className="py-12 space-y-4 max-w-lg mx-auto">
        <EmptyState
          title={isAr ? 'الطالب غير موجود' : 'Student Not Found'}
          description={
            isAr
              ? 'لم يتم العثور على سجل مالي لهذا المعرف في قاعدة بيانات الكلية.'
              : 'No financial profile found for this student ID in the registry.'
          }
        />
        <div className="text-center">
          <Link href={`/${locale}/admin/students`}>
            <Button variant="outline" icon={<BackIcon className="w-4 h-4" />}>
              {dict.admin.backToStudents}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { profile, student, totalDue, totalPaid, totalRemaining, overallStatus, dues, transactions } =
    profileData;

  const studentName = isAr ? profile.full_name_ar : profile.full_name_en;

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
    <div className="space-y-6">
      {/* 1. Back Navigation & Action Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link href={`/${locale}/admin/students`}>
          <Button variant="ghost" size="sm" icon={<BackIcon className="w-4 h-4" />}>
            {dict.admin.backToStudents}
          </Button>
        </Link>

        {/* Phase 5: Secure Manual Payment Action */}
        <div className="flex items-center gap-2">
          <ManualPaymentModalShell
            locale={locale}
            studentId={student.id}
            studentNumber={student.student_number}
            studentName={studentName}
            remainingBalance={totalRemaining}
          />
        </div>
      </div>

      {/* 2. Phase 5 Information Banner */}
      <Alert variant="info" title={isAr ? 'نظام التحصيل المالي المعتمد بالخزينة (Phase 5)' : 'Authorized Treasury Payment Workflow (Phase 5)'}>
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-blue-800" />
          <span>
            {isAr
              ? 'تسجيل السداد اليدوي مفعل لمسؤولي الخزينة مع تحديث فوري للأرصدة وفقاً لإجراءات الحوكمة المالية.'
              : 'Manual payment workflow is active for authorized treasury cashiers with atomic balance updates and audit trail.'}
          </span>
        </div>
      </Alert>

      {/* 3. Student Identification Bar */}
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
                {dict.student.email}: <strong className="text-slate-800">{profile.email}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Financial KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {dict.admin.totalDue}
            </span>
            <CardTitle className="text-2xl font-black text-slate-900 pt-1">
              {formatCurrency(totalDue, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr ? 'إجمالي المقررات والتخفيضات' : 'Total net assessed fees'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {dict.admin.totalCollected}
            </span>
            <CardTitle className="text-2xl font-black text-emerald-700 pt-1">
              {formatCurrency(totalPaid, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-emerald-600 font-medium">
              {isAr ? 'سداد مثبت بقسائم الخزينة' : 'Confirmed treasury payments'}
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
              {dict.admin.totalOutstanding}
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
                  ? 'مستحق للمتابعة بالخزينة'
                  : 'Pending collection'
                : isAr
                ? 'الحساب مسدد بالكامل'
                : 'Account fully settled'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 5. Semester Dues Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>{dict.admin.duesLedger}</CardTitle>
          <CardDescription>
            {isAr
              ? 'كشف الاستحقاقات والتخفيضات المعتمدة لكل فصل دراسي'
              : 'Semester assessment ledger with applied scholarships and net balance'}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* 6. Payment History Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>{dict.admin.paymentHistory}</CardTitle>
          <CardDescription>
            {isAr
              ? 'سجل المعاملات النقدية والمصرفية المسجلة لهذا الطالب'
              : 'Recorded payment transactions and receipt logs for this student'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <EmptyState
              title={dict.common.empty.noTransactionsFound}
              description={
                isAr
                  ? 'لا توجد حركات سداد مسجلة لهذا الطالب حتى الآن.'
                  : 'No payment transactions recorded for this student yet.'
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
                    <TableHead>{dict.student.method}</TableHead>
                    <TableHead>{dict.student.amount}</TableHead>
                    <TableHead>{dict.student.date}</TableHead>
                    <TableHead>{dict.student.referenceNumber}</TableHead>
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
                        <TableCell className="text-xs">
                          {getMethodBadge(txn.payment_method)}
                        </TableCell>
                        <TableCell className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                          {formatCurrency(Number(txn.amount), dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {txn.payment_date} {txn.payment_time}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-700">
                          {txn.reference_number || '-'}
                        </TableCell>
                        <TableCell>
                          {txn.status === 'COMPLETED' ? (
                            <Badge variant="success">{dict.common.status.completed}</Badge>
                          ) : (
                            <Badge variant="destructive">{dict.common.status.voided}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          {canVoid && txn.status === 'COMPLETED' ? (
                            <VoidTransactionButton
                              transaction={{
                                id: txn.id,
                                transactionNumber: txn.transaction_number,
                                receiptNumber: txn.receipt_number,
                                amount: Number(txn.amount),
                                paymentDate: txn.payment_date,
                                paymentMethod: txn.payment_method,
                                studentName: studentName,
                                studentNumber: student.student_number,
                                semesterName: semName,
                              }}
                              locale={locale}
                              canVoid={canVoid}
                            />
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
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
