'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  Calendar,
  Tag,
  FileText,
  Search,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { formatCurrency } from '@/lib/utils';
import type { Database } from '@/types/database.types';
import {
  recordManualPaymentAction,
  searchStudentsAction,
  getStudentDuesAction,
  type PaymentActionResult,
} from '@/lib/actions/payment.actions';
import type { AdminStudentSearchResult, StudentDueForPayment } from '@/lib/data/admin';

export interface ManualPaymentModalShellProps {
  locale: Locale;
  studentId?: string;
  studentNumber?: string;
  studentName?: string;
  remainingBalance?: number;
  triggerLabel?: string;
  onPaymentSuccess?: () => void;
}

export function ManualPaymentModalShell({
  locale,
  studentId: initialStudentId,
  studentNumber: initialStudentNumber,
  studentName: initialStudentName,
  triggerLabel,
  onPaymentSuccess,
}: ManualPaymentModalShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  // Form State
  const [selectedStudent, setSelectedStudent] = useState<AdminStudentSearchResult | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminStudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [dues, setDues] = useState<StudentDueForPayment[]>([]);
  const [isLoadingDues, setIsLoadingDues] = useState(false);
  const [selectedDueId, setSelectedDueId] = useState<string>('');

  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] =
    useState<Database['public']['Enums']['payment_method']>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentTime, setPaymentTime] = useState<string>(
    new Date().toTimeString().slice(0, 5)
  );
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Workflow Stages: 'form' | 'confirm' | 'success'
  const [stage, setStage] = useState<'form' | 'confirm' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<PaymentActionResult['data'] | null>(null);

  // Load dues for a student
  const loadDuesForStudent = useCallback(
    async (studentId: string) => {
      setIsLoadingDues(true);
      setErrorMessage(null);
      try {
        const res = await getStudentDuesAction(studentId, locale);
        if (res.success && res.dues) {
          setDues(res.dues);
          // Automatically select the first due with an outstanding balance
          const firstUnpaid = res.dues.find((d) => d.remainingBalance > 0) || res.dues[0];
          if (firstUnpaid) {
            setSelectedDueId(firstUnpaid.id);
            setAmount(firstUnpaid.remainingBalance > 0 ? firstUnpaid.remainingBalance.toString() : '');
          } else {
            setSelectedDueId('');
            setAmount('');
          }
        } else {
          setDues([]);
          setSelectedDueId('');
          setErrorMessage(res.error || dict.admin.noDuesFound);
        }
      } catch {
        setDues([]);
        setErrorMessage(dict.common.error.somethingWentWrong);
      } finally {
        setIsLoadingDues(false);
      }
    },
    [locale, dict.admin.noDuesFound, dict.common.error.somethingWentWrong]
  );

  // Initialize or reset form state
  const resetForm = useCallback(() => {
    // Generate fresh cryptographic idempotency key per attempt
    const newKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    setIdempotencyKey(newKey);
    setStage('form');
    setErrorMessage(null);
    setSuccessResult(null);
    setAmount('');
    setReferenceNumber('');
    setNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentTime(new Date().toTimeString().slice(0, 5));
    setPaymentMethod('CASH');

    if (initialStudentId) {
      setSelectedStudent({
        id: initialStudentId,
        studentNumber: initialStudentNumber || '',
        nameAr: initialStudentName || '',
        nameEn: initialStudentName || '',
        email: '',
        department: '',
        level: 1,
        currentSemesterDue: 0,
        currentSemesterPaid: 0,
        outstandingBalance: 0,
        status: 'UNPAID',
      });
      loadDuesForStudent(initialStudentId);
    } else {
      setSelectedStudent(null);
      setDues([]);
      setSelectedDueId('');
    }
  }, [initialStudentId, initialStudentNumber, initialStudentName, loadDuesForStudent]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Search students handler
  const handleSearchStudents = async (query: string) => {
    setStudentSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchStudentsAction(query.trim(), locale);
      if (res.success && res.students) {
        setSearchResults(res.students);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Select student from search list
  const handleSelectStudent = (student: AdminStudentSearchResult) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setStudentSearchQuery('');
    loadDuesForStudent(student.id);
  };

  // Change student button
  const handleChangeStudent = () => {
    setSelectedStudent(null);
    setDues([]);
    setSelectedDueId('');
    setAmount('');
    setErrorMessage(null);
  };

  // Current selected due object
  const selectedDue = dues.find((d) => d.id === selectedDueId);
  const remainingForSelectedDue = selectedDue ? selectedDue.remainingBalance : 0;
  const numAmount = parseFloat(amount) || 0;
  const isOverpayment = selectedDue ? numAmount > remainingForSelectedDue : false;
  const isInvalidAmount = numAmount <= 0 || isNaN(numAmount);

  // Switch due change handler
  const handleDueChange = (dueId: string) => {
    setSelectedDueId(dueId);
    const target = dues.find((d) => d.id === dueId);
    if (target && target.remainingBalance > 0) {
      setAmount(target.remainingBalance.toString());
    } else {
      setAmount('');
    }
  };

  // Move to review/confirm step
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedStudent) {
      setErrorMessage(isAr ? 'يرجى اختيار الطالب أولاً' : 'Please select a student first');
      return;
    }
    if (!selectedDue) {
      setErrorMessage(isAr ? 'يرجى اختيار المستحق المالي' : 'Please select a fee due');
      return;
    }
    if (isInvalidAmount) {
      setErrorMessage(
        isAr ? 'مبلغ السداد يجب أن يكون أكبر من صفر' : 'Payment amount must be greater than zero'
      );
      return;
    }
    if (isOverpayment) {
      setErrorMessage(dict.admin.overpaymentWarning);
      return;
    }

    setStage('confirm');
  };

  // Submit payment to server action
  const handleCommitPayment = async () => {
    if (!selectedStudent || !selectedDue || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await recordManualPaymentAction(
        {
          studentId: selectedStudent.id,
          semesterId: selectedDue.semesterId,
          amount: numAmount,
          paymentMethod,
          paymentDate,
          paymentTime,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          idempotencyKey,
        },
        locale
      );

      if (result.success && result.data) {
        setSuccessResult(result.data);
        setStage('success');
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      } else {
        setErrorMessage(
          result.error ||
            (isAr ? 'فشلت معالجة السداد. يرجى مراجعة البيانات.' : 'Payment processing failed.')
        );
        setStage('form');
      }
    } catch {
      setErrorMessage(dict.common.error.somethingWentWrong);
      setStage('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modal Footer Buttons depending on stage
  const renderFooter = () => {
    if (stage === 'success') {
      return (
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
            {dict.common.actions.close}
          </Button>
          <Button
            size="sm"
            onClick={resetForm}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            {dict.admin.recordAnother}
          </Button>
        </div>
      );
    }

    if (stage === 'confirm') {
      return (
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => setStage('form')}
          >
            {dict.common.actions.back}
          </Button>
          <Button
            size="sm"
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
            disabled={isSubmitting}
            onClick={handleCommitPayment}
            icon={
              isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )
            }
          >
            {isSubmitting ? dict.admin.submittingPayment : dict.admin.confirmPayment}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between w-full">
        <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
          {dict.common.actions.cancel}
        </Button>
        <Button
          size="sm"
          disabled={!selectedStudent || !selectedDue || isInvalidAmount || isOverpayment}
          onClick={handleProceedToConfirm}
          icon={<ArrowIcon className="w-4 h-4" />}
        >
          {isAr ? 'متابعة' : 'Next'}
        </Button>
      </div>
    );
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="cursor-pointer"
        icon={<PlusCircle className="w-4 h-4" />}
      >
        {triggerLabel || dict.admin.recordPayment}
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={() => {
          if (!isSubmitting) setIsOpen(false);
        }}
        title={dict.admin.recordPayment}
        description={
          isAr
            ? 'تسجيل سداد يدوي بالخزينة وإصدار قسيمة تحصيل معتمدة مع تحديث فوري للمستحقات'
            : 'Record manual treasury collection and issue official receipt with immediate balance update'
        }
        maxWidth="lg"
        footer={renderFooter()}
      >
        <div className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive" title={isAr ? 'خطأ في معالجة السداد' : 'Payment Error'}>
              {errorMessage}
            </Alert>
          )}

          {/* ================================================================= */}
          {/* STAGE: SUCCESS CONFIRMATION                                        */}
          {/* ================================================================= */}
          {stage === 'success' && successResult && (
            <div className="space-y-4 py-2">
              <div className="text-center p-6 bg-emerald-50 rounded-2xl border border-emerald-200">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-emerald-950">
                  {dict.admin.paymentSuccessTitle}
                </h3>
                <p className="text-xs text-emerald-800 mt-1 max-w-sm mx-auto">
                  {dict.admin.paymentSuccessDesc}
                </p>
                {successResult.isDuplicate && (
                  <div className="mt-2 inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-md">
                    {dict.admin.duplicateWarning}
                  </div>
                )}
              </div>

              {/* Receipt Summary Grid */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.transactionNumber}:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {successResult.transactionNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.receiptNumber}:</span>
                  <span className="font-mono font-extrabold text-blue-900">
                    {successResult.receiptNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500">{dict.admin.studentName}:</span>
                  <span className="font-bold text-slate-900">
                    {isAr ? successResult.studentNameAr : successResult.studentNameEn}
                    <span className="font-mono text-slate-500 ms-1.5">
                      ({successResult.studentNumber})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.amount}:</span>
                  <span className="text-sm font-black text-emerald-700">
                    {formatCurrency(successResult.amount, dict.common.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.method}:</span>
                  <Badge variant="outline">
                    {dict.common.methods[
                      successResult.paymentMethod === 'BANK_TRANSFER'
                        ? 'bankTransfer'
                        : (successResult.paymentMethod.toLowerCase() as 'cash' | 'pos' | 'other')
                    ] || successResult.paymentMethod}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.date}:</span>
                  <span className="text-slate-700">
                    {successResult.paymentDate} • {successResult.paymentTime}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 font-bold">{dict.admin.newBalance}:</span>
                  <span className="font-extrabold text-slate-900">
                    {formatCurrency(successResult.newRemainingBalance, dict.common.currency)}
                  </span>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <Link
                  href={`/${locale}/admin/students/${successResult.studentId}`}
                  onClick={() => setIsOpen(false)}
                >
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <ExternalLink className="w-3.5 h-3.5 me-1.5" />
                    {dict.admin.viewStudentLedger}
                  </Button>
                </Link>
                <Link href={`/${locale}/admin/payments`} onClick={() => setIsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <ExternalLink className="w-3.5 h-3.5 me-1.5" />
                    {dict.admin.viewPaymentJournal}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STAGE: CONFIRMATION REVIEW                                        */}
          {/* ================================================================= */}
          {stage === 'confirm' && selectedStudent && selectedDue && (
            <div className="space-y-4">
              <Alert variant="info" title={dict.admin.confirmTitle}>
                {dict.admin.confirmDesc}
              </Alert>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">{dict.admin.studentName}:</span>
                  <span className="font-bold text-slate-900">
                    {isAr ? selectedStudent.nameAr : selectedStudent.nameEn} ({selectedStudent.studentNumber})
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.semester}:</span>
                  <span className="font-semibold text-slate-800">
                    {isAr ? selectedDue.semesterNameAr : selectedDue.semesterNameEn} ({selectedDue.semesterCode})
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.amount}:</span>
                  <span className="text-base font-black text-emerald-700">
                    {formatCurrency(numAmount, dict.common.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.method}:</span>
                  <span className="font-medium text-slate-800">
                    {dict.common.methods[
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'bankTransfer'
                        : (paymentMethod.toLowerCase() as 'cash' | 'pos' | 'other')
                    ] || paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500">{dict.student.date}:</span>
                  <span className="text-slate-800">
                    {paymentDate} • {paymentTime}
                  </span>
                </div>
                {referenceNumber && (
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500">{dict.student.referenceNumber}:</span>
                    <span className="font-mono text-slate-800">{referenceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 font-bold">
                  <span className="text-slate-500">{dict.admin.newBalance}:</span>
                  <span className="text-slate-900">
                    {formatCurrency(
                      Math.max(0, remainingForSelectedDue - numAmount),
                      dict.common.currency
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STAGE: FORM INPUTS                                                */}
          {/* ================================================================= */}
          {stage === 'form' && (
            <div className="space-y-4">
              {/* 1. Student Selection Section */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {dict.admin.selectStudent} <span className="text-red-500">*</span>
                </label>

                {!selectedStudent ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        placeholder={dict.admin.searchStudentPrompt}
                        value={studentSearchQuery}
                        onChange={(e) => handleSearchStudents(e.target.value)}
                        icon={
                          isSearching ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : (
                            <Search className="w-4 h-4 text-slate-400" />
                          )
                        }
                      />
                    </div>

                    {/* Search Results Dropdown List */}
                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-md divide-y divide-slate-100 text-xs">
                        {searchResults.map((s) => (
                          <button
                            type="button"
                            key={s.id}
                            onClick={() => handleSelectStudent(s)}
                            className="w-full text-start p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="font-bold text-slate-900">
                                {isAr ? s.nameAr : s.nameEn}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {s.studentNumber} • {s.department} (L{s.level})
                              </div>
                            </div>
                            <div className="text-end">
                              <span
                                className={`font-semibold ${
                                  s.outstandingBalance > 0 ? 'text-amber-700' : 'text-slate-400'
                                }`}
                              >
                                {formatCurrency(s.outstandingBalance, dict.common.currency)}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {s.outstandingBalance > 0
                                  ? dict.student.remainingBalance
                                  : dict.common.status.paid}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {studentSearchQuery.trim().length >= 2 &&
                      !isSearching &&
                      searchResults.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          {dict.admin.noStudentsFound}
                        </p>
                      )}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-900 text-white font-bold flex items-center justify-center text-xs">
                        {(isAr ? selectedStudent.nameAr : selectedStudent.nameEn).slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">
                          {isAr ? selectedStudent.nameAr : selectedStudent.nameEn}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {selectedStudent.studentNumber}
                        </div>
                      </div>
                    </div>
                    {!initialStudentId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-blue-700 hover:text-blue-800"
                        onClick={handleChangeStudent}
                      >
                        {isAr ? 'تغيير الطالب' : 'Change Student'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Semester Due Selection */}
              {selectedStudent && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {dict.admin.selectDue} <span className="text-red-500">*</span>
                  </label>

                  {isLoadingDues ? (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-900" />
                      <span>{isAr ? 'جاري تحميل المستحقات...' : 'Loading dues...'}</span>
                    </div>
                  ) : dues.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={selectedDueId}
                        onChange={(e) => handleDueChange(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-900"
                      >
                        {dues.map((d) => (
                          <option key={d.id} value={d.id} disabled={d.remainingBalance <= 0}>
                            {isAr ? d.semesterNameAr : d.semesterNameEn} ({d.semesterCode}) —{' '}
                            {d.remainingBalance > 0
                              ? `${formatCurrency(d.remainingBalance, dict.common.currency)} ${dict.student.remainingBalance}`
                              : `(${dict.common.status.paid})`}
                          </option>
                        ))}
                      </select>

                      {/* Selected Due Breakdown Card */}
                      {selectedDue && (
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 text-xs grid grid-cols-3 gap-2 text-center">
                          <div>
                            <span className="text-[11px] text-slate-500 block">
                              {dict.student.netDue}
                            </span>
                            <strong className="text-slate-900 font-bold">
                              {formatCurrency(selectedDue.netDueAmount, dict.common.currency)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">
                              {dict.student.paid}
                            </span>
                            <strong className="text-emerald-700 font-bold">
                              {formatCurrency(selectedDue.paidAmount, dict.common.currency)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-500 block">
                              {dict.student.remainingBalance}
                            </span>
                            <strong className="text-amber-800 font-black">
                              {formatCurrency(selectedDue.remainingBalance, dict.common.currency)}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">{dict.admin.noDuesFound}</p>
                  )}
                </div>
              )}

              {/* 3. Amount and Payment Method */}
              {selectedStudent && selectedDue && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          {dict.student.amount} ({dict.common.currency}) <span className="text-red-500">*</span>
                        </label>
                        {remainingForSelectedDue > 0 && (
                          <button
                            type="button"
                            onClick={() => setAmount(remainingForSelectedDue.toString())}
                            className="text-[10px] text-blue-700 hover:underline font-semibold"
                          >
                            {dict.admin.payFullRemaining}
                          </button>
                        )}
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        max={remainingForSelectedDue}
                        placeholder={remainingForSelectedDue.toString()}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={isOverpayment ? 'border-red-500 text-red-600' : ''}
                      />
                      {isOverpayment && (
                        <p className="text-[11px] text-red-600 mt-1 font-semibold">
                          {dict.admin.overpaymentWarning}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {dict.student.method} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value as Database['public']['Enums']['payment_method']
                          )
                        }
                        className="w-full text-xs rounded-xl border border-slate-300 bg-white p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-900"
                      >
                        <option value="CASH">{dict.common.methods.cash}</option>
                        <option value="BANK_TRANSFER">{dict.common.methods.bankTransfer}</option>
                        <option value="POS">{dict.common.methods.pos}</option>
                        <option value="OTHER">{dict.common.methods.other}</option>
                      </select>
                    </div>
                  </div>

                  {/* 4. Date & Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      type="date"
                      label={dict.student.date}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      icon={<Calendar className="w-4 h-4 text-slate-400" />}
                    />
                    <Input
                      type="time"
                      label={dict.student.time}
                      value={paymentTime}
                      onChange={(e) => setPaymentTime(e.target.value)}
                    />
                  </div>

                  {/* 5. Reference Number & Notes */}
                  <div className="space-y-3">
                    <Input
                      label={dict.student.referenceNumber}
                      placeholder={dict.admin.referencePlaceholder}
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      icon={<Tag className="w-4 h-4 text-slate-400" />}
                    />
                    <Input
                      label={dict.admin.notes}
                      placeholder={dict.admin.notesPlaceholder}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      icon={<FileText className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
