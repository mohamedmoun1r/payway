'use client';

import React, { useState } from 'react';
import { PlusCircle, CheckCircle2, DollarSign, Calendar, Clock } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formatCurrency } from '@/lib/utils';

export function ManualPaymentModalPlaceholder({ locale }: { locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  const [studentNumber, setStudentNumber] = useState('DEMO-20240001');
  const [amount, setAmount] = useState('5000');
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER'>('CASH');
  const [refNumber, setRefNumber] = useState('REF-2026-9921');
  const [notes, setNotes] = useState('سداد يدوي مثبت بقسيمة الخزينة');

  const handleOpen = () => {
    setIsConfirmStep(false);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsConfirmStep(false);
  };

  return (
    <>
      <Button icon={<PlusCircle className="w-4 h-4" />} onClick={handleOpen}>
        {dict.admin.recordPayment}
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title={isConfirmStep ? (isAr ? 'تأكيد تسجيل السداد' : 'Confirm Payment Recording') : dict.admin.recordPayment}
        description={
          isConfirmStep
            ? (isAr ? 'يرجى مراجعة تفاصيل المعاملة قبل الإدراج المالي النهائي' : 'Review details before final commit')
            : (isAr ? 'نموذج تسجيل السداد اليدوي المباشر بخزينة الكلية' : 'Record manual payment at the faculty treasury')
        }
        maxWidth="lg"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              {dict.common.actions.cancel}
            </Button>
            {!isConfirmStep ? (
              <Button size="sm" onClick={() => setIsConfirmStep(true)}>
                {isAr ? 'متابعة للتأكيد' : 'Proceed to Confirm'}
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800"
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => {
                  alert(
                    isAr
                      ? 'مرحلة تجريبية أولى (Phase 1): تم التحقق من سلامة الواجهة والتنقل. الإدراج في قاعدة البيانات يبدأ في المراحل التالية.'
                      : 'Phase 1: UI layout and flow verified! Database persistence begins in subsequent phases.'
                  );
                  handleClose();
                }}
              >
                {dict.common.actions.confirm}
              </Button>
            )}
          </div>
        }
      >
        {!isConfirmStep ? (
          <div className="space-y-4">
            <Alert variant="info">
              {isAr
                ? 'نموذج الدفع المبسط (طالب + فصل دراسي + مبلغ): يتم استنزال المبلغ مباشرة من رصيد الفصل وتوليد إيصال فوري.'
                : 'Simplified fee model (Student + Semester + Amount): amount is deducted from semester balance and an instant receipt is generated.'}
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={dict.admin.studentNumber}
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                required
              />

              <div>
                <label className="text-sm font-semibold text-slate-800 select-none block mb-1.5">
                  {dict.student.semester}
                </label>
                <select className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800">
                  <option>{isAr ? 'الفصل الدراسي الأول 2024/2025 (متبقي: 5,000 ج.م)' : 'Fall 2024/2025 (Remaining: 5,000 EGP)'}</option>
                  <option>{isAr ? 'الفصل الدراسي الصيفي 2023/2024 (مسدد بالكامل)' : 'Summer 2023/2024 (Paid in Full)'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={`${dict.student.amount} (${dict.common.currency})`}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                icon={<DollarSign className="w-4 h-4" />}
                required
              />

              <div>
                <label className="text-sm font-semibold text-slate-800 select-none block mb-1.5">
                  {dict.student.method}
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as 'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                >
                  <option value="CASH">{dict.common.methods.cash}</option>
                  <option value="POS">{dict.common.methods.pos}</option>
                  <option value="BANK_TRANSFER">{dict.common.methods.bankTransfer}</option>
                  <option value="OTHER">{dict.common.methods.other}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={dict.student.date}
                type="date"
                defaultValue="2026-10-06"
                icon={<Calendar className="w-4 h-4" />}
              />
              <Input
                label={dict.student.time}
                type="time"
                defaultValue="11:30"
                icon={<Clock className="w-4 h-4" />}
              />
            </div>

            <Input
              label={isAr ? 'رقم الإيصال اليدوي / القسيمة البنكية (اختياري)' : 'Reference / Voucher Number (Optional)'}
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
            />

            <Input
              label={dict.admin.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-sm space-y-2">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">{dict.admin.studentNumber}:</span>
                <strong className="font-mono">{studentNumber}</strong>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">{dict.admin.studentName}:</span>
                <strong className="text-slate-900">{isAr ? 'أحمد محمود علي (طالب تجريبي)' : 'Ahmed Mahmoud Ali (Demo)'}</strong>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">{dict.student.amount}:</span>
                <strong className="text-emerald-700 text-base">{formatCurrency(Number(amount), dict.common.currency)}</strong>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">{dict.student.method}:</span>
                <span>{method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? 'تفقيط المبلغ:' : 'Amount in words:'}</span>
                <span className="text-xs font-semibold text-blue-900">
                  {isAr ? 'فقط خمسة آلاف جنيه مصري لا غير' : 'Five Thousand Egyptian Pounds Only'}
                </span>
              </div>
            </div>

            <Alert variant="warning" title={isAr ? 'تأكيد التسجيل النهائي' : 'Commit Warning'}>
              {isAr
                ? 'عند التأكيد سيتم إصدار إيصال معتمد برقم تسلسلي، وتعديل رصيد الطالب فورياً، وإضافة سجل تدقيق باسم المسؤول الحالي.'
                : 'Confirming will issue a sequential receipt, adjust student balance, and append an immutable audit log.'}
            </Alert>
          </div>
        )}
      </Dialog>
    </>
  );
}
