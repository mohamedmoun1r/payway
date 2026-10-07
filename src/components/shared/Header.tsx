'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { Landmark, Menu, X, User, Shield, LogOut } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { logoutAction } from '@/lib/actions/auth.actions';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export interface HeaderProps {
  locale: Locale;
  role?: 'student' | 'admin' | null;
  userName?: string;
  userEmail?: string;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Header({
  locale,
  role = null,
  userName,
  userEmail,
  onToggleMobileMenu,
  isMobileMenuOpen = false,
}: HeaderProps) {
  const dict = getDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction(locale);
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Institution Branding */}
          <div className="flex items-center gap-3">
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none cursor-pointer"
                aria-label="Toggle navigation"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <Link href={`/${locale}`} className="flex items-center gap-3 group">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white shadow-xs group-hover:bg-blue-800 transition-colors">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-start">
                <div className="text-xs font-semibold text-slate-500 leading-tight">
                  {dict.meta.universityName} — {dict.meta.facultyName}
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                  {dict.meta.portalName}
                </div>
              </div>
            </Link>
          </div>

          {/* Quick Context Switch & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Context Badge */}
            {role === 'student' && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <User className="w-3.5 h-3.5" />
                {dict.nav.roleStudent}
              </span>
            )}
            {role === 'admin' && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200">
                <Shield className="w-3.5 h-3.5" />
                {dict.nav.roleAdmin}
              </span>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher currentLocale={locale} />

            {/* Authenticated User Info & Logout vs Public Login Link */}
            {role ? (
              <div className="flex items-center gap-2 border-s border-slate-200 ps-2 sm:ps-3">
                {userName && (
                  <span
                    className="hidden lg:inline-block text-xs font-semibold text-slate-700 max-w-[150px] truncate"
                    title={userEmail ? `${userName} (${userEmail})` : userName}
                  >
                    {userName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  title={dict.common.actions.logout}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {isPending ? dict.common.loading.pleaseWait : dict.common.actions.logout}
                  </span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 border-s border-slate-200 ps-3">
                <Link
                  href={`/${locale}/login`}
                  className="text-xs font-semibold text-slate-600 hover:text-blue-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {dict.common.actions.login}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
