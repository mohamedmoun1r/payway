import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '../globals.css';
import { LOCALES, type Locale, getDirection, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';

const cairo = localFont({
  src: [
    {
      path: '../../../public/fonts/Cairo-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../public/fonts/Cairo-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'البوابة المالية للطلاب | جامعة القاهرة - كلية الهندسة',
  description: 'نظام إدارة المصروفات والإيصالات المالية لشؤون الطلاب بكلية الهندسة جامعة القاهرة',
};

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir} className={cairo.variable}>
      <body className="font-sans min-h-screen bg-slate-50/70 text-slate-900 antialiased selection:bg-blue-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}
