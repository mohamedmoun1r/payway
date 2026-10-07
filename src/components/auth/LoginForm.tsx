'use client';

import React, { useState, useActionState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, ArrowLeft, User, Shield, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { loginAction, type AuthActionResult } from '@/lib/actions/auth.actions';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export interface LoginFormProps {
  locale: Locale;
  redirectTo?: string;
  initialError?: string;
}

export function LoginForm({ locale, redirectTo, initialError }: LoginFormProps) {
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    loginAction,
    null
  );

  const isDemoLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true';

  const [identifier, setIdentifier] = useState(
    isDemoLoginEnabled ? 'demo.student1@eng.cu.edu.eg' : ''
  );
  const [password, setPassword] = useState(
    isDemoLoginEnabled ? 'demo123456' : ''
  );

  // Handle successful login redirection
  useEffect(() => {
    if (state?.success && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  const handleQuickFill = (demoId: string, demoPass: string = 'demo123456') => {
    setIdentifier(demoId);
    setPassword(demoPass);
  };

  return (
    <div className="space-y-5">
      {/* 1. Initial or Server Action Error Messages */}
      {initialError && !state?.error && (
        <Alert variant="warning" title={isAr ? 'تنبيه وصول' : 'Access Alert'}>
          {initialError === 'student_record_missing'
            ? isAr
              ? 'الحساب مسجل كطالب ولكن لم يتم العثور على سجل أكاديمي مرتبط به.'
              : 'Account is assigned student role but no academic student record was found.'
            : initialError === 'admin_record_missing'
            ? isAr
              ? 'الحساب مسجل كمسؤول ولكن لم يتم العثور على سجل إداري مرتبط به.'
              : 'Account is assigned admin role but no administrative record was found.'
            : initialError}
        </Alert>
      )}

      {state?.error && (
        <Alert variant="destructive" title={isAr ? 'خطأ في المصادقة' : 'Authentication Error'}>
          {state.error}
        </Alert>
      )}

      {/* 2. Authentication Form */}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

        <Input
          name="identifier"
          label={dict.auth.identifierLabel}
          placeholder={dict.auth.identifierPlaceholder}
          icon={<Mail className="w-4 h-4" />}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoComplete="username"
          disabled={isPending}
        />

        <Input
          name="password"
          type="password"
          label={dict.auth.passwordLabel}
          placeholder={dict.auth.passwordPlaceholder}
          icon={<Lock className="w-4 h-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={isPending}
        />

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
              defaultChecked
              disabled={isPending}
            />
            <span>{dict.auth.rememberMe}</span>
          </label>
          <span className="text-slate-400 text-[11px]">
            {isAr ? 'النسخة التجريبية المعتمدة' : 'Verified Pilot Build'}
          </span>
        </div>

        <Button
          type="submit"
          className="w-full text-base py-2.5 font-bold cursor-pointer"
          disabled={isPending}
          icon={
            isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowIcon className="w-4 h-4" />
            )
          }
        >
          {isPending ? dict.common.loading.pleaseWait : dict.auth.submitLogin}
        </Button>
      </form>

      {/* 3. Demo Quick-Fill Credentials for Reviewers & Testers (Gated) */}
      {isDemoLoginEnabled && (
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-900" />
              {isAr ? 'حسابات التجربة السريعة (Demo Data)' : 'Synthetic Demo Accounts'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">demo123456</span>
          </div>

          <div className="space-y-2">
            {/* Student Archetypes */}
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {isAr ? 'نماذج حسابات الطلاب:' : 'Student Archetypes:'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('demo.student1@eng.cu.edu.eg')}
                disabled={isPending}
                className="px-2 py-1.5 text-start bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 text-xs transition-colors cursor-pointer"
              >
                <div className="font-semibold text-emerald-800 flex items-center gap-1">
                  <User className="w-3 h-3" /> DEMO-100001
                </div>
                <div className="text-[10px] text-slate-500">
                  {isAr ? 'سداد جزئي (أحمد علي)' : 'Part-Paid (Ahmed Ali)'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('demo.student2@eng.cu.edu.eg')}
                disabled={isPending}
                className="px-2 py-1.5 text-start bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 text-xs transition-colors cursor-pointer"
              >
                <div className="font-semibold text-emerald-800 flex items-center gap-1">
                  <User className="w-3 h-3" /> DEMO-100002
                </div>
                <div className="text-[10px] text-slate-500">
                  {isAr ? 'مسدد بالكامل (سارة حسن)' : 'Fully Paid (Sara Hassan)'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('demo.student3@eng.cu.edu.eg')}
                disabled={isPending}
                className="px-2 py-1.5 text-start bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 text-xs transition-colors cursor-pointer"
              >
                <div className="font-semibold text-emerald-800 flex items-center gap-1">
                  <User className="w-3 h-3" /> DEMO-100003
                </div>
                <div className="text-[10px] text-slate-500">
                  {isAr ? 'غير مسدد (يوسف طارق)' : 'Unpaid (Youssef Tarek)'}
                </div>
              </button>
            </div>

            {/* Admin Roles */}
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider pt-1">
              {isAr ? 'حسابات الإدارة والشؤون المالية:' : 'Administrative Roles:'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('admin.cashier@eng.cu.edu.eg')}
                disabled={isPending}
                className="px-2.5 py-1.5 text-start bg-blue-50/60 hover:bg-blue-50 rounded border border-blue-200 text-xs transition-colors cursor-pointer"
              >
                <div className="font-semibold text-blue-900 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> DEMO-ADM-001
                </div>
                <div className="text-[10px] text-slate-600">
                  {isAr ? 'خزينة الكلية (محمد صبري)' : 'Cashier Desk 1 (Standard)'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin.super@eng.cu.edu.eg')}
                disabled={isPending}
                className="px-2.5 py-1.5 text-start bg-blue-50/60 hover:bg-blue-50 rounded border border-blue-200 text-xs transition-colors cursor-pointer"
              >
                <div className="font-semibold text-blue-900 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> DEMO-ADM-002
                </div>
                <div className="text-[10px] text-slate-600">
                  {isAr ? 'مشرف مالي - إلغاء معاملات' : 'Finance Supervisor (Void Access)'}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
