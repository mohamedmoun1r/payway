import React from 'react';
import Link from 'next/link';
import { Calendar, X, FileSpreadsheet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireAdmin } from '@/lib/auth/guards';
import {
  getTreasuryClosingMetrics,
  getDepartmentRecoveryMetrics,
} from '@/lib/data/reports';
import { TreasuryClosingCard } from '@/components/admin/TreasuryClosingCard';
import { DepartmentRecoveryTable } from '@/components/admin/DepartmentRecoveryTable';

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; semesterId?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { date, semesterId } = await searchParams;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  await requireAdmin(locale, `/${locale}/admin/reports`);

  // 2. Fetch Reconciled Financial Data from DAL
  const closingMetrics = await getTreasuryClosingMetrics({
    date,
    semesterId,
  });

  const departmentAnalytics = await getDepartmentRecoveryMetrics(semesterId);

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900">{dict.admin.reportsTitle}</h1>
            <span className="text-[11px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-0.5 rounded-full">
              RECONCILIATION & AUDIT
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{dict.admin.reportsSubtitle}</p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Link href={`/${locale}/admin/payments`}>
            <Button variant="outline" size="sm">
              {dict.admin.paymentsTitle}
            </Button>
          </Link>
          <a href="/api/admin/export/payments" download>
            <Button variant="outline" size="sm" icon={<FileSpreadsheet className="w-3.5 h-3.5" />}>
              {dict.admin.exportPaymentsCsv}
            </Button>
          </a>
        </div>
      </div>

      {/* 2. Date Filtering Bar */}
      <Card className="p-4 sm:p-5 print:hidden">
        <form method="GET" className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              {dict.admin.filterByDate}:
            </span>
            <input
              type="date"
              name="date"
              defaultValue={date || ''}
              className="text-xs rounded-xl border border-slate-200 bg-white p-2 text-slate-700 h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button type="submit" size="sm" className="h-[38px]">
              {dict.admin.searchQuery}
            </Button>

            {date && (
              <Link href={`/${locale}/admin/reports`}>
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  className="h-[38px]"
                  icon={<X className="w-3.5 h-3.5" />}
                >
                  {dict.admin.clearFilter}
                </Button>
              </Link>
            )}
          </div>

          <div className="text-xs text-slate-400 ms-auto">
            {date
              ? `${isAr ? 'عرض إقفال تاريخ: ' : 'Showing closing for: '} ${date}`
              : isAr
                ? 'عرض إجمالي جميع الحركات المسجلة'
                : 'Showing all recorded treasury operations'}
          </div>
        </form>
      </Card>

      {/* 3. Section 1: Treasury Daily Closing & Cashier Reconciliation */}
      <TreasuryClosingCard
        metrics={closingMetrics}
        locale={locale}
        selectedDate={date}
      />

      {/* 4. Section 2: Academic Department Recovery Analytics */}
      <DepartmentRecoveryTable
        analytics={departmentAnalytics}
        locale={locale}
      />
    </div>
  );
}
