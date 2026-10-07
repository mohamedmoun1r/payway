import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logUnauthorizedAccess } from '@/lib/audit/logger';
import type { Database } from '@/types/database.types';
import type { Locale } from '@/lib/i18n/config';

export type ProfileRecord = Database['public']['Tables']['profiles']['Row'];
export type StudentRecord = Database['public']['Tables']['students']['Row'];
export type AdminRecord = Database['public']['Tables']['admins']['Row'];

export interface AuthenticatedUserContext {
  user: {
    id: string;
    email?: string;
  };
  profile: ProfileRecord;
}

export interface AuthenticatedStudentContext extends AuthenticatedUserContext {
  student: StudentRecord;
}

export interface AuthenticatedAdminContext extends AuthenticatedUserContext {
  admin: AdminRecord;
}

/**
 * Retrieves the current session user and database profile without redirecting.
 * Returns null if unauthenticated or invalid.
 */
export async function getCurrentUser(): Promise<AuthenticatedUserContext | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    // Fetch authorized profile from public.profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
    };
  } catch {
    return null;
  }
}

/**
 * Requires an authenticated user with an active profile.
 * Fails closed by redirecting unauthenticated users to the login screen.
 */
export async function requireAuthenticatedUser(
  locale: Locale = 'ar',
  redirectTo?: string
): Promise<AuthenticatedUserContext> {
  const context = await getCurrentUser();

  if (!context) {
    const query = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : '';
    redirect(`/${locale}/login${query}`);
  }

  return context;
}

/**
 * Requires an authenticated user with the 'STUDENT' role and active student record.
 * Fails closed: redirects unauthenticated users to login, and admins to admin dashboard.
 */
export async function requireStudent(
  locale: Locale = 'ar',
  currentPath?: string
): Promise<AuthenticatedStudentContext> {
  const context = await requireAuthenticatedUser(locale, currentPath);

  // Cross-role boundary protection
  if (context.profile.role !== 'STUDENT') {
    await logUnauthorizedAccess({
      userId: context.user.id,
      actualRole: context.profile.role,
      attemptedPath: currentPath || `/${locale}/student/*`,
      reason: 'Non-student role attempted student boundary access',
    });
    redirect(`/${locale}/admin/dashboard`);
  }

  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', context.user.id)
    .single();

  if (error || !student) {
    // Fails closed if student record does not exist
    redirect(`/${locale}/login?error=student_record_missing`);
  }

  return {
    ...context,
    student,
  };
}

/**
 * Requires an authenticated user with 'ADMIN' or 'SUPER_ADMIN' role.
 * Fails closed: redirects unauthenticated users to login, and students to student dashboard.
 */
export async function requireAdmin(
  locale: Locale = 'ar',
  currentPath?: string
): Promise<AuthenticatedAdminContext> {
  const context = await requireAuthenticatedUser(locale, currentPath);

  // Cross-role boundary protection
  if (context.profile.role !== 'ADMIN' && context.profile.role !== 'SUPER_ADMIN') {
    await logUnauthorizedAccess({
      userId: context.user.id,
      actualRole: context.profile.role,
      attemptedPath: currentPath || `/${locale}/admin/*`,
      reason: 'Student role attempted administrative boundary access',
    });
    redirect(`/${locale}/student/dashboard`);
  }

  const supabase = await createClient();
  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('id', context.user.id)
    .single();

  if (error || !admin) {
    // Fails closed if admin record does not exist
    redirect(`/${locale}/login?error=admin_record_missing`);
  }

  return {
    ...context,
    admin,
  };
}

/**
 * Requires an authenticated administrator with explicit void privileges.
 * Respects admins.can_void_payments and SUPER_ADMIN role.
 */
export async function requireAdminWithVoidPermission(
  locale: Locale = 'ar'
): Promise<AuthenticatedAdminContext> {
  const context = await requireAdmin(locale);

  const hasVoidPermission =
    context.profile.role === 'SUPER_ADMIN' || context.admin.can_void_payments === true;

  if (!hasVoidPermission) {
    throw new Error('FORBIDDEN: Administrator lacks permissions to void or cancel financial records.');
  }

  return context;
}
