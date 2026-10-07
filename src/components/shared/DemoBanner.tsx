import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';

export function DemoBanner({ locale = 'ar' }: { locale?: Locale }) {
  const isAr = locale === 'ar';

  return (
    <div
      role="region"
      aria-label="Pre-production Environment Notice"
      className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 text-xs md:text-sm font-bold shadow-xs border-b border-amber-600/30 flex items-center justify-center text-center gap-2 select-none"
    >
      <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0 animate-pulse" />
      <span>
        {isAr
          ? '⚠️ بيئة تجريبية قبل الإنتاج — بيانات تجريبية فقط — لا توجد معاملات حقيقية'
          : '⚠️ PRE-PRODUCTION PILOT ENVIRONMENT — DEMO DATA ONLY — NO REAL TRANSACTIONS'}
      </span>
      <span className="hidden sm:inline-block bg-slate-950/15 text-slate-950 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider">
        CUFE-PILOT-v0.1
      </span>
    </div>
  );
}
