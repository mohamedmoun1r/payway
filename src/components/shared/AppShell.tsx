'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DemoBanner } from './DemoBanner';
import { Header } from './Header';
import { StudentNav, AdminNav } from './Navigation';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export interface AppShellProps {
  locale: Locale;
  role?: 'student' | 'admin' | null;
  userName?: string;
  userEmail?: string;
  children: React.ReactNode;
}

export function AppShell({
  locale,
  role = null,
  userName,
  userEmail,
  children,
}: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dict = getDictionary(locale);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-900 antialiased">
      {/* 1. Mandatory Demo Banner at the Very Top */}
      <DemoBanner locale={locale} />

      {/* 2. Main University Header with User Profile & Logout */}
      <Header
        locale={locale}
        role={role}
        userName={userName}
        userEmail={userEmail}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* 3. Sub-navigation Bar for Roles */}
      {role && (
        <div className="border-b border-slate-200/80 bg-white shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {role === 'student' && <StudentNav locale={locale} />}
            {role === 'admin' && <AdminNav locale={locale} />}
          </div>
        </div>
      )}

      {/* 4. Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* 5. Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            © {new Date().getFullYear()} {dict.meta.universityName} — {dict.meta.facultyName} | {dict.meta.portalName}
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
              {dict.pilotBanner.badge}
            </span>
            <Link href={`/${locale}/login`} className="hover:text-slate-700 transition-colors">
              {dict.common.actions.login}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
