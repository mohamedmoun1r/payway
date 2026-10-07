import React from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireAdmin } from '@/lib/auth/guards';
import { searchStudents } from '@/lib/data/admin';
import { formatCurrency } from '@/lib/utils';

export default async function AdminStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { q } = await searchParams;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  await requireAdmin(locale, `/${locale}/admin/students`);

  // 2. Query Student Directory
  const students = await searchStudents(q);

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
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">{dict.admin.studentsTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{dict.admin.studentsSubtitle}</p>
      </div>

      {/* 2. Interactive Search Form */}
      <Card className="p-4 sm:p-5">
        <form method="GET" className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Input
              name="q"
              defaultValue={q || ''}
              placeholder={dict.admin.searchPlaceholder}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button type="submit" className="w-full sm:w-auto">
              {dict.admin.searchQuery}
            </Button>
            {q && (
              <Link href={`/${locale}/admin/students`}>
                <Button variant="outline" type="button" icon={<X className="w-4 h-4" />}>
                  {dict.admin.clearFilter}
                </Button>
              </Link>
            )}
          </div>
        </form>
      </Card>

      {/* 3. Students Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{dict.admin.studentsTitle}</CardTitle>
              <CardDescription>
                {isAr
                  ? `النتائج المعروضة: ${students.length} طالب`
                  : `Showing ${students.length} students`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <EmptyState
              title={dict.common.empty.noStudentsFound}
              description={
                isAr
                  ? 'لم يتم العثور على أي طالب يطابق استعلام البحث المدخل.'
                  : 'No student matches your search criteria.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.admin.studentNumber}</TableHead>
                    <TableHead>{dict.admin.studentName}</TableHead>
                    <TableHead>{dict.student.department}</TableHead>
                    <TableHead>{dict.student.currentSemesterDue}</TableHead>
                    <TableHead>{dict.student.totalPaid}</TableHead>
                    <TableHead>{dict.student.remainingBalance}</TableHead>
                    <TableHead>{dict.admin.filterByStatus}</TableHead>
                    <TableHead className="text-end">{dict.admin.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
                    const studentName = isAr ? s.nameAr : s.nameEn;

                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-bold text-blue-900 text-xs">
                          {s.studentNumber}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900 text-sm">{studentName}</div>
                          <div className="text-xs text-slate-400 font-mono">{s.email}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          <div>{s.department}</div>
                          <div className="text-[11px] text-slate-400">
                            {dict.student.level} {s.level}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {formatCurrency(s.currentSemesterDue, dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(s.currentSemesterPaid, dict.common.currency)}
                        </TableCell>
                        <TableCell className="text-sm font-black whitespace-nowrap">
                          <span
                            className={
                              s.outstandingBalance > 0 ? 'text-amber-700' : 'text-slate-500'
                            }
                          >
                            {formatCurrency(s.outstandingBalance, dict.common.currency)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(s.status)}</TableCell>
                        <TableCell className="text-end">
                          <Link href={`/${locale}/admin/students/${s.id}`}>
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
