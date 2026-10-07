'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  const toggleLanguage = () => {
    const nextLocale: Locale = currentLocale === 'ar' ? 'en' : 'ar';
    // Replace current locale segment in pathname
    const segments = pathname.split('/');
    if (segments.length > 1 && (segments[1] === 'ar' || segments[1] === 'en')) {
      segments[1] = nextLocale;
      router.push(segments.join('/'));
    } else {
      router.push(`/${nextLocale}${pathname}`);
    }
  };

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
      title={currentLocale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
      aria-label="Switch Language"
    >
      <Globe className="w-3.5 h-3.5 text-slate-500" />
      <span>{currentLocale === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}
