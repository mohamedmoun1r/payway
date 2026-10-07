'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuthSuccess, logAuthFailure, logAuthLogout } from '@/lib/audit/logger';
import type { Locale } from '@/lib/i18n/config';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Resolves a user identifier (student ID, employee ID, or email) to their auth email.
 * First checks database via privileged lookup, then falls back to known demo identifiers.
 */
async function resolveIdentifierToEmail(identifier: string): Promise<string> {
  const trimmed = identifier.trim().toLowerCase();

  // If already an email format, return directly
  if (trimmed.includes('@')) {
    return trimmed;
  }

  // Pre-configured synthetic demo mappings for offline/pilot testing
  const demoMappings: Record<string, string> = {
    'demo-100001': 'demo.student1@eng.cu.edu.eg',
    '100001': 'demo.student1@eng.cu.edu.eg',
    'demo-100002': 'demo.student2@eng.cu.edu.eg',
    '100002': 'demo.student2@eng.cu.edu.eg',
    'demo-100003': 'demo.student3@eng.cu.edu.eg',
    '100003': 'demo.student3@eng.cu.edu.eg',
    'demo-100004': 'demo.student4@eng.cu.edu.eg',
    '100004': 'demo.student4@eng.cu.edu.eg',
    'demo-100005': 'demo.student5@eng.cu.edu.eg',
    '100005': 'demo.student5@eng.cu.edu.eg',
    'demo-adm-001': 'admin.cashier@eng.cu.edu.eg',
    'adm-001': 'admin.cashier@eng.cu.edu.eg',
    'demo-adm-002': 'admin.super@eng.cu.edu.eg',
    'adm-002': 'admin.super@eng.cu.edu.eg',
  };

  if (demoMappings[trimmed]) {
    return demoMappings[trimmed];
  }

  // Attempt database resolution: Lookup student_number in public.students
  try {
    const adminClient = createAdminClient();
    const { data: studentRecord } = await adminClient
      .from('students')
      .select('id')
      .ilike('student_number', trimmed)
      .single();

    if (studentRecord?.id) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email')
        .eq('id', studentRecord.id)
        .single();

      if (profile?.email) {
        return profile.email;
      }
    }

    // Lookup employee_id in public.admins
    const { data: adminRecord } = await adminClient
      .from('admins')
      .select('id')
      .ilike('employee_id', trimmed)
      .single();

    if (adminRecord?.id) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email')
        .eq('id', adminRecord.id)
        .single();

      if (profile?.email) {
        return profile.email;
      }
    }
  } catch (err) {
    console.warn('[AUTH_IDENTIFIER_RESOLVE] Dynamic lookup failed, using raw string:', err);
  }

  return trimmed;
}

/**
 * Server Action for authenticating users via Supabase Auth with HttpOnly session cookies.
 */
export async function loginAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawIdentifier = formData.get('identifier')?.toString() || '';
  const password = formData.get('password')?.toString() || '';
  const locale = (formData.get('locale')?.toString() || 'ar') as Locale;
  const redirectTo = formData.get('redirectTo')?.toString();

  // Extract client metadata for audit logging
  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = headersList.get('user-agent') || 'Unknown';

  if (!rawIdentifier.trim() || !password) {
    await logAuthFailure({
      identifier: rawIdentifier || 'empty',
      reason: 'Empty identifier or password submitted',
      ipAddress,
      userAgent,
    });
    return {
      success: false,
      error:
        locale === 'ar'
          ? 'يرجى إدخال اسم المستخدم وكلمة المرور'
          : 'Please enter your username and password',
    };
  }

  const email = await resolveIdentifierToEmail(rawIdentifier);

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      await logAuthFailure({
        identifier: rawIdentifier,
        reason: authError?.message || 'Invalid credentials',
        ipAddress,
        userAgent,
      });

      return {
        success: false,
        error:
          locale === 'ar'
            ? 'بيانات الدخول غير صحيحة. يرجى التحقق من اسم المستخدم وكلمة المرور.'
            : 'Invalid credentials. Please verify your email/ID and password.',
      };
    }

    // Server-side role resolution from public.profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      // Inactive or missing profile: Sign out immediately
      await supabase.auth.signOut();

      await logAuthFailure({
        identifier: rawIdentifier,
        reason: profile ? 'Account marked inactive' : 'Profile not found in database registry',
        ipAddress,
        userAgent,
      });

      return {
        success: false,
        error:
          locale === 'ar'
            ? 'الحساب غير نشط أو غير مسجل في قاعدة البيانات الرسمية للكلية.'
            : 'Account is inactive or not found in the official faculty registry.',
      };
    }

    // Audit successful authentication
    await logAuthSuccess({
      userId: authData.user.id,
      email: authData.user.email || email,
      role: profile.role,
      ipAddress,
      userAgent,
    });

    // Determine target route based on verified server role
    let targetUrl = redirectTo;
    if (!targetUrl || targetUrl.includes('/login')) {
      if (profile.role === 'STUDENT') {
        targetUrl = `/${locale}/student/dashboard`;
      } else {
        targetUrl = `/${locale}/admin/dashboard`;
      }
    }

    return {
      success: true,
      redirectTo: targetUrl,
    };
  } catch (err) {
    await logAuthFailure({
      identifier: rawIdentifier,
      reason: err instanceof Error ? err.message : 'Server communication exception',
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      error:
        locale === 'ar'
          ? 'حدث خطأ في الاتصال بخدمة التحقق. يرجى المحاولة لاحقاً.'
          : 'Server communication error. Please try again later.',
    };
  }
}

/**
 * Server Action for signing out and clearing session cookies.
 */
export async function logoutAction(locale: Locale = 'ar') {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const headersList = await headers();
      const ipAddress =
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
        headersList.get('x-real-ip') ||
        '127.0.0.1';
      const userAgent = headersList.get('user-agent') || 'Unknown';

      await logAuthLogout({
        userId: user.id,
        ipAddress,
        userAgent,
      });
    }

    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[LOGOUT_ACTION] Sign out cleanup exception:', err);
  }

  redirect(`/${locale}/login`);
}
