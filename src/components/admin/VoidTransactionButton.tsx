'use client';

import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { VoidTransactionModal, type VoidableTransaction } from './VoidTransactionModal';
import type { Locale } from '@/lib/i18n/config';

interface VoidTransactionButtonProps {
  transaction: VoidableTransaction;
  locale?: Locale;
  canVoid?: boolean;
}

export function VoidTransactionButton({
  transaction,
  locale = 'ar',
  canVoid = true,
}: VoidTransactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isAr = locale === 'ar';

  if (!canVoid) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
        title={isAr ? 'إلغاء المعاملة المالية (مشرف مالي)' : 'Void this transaction (Finance Supervisor)'}
      >
        <Ban className="w-3.5 h-3.5 text-red-600" />
        <span>{isAr ? 'إلغاء' : 'Void'}</span>
      </button>

      <VoidTransactionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        transaction={transaction}
        locale={locale}
        onSuccess={() => {
          // Modal handles success display and Next.js revalidatePath updates server components
        }}
      />
    </>
  );
}
