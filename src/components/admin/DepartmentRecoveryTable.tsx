'use client';

import React from 'react';
import {
  GraduationCap,
  Receipt,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { formatCurrency } from '@/lib/utils';
import type { AcademicAnalyticsSummary } from '@/lib/data/reports';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

interface DepartmentRecoveryTableProps {
  analytics: AcademicAnalyticsSummary;
  locale: Locale;
}

export function DepartmentRecoveryTable({ analytics, locale }: DepartmentRecoveryTableProps) {
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  return (
    <div className="space-y-6">
      {/* 1. Header & Semester Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-900" />
            <h2 className="text-xl font-black text-slate-900">
              {dict.admin.departmentRecoveryTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {dict.admin.departmentRecoverySubtitle} —{' '}
            <span className="font-semibold text-slate-700">
              {isAr ? analytics.semesterNameAr : analytics.semesterNameEn} ({analytics.semesterCode})
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="info" className="text-xs py-1 px-3">
            {isAr ? 'معدل التحصيل العام: ' : 'Overall Recovery: '}
            <span className="font-extrabold mx-1">{analytics.overallCollectionRate}%</span>
          </Badge>
        </div>
      </div>

      {/* 2. Analytical KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {dict.admin.assessedDues}
            </span>
            <CardTitle className="text-xl font-black text-slate-900 pt-1">
              {formatCurrency(analytics.totalNetDue, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr ? `إجمالي الطلاب: ${analytics.totalStudents}` : `Total students: ${analytics.totalStudents}`}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {dict.admin.collectedAmount}
            </span>
            <CardTitle className="text-xl font-black text-emerald-700 pt-1">
              {formatCurrency(analytics.totalCollected, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-emerald-600 font-medium">
              {analytics.overallCollectionRate}% {isAr ? 'تم تحصيله' : 'recovered'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {dict.admin.remainingAmount}
            </span>
            <CardTitle className="text-xl font-black text-amber-700 pt-1">
              {formatCurrency(analytics.totalOutstanding, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-amber-600">
              {isAr ? 'مستحق قيد السداد' : 'pending balance'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {isAr ? 'التخفيضات والمنح' : 'Scholarships / Aid'}
            </span>
            <CardTitle className="text-xl font-black text-indigo-700 pt-1">
              {formatCurrency(analytics.totalDiscount, dict.common.currency)}
            </CardTitle>
            <CardDescription className="text-xs text-indigo-600">
              {isAr ? 'دعم وتخفيضات معتمدة' : 'approved discounts'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* 3. Department Breakdown Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-700" />
            <CardTitle className="text-base">{dict.admin.departmentRecoveryTitle}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {analytics.departmentMetrics.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              {isAr ? 'لا توجد بيانات مقررات للفصل المحدد' : 'No records found for selected semester'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.admin.department}</TableHead>
                    <TableHead className="text-center">{dict.admin.studentsCount}</TableHead>
                    <TableHead>{dict.admin.assessedDues}</TableHead>
                    <TableHead>{dict.admin.collectedAmount}</TableHead>
                    <TableHead>{dict.admin.remainingAmount}</TableHead>
                    <TableHead>{dict.admin.recoveryRate}</TableHead>
                    <TableHead className="text-end">{dict.admin.filterByStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.departmentMetrics.map((dept) => {
                    const rate = dept.collectionRate;
                    const badgeVariant =
                      rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'destructive';

                    return (
                      <TableRow key={dept.department}>
                        <TableCell className="font-bold text-slate-900 text-xs">
                          {dept.department}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-xs text-slate-700">
                          {dept.studentCount}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-700 whitespace-nowrap">
                          {formatCurrency(dept.netDueAmount, dict.common.currency)}
                        </TableCell>
                        <TableCell className="font-extrabold text-xs text-emerald-700 whitespace-nowrap">
                          {formatCurrency(dept.paidAmount, dict.common.currency)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-amber-700 whitespace-nowrap">
                          {formatCurrency(dept.remainingBalance, dict.common.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={badgeVariant} className="text-xs">
                              {rate}%
                            </Badge>
                            <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden hidden sm:block">
                              <div
                                className={`h-full ${rate >= 80 ? 'bg-emerald-600' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1.5 text-[11px]">
                            <span className="text-emerald-700 font-semibold" title={isAr ? 'مسدد بالكامل' : 'Paid'}>
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-0.5" />
                              {dept.statusBreakdown.paid}
                            </span>
                            <span className="text-amber-700 font-semibold mx-1" title={isAr ? 'مسدد جزئياً' : 'Partially paid'}>
                              <AlertCircle className="w-3.5 h-3.5 inline mr-0.5" />
                              {dept.statusBreakdown.partiallyPaid}
                            </span>
                            <span className="text-rose-700 font-semibold" title={isAr ? 'غير مسدد' : 'Unpaid'}>
                              {dept.statusBreakdown.unpaid}
                            </span>
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
