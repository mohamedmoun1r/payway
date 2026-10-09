import React from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, ArrowLeft, ArrowRight } from 'lucide-react';
import { verifyReceiptByHash } from '@/lib/data/verify-receipt';
import { isValidLocale, type Locale } from '@/lib/i18n/config';
import { isDevMockEnabled } from '@/lib/data/mock-data';

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  params: Promise<{
    locale: string;
    hash: string;
  }>;
}

export default async function VerifyReceiptPage({ params }: VerifyPageProps) {
  const { locale: rawLocale, hash } = await params;
  const locale = (isValidLocale(rawLocale) ? rawLocale : 'ar') as Locale;
  const isAr = locale === 'ar';

  const verification = await verifyReceiptByHash(hash);
  const isVoided = verification.payment_status === 'VOIDED';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Pilot Disclaimer Banner: Displayed only when development demo/mock mode is active */}
        {isDevMockEnabled() && (
          <div className="mb-6 rounded-md bg-amber-50 p-4 border border-amber-200 text-center shadow-sm">
            <p className="text-xs font-bold text-amber-800">
              {isAr
                ? '⚠️ بيئة تجريبية قبل الإنتاج — بيانات تجريبية فقط — لا توجد معاملات حقيقية'
                : '⚠️ PRE-PRODUCTION PILOT ENVIRONMENT — DEMO DATA ONLY — NO REAL TRANSACTIONS'}
            </p>
          </div>
        )}

        {/* University Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-800 mb-3">
            <ShieldCheck className="w-7 h-7 text-blue-900" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {isAr ? 'جامعة القاهرة — كلية الهندسة' : 'Cairo University — Faculty of Engineering'}
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">
            {isAr ? 'منظومة التحقق الإلكتروني من إيصالات السداد' : 'Official Electronic Receipt Verification System'}
          </p>
        </div>

        {/* Verification Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          {verification.authenticity_result ? (
            isVoided ? (
              // Status: VOIDED
              <div className="p-6 bg-amber-50/50 border-b border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-amber-900">
                    {isAr ? 'معاملة ملغاة رسمياً (VOIDED)' : 'Officially Voided Transaction'}
                  </h2>
                  <p className="text-xs text-amber-700 mt-1">
                    {isAr
                      ? 'تم التحقق من صحة توثيق الإيصال الأصلي، ولكن المعاملة تم إلغاؤها وعكس قيمتها عبر إدارة الحسابات بالكلية.'
                      : 'The receipt signature is authentic, but this financial transaction was officially voided and reversed by university supervision.'}
                  </p>
                </div>
              </div>
            ) : (
              // Status: AUTHENTIC / COMPLETED
              <div className="p-6 bg-emerald-50/50 border-b border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-emerald-900">
                    {isAr ? 'إيصال سداد رسمي معتمد وموثق رقمياً' : 'Verified Authentic University Receipt'}
                  </h2>
                  <p className="text-xs text-emerald-700 mt-1">
                    {isAr
                      ? 'تمت مطابقة هذا المستند بنجاح مع سجلات الخزينة الرسمية لكلية الهندسة جامعة القاهرة.'
                      : 'This document successfully matches official treasury records of Cairo University Faculty of Engineering.'}
                  </p>
                </div>
              </div>
            )
          ) : (
            // Status: INVALID / TAMPERED
            <div className="p-6 bg-rose-50/50 border-b border-rose-200 flex items-start gap-3">
              <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-rose-900">
                  {isAr ? 'إيصال غير صالح أو بيانات غير مسجلة' : 'Unverified or Invalid Receipt'}
                </h2>
                <p className="text-xs text-rose-700 mt-1">
                  {isAr
                    ? 'لم يتم العثور على أي قيد مالي يطابق هذا الرمز. قد يكون المستند غير رسمي أو تم التعديل عليه.'
                    : 'No official financial record matches this verification code. The document may be unofficial or modified.'}
                </p>
              </div>
            </div>
          )}

          {/* EXACT 7-FIELD NON-PII DATA CONTRACT DISPLAY */}
          {verification.authenticity_result ? (
            <div className="p-6">
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-3 flex justify-between items-center">
                  <dt className="text-slate-500 font-medium">{isAr ? 'رقم الإيصال:' : 'Receipt Number:'}</dt>
                  <dd className="font-mono font-bold text-slate-900">{verification.receipt_number}</dd>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <dt className="text-slate-500 font-medium">{isAr ? 'رقم المعاملة:' : 'Transaction Number:'}</dt>
                  <dd className="font-mono font-medium text-slate-800">{verification.transaction_number}</dd>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <dt className="text-slate-500 font-medium">{isAr ? 'المبلغ المسدد:' : 'Payment Amount:'}</dt>
                  <dd className="font-bold text-emerald-700 text-base">
                    {Number(verification.amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <dt className="text-slate-500 font-medium">{isAr ? 'تاريخ السداد:' : 'Payment Date:'}</dt>
                  <dd className="text-slate-900">{verification.payment_date}</dd>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <dt className="text-slate-500 font-medium">{isAr ? 'حالة السداد:' : 'Payment Status:'}</dt>
                  <dd>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isVoided ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {verification.payment_status}
                    </span>
                  </dd>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <dt className="text-slate-500 font-medium">{isAr ? 'نتيجة التحقق:' : 'Authenticity Result:'}</dt>
                  <dd className="font-bold text-emerald-600">
                    {isAr ? 'موثق ومعتمد رسمي (AUTHENTIC)' : 'Verified Authentic (AUTHENTIC)'}
                  </dd>
                </div>

                <div className="py-3 flex justify-between items-center">
                  <dt className="text-slate-500 font-medium">{isAr ? 'تاريخ وساعة التوثيق:' : 'Issued At:'}</dt>
                  <dd className="text-xs text-slate-600">
                    {new Date(verification.issued_at).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">
              <p>
                {isAr
                  ? 'يرجى التأكد من مسح رمز الاستجابة السريعة الأصلي المطبوع على الإيصال.'
                  : 'Please ensure you scanned the original QR code printed on the official receipt.'}
              </p>
            </div>
          )}
        </div>

        {/* Privacy Protection Notice */}
        <div className="bg-slate-100 rounded-lg p-4 border border-slate-200 text-xs text-slate-600 leading-relaxed text-center mb-6">
          <p className="font-semibold text-slate-800 mb-1">
            {isAr ? '🔒 سياسة حماية بيانات الطلاب والخصوصية' : '🔒 Student Data Privacy & Protection Policy'}
          </p>
          <p>
            {isAr
              ? 'وفقاً لسياسات حماية البيانات وسرية السجلات الأكاديمية بجامعة القاهرة، لا يتم عرض بيانات الطالب الشخصية (الاسم، الرقم القومي، رقم القيد، القسم الأكاديمي) في هذه الصفحة العامة. تتوفر البيانات الكاملة حصرياً للطالب والموظف المخول داخل البوابة الموثقة.'
              : 'In compliance with Cairo University data privacy policies, personal student information (full name, national ID, student ID, department) is strictly redacted from public verification endpoints and accessible only via authenticated portal accounts.'}
          </p>
        </div>

        {/* Portal Login Link */}
        <div className="text-center">
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900 hover:text-blue-700 transition"
          >
            {isAr ? (
              <>
                <span>تسجيل الدخول إلى بوابة الطلاب والمسؤولين</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Sign in to the Student & Staff Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
