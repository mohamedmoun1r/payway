'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  UserCheck,
  BarChart3,
  Users,
  Banknote,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export function StudentNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const dict = getDictionary(locale);

  const items = [
    {
      href: `/${locale}/student/dashboard`,
      label: dict.nav.studentDashboard,
      icon: LayoutDashboard,
    },
    {
      href: `/${locale}/student/fees`,
      label: dict.nav.studentFees,
      icon: Receipt,
    },
    {
      href: `/${locale}/student/transactions`,
      label: dict.nav.studentTransactions,
      icon: FileText,
    },
    {
      href: `/${locale}/student/profile`,
      label: dict.nav.studentProfile,
      icon: UserCheck,
    },
  ];

  return (
    <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 no-scrollbar">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap',
              isActive
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const dict = getDictionary(locale);

  const items = [
    {
      href: `/${locale}/admin/dashboard`,
      label: dict.nav.adminDashboard,
      icon: BarChart3,
    },
    {
      href: `/${locale}/admin/students`,
      label: dict.nav.adminStudents,
      icon: Users,
    },
    {
      href: `/${locale}/admin/payments`,
      label: dict.nav.adminPayments,
      icon: Banknote,
    },
    {
      href: `/${locale}/admin/reports`,
      label: dict.nav.adminReports,
      icon: FileSpreadsheet,
    },
    {
      href: `/${locale}/admin/audit-logs`,
      label: dict.nav.adminAuditLogs,
      icon: ShieldAlert,
    },
  ];

  return (
    <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 no-scrollbar">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap',
              isActive
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
