'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';

interface ReceiptDownloadButtonProps {
  receiptId: string;
  receiptNumber: string;
  locale?: Locale;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ReceiptDownloadButton({
  receiptId,
  receiptNumber,
  locale = 'ar',
  variant = 'primary',
  size = 'md',
  className = '',
}: ReceiptDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const isAr = locale === 'ar';

  const handleDownload = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/receipts/${receiptId}/pdf`);

      if (!res.ok) {
        let errorMsg = isAr ? 'تعذر تحميل الإيصال' : 'Failed to download receipt';
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch {
          // Fallback message
        }
        alert(errorMsg);
        return;
      }

      // Convert blob to download link
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CUFE-Receipt-${receiptNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('[RECEIPT_DOWNLOAD_CLIENT_ERROR]', err);
      alert(isAr ? 'حدث خطأ أثناء تحميل الإيصال' : 'An error occurred while downloading receipt');
    } finally {
      setLoading(false);
    }
  };

  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const sizeStyles = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  }[size];

  const variantStyles = {
    primary: 'bg-blue-900 text-white hover:bg-blue-800 focus:ring-blue-900',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-blue-900',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:ring-slate-400',
  }[variant];

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className} ${
        loading ? 'opacity-70 cursor-not-allowed' : ''
      }`}
      title={isAr ? 'تحميل إيصال السداد بصيغة PDF' : 'Download official PDF receipt'}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <Download className="w-4 h-4 text-current" />
      )}
      <span>{loading ? (isAr ? 'جاري التحميل...' : 'Downloading...') : isAr ? 'تحميل الإيصال (PDF)' : 'Download Receipt (PDF)'}</span>
    </button>
  );
}
