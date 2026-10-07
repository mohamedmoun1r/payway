import React from 'react';
import {
  User,
  GraduationCap,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { type Locale, isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { requireStudent } from '@/lib/auth/guards';
import { getStudentProfile } from '@/lib/data/student';

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const isAr = locale === 'ar';

  // 1. Strict Server Authorization Guard
  const context = await requireStudent(locale, `/${locale}/student/profile`);

  // 2. Fetch Isolated Profile for Authenticated Student
  const profileData = await getStudentProfile(context.user.id);

  if (!profileData) {
    return (
      <div className="py-12">
        <EmptyState
          title={dict.common.error.somethingWentWrong}
          description={dict.common.error.tryAgain}
        />
      </div>
    );
  }

  const { profile, student } = profileData;

  // Mask National ID for privacy
  const maskedNationalId = profile.national_id
    ? `${profile.national_id.slice(0, 4)}••••••${profile.national_id.slice(-4)}`
    : '-';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">{dict.student.profilePageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {dict.student.personalInfo}
        </p>
      </div>

      {/* 2. Institutional Immutability Notice */}
      <Alert variant="info" title={isAr ? 'حماية البيانات الجامعية' : 'Identity Protection Notice'}>
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-blue-800" />
          <span>{dict.student.profileNotice}</span>
        </div>
      </Alert>

      {/* 3. Main Profile Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-900" />
              <CardTitle>{dict.student.personalInfo}</CardTitle>
            </div>
            <CardDescription>
              {isAr ? 'البيانات الشخصية المسجلة بالسجلات' : 'Official student identification'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {isAr ? 'الاسم باللغة العربية' : 'Full Name (Arabic)'}
              </span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">
                {profile.full_name_ar}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {isAr ? 'الاسم باللغة الإنجليزية' : 'Full Name (English)'}
              </span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">
                {profile.full_name_en}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {dict.student.nationalId}
              </span>
              <span className="text-sm font-mono font-bold text-slate-900 block mt-0.5">
                {maskedNationalId}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {dict.student.email}
              </span>
              <span className="text-sm font-mono font-semibold text-slate-900 block mt-0.5">
                {profile.email}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {dict.student.phone}
              </span>
              <span className="text-sm font-mono text-slate-900 block mt-0.5">
                {profile.phone || '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Academic Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-900" />
              <CardTitle>{dict.student.academicDetails}</CardTitle>
            </div>
            <CardDescription>
              {isAr ? 'القيد والفرقة والتخصص الدراسي' : 'Academic status and program'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200/70">
              <span className="text-xs font-semibold text-blue-900 block">
                {dict.student.academicNumber}
              </span>
              <span className="text-base font-mono font-black text-blue-900 block mt-0.5">
                {student.student_number}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {dict.student.program}
              </span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">
                {student.academic_program}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {dict.student.department}
              </span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">
                {student.academic_department}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-400 block">
                {dict.student.level}
              </span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">
                {student.academic_level}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 block">
                  {dict.student.enrollmentStatus}
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {isAr ? 'قيد ساري ونشط' : 'Active Enrollment'}
                </span>
              </div>
              <Badge variant="success">
                <ShieldCheck className="w-3.5 h-3.5 me-1" />
                {isAr ? 'نشط' : 'Active'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
