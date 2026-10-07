import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LocaleNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900">
            الصفحة غير موجودة / Page Not Found
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            الرابط المطلوب غير متاح أو تم نقله. يرجى التأكد من المسار المطلوب.
            <br />
            The requested page does not exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center">
          <Link href="/">
            <Button size="sm" icon={<Home className="w-3.5 h-3.5" />}>
              العودة للرئيسية / Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
