import React from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { requireStudent } from '@/lib/auth/guards';

export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // Server-side authorization guard: fails closed for unauthenticated or non-student users
  const studentContext = await requireStudent(locale, `/${locale}/student/dashboard`);
  const userName =
    locale === 'ar'
      ? studentContext.profile.full_name_ar
      : studentContext.profile.full_name_en;

  return (
    <AppShell
      locale={locale}
      role="student"
      userName={userName}
      userEmail={studentContext.profile.email}
    >
      {children}
    </AppShell>
  );
}
