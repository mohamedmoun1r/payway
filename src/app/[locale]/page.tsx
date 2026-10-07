import React from 'react';
import Link from 'next/link';
import { Landmark, ArrowRight, ArrowLeft, User, Shield, CheckCircle2, Clock, FileCheck } from 'lucide-react';
import { AppShell } from '@/components/shared/AppShell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <AppShell locale={locale}>
      <div className="space-y-10 py-4">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 text-white p-8 sm:p-12 shadow-xl border border-blue-800/40">
          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
              <Landmark className="w-3.5 h-3.5" />
              <span>{dict.meta.universityName} — {dict.meta.facultyName}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              {dict.meta.portalName}
            </h1>

            <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">
              {isAr
                ? 'النظام الرقمي الموحد لإدارة ومتابعة المصروفات الدراسية، تسجيل التحصيلات اليدوية بخزينة الكلية، واستخراج الإيصالات الرسمية الفورية لطلاب كلية الهندسة.'
                : 'The unified digital portal for managing and reviewing academic fees, recording treasury cash payments, and generating immediate verifiable receipts for engineering students.'}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={`/${locale}/login`}>
                <Button size="lg" className="bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold border-0 shadow-lg" icon={<ArrowIcon className="w-4 h-4" />}>
                  {dict.auth.submitLogin}
                </Button>
              </Link>
              <Link href={`/${locale}/student/dashboard`}>
                <Button variant="outline" size="lg" className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                  {dict.nav.roleStudent}
                </Button>
              </Link>
              <Link href={`/${locale}/admin/dashboard`}>
                <Button variant="outline" size="lg" className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                  {dict.nav.roleAdmin}
                </Button>
              </Link>
            </div>
          </div>

          {/* Decorative background geometry */}
          <div className="absolute end-0 top-0 -me-20 -mt-20 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 end-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
        </div>

        {/* Portal Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Student Portal Card */}
          <Card className="hover:shadow-md transition-all border-slate-200/90">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <User className="h-6 w-6" />
                </div>
                <Badge variant="success">{dict.nav.roleStudent}</Badge>
              </div>
              <CardTitle className="pt-3">{dict.nav.studentDashboard}</CardTitle>
              <CardDescription>
                {isAr
                  ? 'متابعة المصروفات الدراسية المقررة للفصل الدراسي، الرصيد المتبقي، وسجل المعاملات مع إمكانية طباعة الإيصالات المعتمدة.'
                  : 'Inspect current semester fees, monitor outstanding balance, and download verified official payment receipts.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{isAr ? 'عرض فوري للمصروفات والمبالغ المسددة والمتبقية' : 'Instant view of assessed fees and remaining balance'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{isAr ? 'تحميل إيصالات السداد الرسمية بصيغة PDF مع رمز التحقق' : 'Download official PDF receipts with verification QR'}</span>
                </div>
                <div className="pt-3">
                  <Link href={`/${locale}/student/dashboard`}>
                    <Button variant="secondary" className="w-full justify-between" icon={<ArrowIcon className="w-4 h-4" />}>
                      <span>{isAr ? 'الدخول إلى بوابة الطالب' : 'Open Student Portal'}</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin / Treasury Portal Card */}
          <Card className="hover:shadow-md transition-all border-slate-200/90">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                  <Shield className="h-6 w-6" />
                </div>
                <Badge variant="info">{dict.nav.roleAdmin}</Badge>
              </div>
              <CardTitle className="pt-3">{dict.nav.adminDashboard}</CardTitle>
              <CardDescription>
                {isAr
                  ? 'البحث عن بيانات الطلاب برقم القيد، استعراض كشف الحساب المالي، وتسجيل مدفوعات الخزينة (نقداً / بنكي / POS).'
                  : 'Lookup students by number or name, review ledger balances, and record manual payments (Cash, Transfer, POS).'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{isAr ? 'تسجيل السداد اليدوي مع توليد رقم الإيصال وحساب الرصيد آلياً' : 'Atomic payment recording with auto balance calculation'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{isAr ? 'سجل تدقيق كامل للعمليات مع إمكانية الإلغاء المنضبط للمعاملات الخاطئة' : 'Audited transaction logging and controlled voiding'}</span>
                </div>
                <div className="pt-3">
                  <Link href={`/${locale}/admin/dashboard`}>
                    <Button variant="secondary" className="w-full justify-between" icon={<ArrowIcon className="w-4 h-4" />}>
                      <span>{isAr ? 'الدخول إلى لوحة الخزينة' : 'Open Treasury Console'}</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pilot Information Card */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="warning">{dict.pilotBanner.badge}</Badge>
              <h4 className="text-sm font-bold text-amber-950">
                {isAr ? 'حالة النظام: مرحلة تجريبية قبل الإنتاج' : 'System Status: Pre-Production Pilot'}
              </h4>
            </div>
            <p className="text-xs text-amber-900/80 leading-relaxed max-w-2xl">
              {isAr
                ? 'الدفع الإلكتروني معطل حالياً في هذه المرحلة التجريبية. يتم تسجيل كافة المدفوعات يدوياً من خلال مسؤولي الخزينة بكلية الهندسة. جميع البيانات المعروضة حالياً هي بيانات تجريبية (Demo Data).'
                : 'Online payment gateways are disabled in this pilot version. All payments are recorded manually by treasury administrators. All records currently displayed are demo data.'}
            </p>
          </div>
          <Link href={`/${locale}/login`}>
            <Button size="sm" variant="outline" className="bg-white border-amber-300 text-amber-950 hover:bg-amber-100 shrink-0">
              {dict.auth.submitLogin}
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
