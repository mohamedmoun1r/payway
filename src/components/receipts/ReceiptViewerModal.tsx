'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Printer, X, ExternalLink, Loader2 } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';
import { ReceiptDownloadButton } from './ReceiptDownloadButton';

interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptId: string;
  receiptNumber: string;
  locale?: Locale;
}

export function ReceiptViewerModal({
  isOpen,
  onClose,
  receiptId,
  receiptNumber,
  locale = 'ar',
}: ReceiptViewerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const isAr = locale === 'ar';
  const pdfUrl = `/api/receipts/${receiptId}/pdf`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      setIsLoading(true);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const iframe = document.getElementById('receipt-pdf-iframe') as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        // Fallback: open in new tab
        window.open(pdfUrl, '_blank');
      }
    } else {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl transition-all border border-slate-200 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-blue-900" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAr ? 'إيصال السداد المالي' : 'Financial Payment Receipt'}
              </h3>
              <p className="text-xs font-mono text-slate-500">{receiptNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              title={isAr ? 'طباعة الإيصال' : 'Print Receipt'}
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">{isAr ? 'طباعة' : 'Print'}</span>
            </button>

            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              title={isAr ? 'فتح في نافذة جديدة' : 'Open in New Window'}
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">{isAr ? 'نافذة جديدة' : 'New Tab'}</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label={isAr ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview Frame */}
        <div className="relative flex-1 bg-slate-100 overflow-hidden flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-900" />
              <p className="text-xs text-slate-600">
                {isAr ? 'جاري إعداد ومعاينة الإيصال...' : 'Generating receipt preview...'}
              </p>
            </div>
          )}

          <iframe
            id="receipt-pdf-iframe"
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            title={`Receipt ${receiptNumber}`}
            className="w-full h-full border-none"
            onLoad={() => setIsLoading(false)}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white">
          <p className="text-xs text-slate-500">
            {isAr
              ? 'إيصال رسمي معتمد برمز استجابة سريعة (QR) موثق رقمياً'
              : 'Official certified receipt with cryptographically verified QR code'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <ReceiptDownloadButton
              receiptId={receiptId}
              receiptNumber={receiptNumber}
              locale={locale}
              size="md"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
