'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error trace on server/client console for monitoring
    console.error('[UNHANDLED_ROUTE_ERROR]', error.message, error.digest);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900">
            حدث خطأ غير متوقع / An unexpected error occurred
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            واجه النظام مشكلة أثناء معالجة طلبك. تم تسجيل الحالة للتدقيق والمتابعة.
            <br />
            The system encountered an error while processing your request.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reset()}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            إعادة المحاولة / Try Again
          </Button>

          <Link href="/">
            <Button size="sm" icon={<Home className="w-3.5 h-3.5" />}>
              الرئيسية / Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
