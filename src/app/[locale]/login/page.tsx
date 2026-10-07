import React from 'react';
import { Landmark } from 'lucide-react';
import { AppShell } from '@/components/shared/AppShell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { LoginForm } from '@/components/auth/LoginForm';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const { redirectTo, error } = await searchParams;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  return (
    <AppShell locale={locale}>
      <div className="max-w-md mx-auto py-8">
        <Card className="border-slate-200/90 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-900 text-white mb-3 shadow-sm">
              <Landmark className="h-7 w-7" />
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {dict.meta.universityName} — {dict.meta.facultyName}
            </div>
            <CardTitle className="text-xl pt-1 text-slate-900">{dict.auth.loginTitle}</CardTitle>
            <CardDescription>{dict.auth.loginSubtitle}</CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <LoginForm
              locale={locale}
              redirectTo={redirectTo}
              initialError={error}
            />
          </CardContent>

          <CardFooter className="justify-center text-xs text-slate-400">
            {dict.meta.portalSubtitle}
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  );
}
