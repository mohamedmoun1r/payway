import React from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { requireAdmin } from '@/lib/auth/guards';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // Server-side authorization guard: fails closed for unauthenticated or non-admin users
  const adminContext = await requireAdmin(locale, `/${locale}/admin/dashboard`);
  const userName =
    locale === 'ar'
      ? adminContext.profile.full_name_ar
      : adminContext.profile.full_name_en;

  return (
    <AppShell
      locale={locale}
      role="admin"
      userName={userName}
      userEmail={adminContext.profile.email}
    >
      {children}
    </AppShell>
  );
}
