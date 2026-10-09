import 'server-only';
import type { Database } from '@/types/database.types';

export type UserRole = Database['public']['Enums']['user_role'];

export interface VoidCallerProfile {
  id: string;
  role: UserRole | string;
  is_active: boolean;
}

export interface VoidCallerAdmin {
  id: string;
  can_void_payments: boolean;
}

export interface VoidCallerAuthorizationInput {
  authUid?: string | null;
  adminId: string;
  profile?: VoidCallerProfile | null;
  adminRecord?: VoidCallerAdmin | null;
}

export interface VoidCallerAuthorizationResult {
  authorized: boolean;
  errorCode?: 'UNAUTHORIZED' | 'FORBIDDEN_NOT_ADMIN' | 'FORBIDDEN_NO_VOID_PERMISSION';
  errorMessage?: string;
}

/**
 * Pure helper modeling the database-level authorization invariants of public.void_transaction_atomic.
 *
 * Invariants enforced:
 * 1. Anti-Spoofing: If auth.uid() is provided, it must match p_admin_id.
 * 2. Active Administrative Account: The caller must exist in public.profiles with is_active = true,
 *    exist in public.admins, and possess role IN ('ADMIN', 'SUPER_ADMIN'). A profile with role 'STUDENT'
 *    must be strictly rejected even if a row in public.admins has can_void_payments = true.
 * 3. Void Permission: The admin must have can_void_payments = true.
 */
export function evaluateVoidCallerAuthorization(
  input: VoidCallerAuthorizationInput
): VoidCallerAuthorizationResult {
  // 1. Anti-spoofing check: auth.uid() vs p_admin_id
  if (input.authUid != null && input.authUid !== input.adminId) {
    return {
      authorized: false,
      errorCode: 'UNAUTHORIZED',
      errorMessage: `UNAUTHORIZED: Authenticated caller (${input.authUid}) does not match specified admin_id (${input.adminId})`,
    };
  }

  // 2. Query simulation:
  // SELECT a.can_void_payments, p.role INTO v_can_void, v_caller_role
  // FROM public.admins a
  // JOIN public.profiles p ON p.id = a.id
  // WHERE a.id = p_admin_id AND p.is_active = TRUE;
  const profileMatches = input.profile != null && input.profile.id === input.adminId;
  const adminMatches = input.adminRecord != null && input.adminRecord.id === input.adminId;
  const isActive = input.profile?.is_active === true;

  if (!profileMatches || !adminMatches || !isActive) {
    return {
      authorized: false,
      errorCode: 'FORBIDDEN_NOT_ADMIN',
      errorMessage: `FORBIDDEN: Caller (${input.adminId}) is not an active authorized administrator`,
    };
  }

  const role = input.profile!.role;
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return {
      authorized: false,
      errorCode: 'FORBIDDEN_NOT_ADMIN',
      errorMessage: `FORBIDDEN: Caller (${input.adminId}) is not an active authorized administrator`,
    };
  }

  // 3. Void permission check
  if (input.adminRecord!.can_void_payments !== true) {
    return {
      authorized: false,
      errorCode: 'FORBIDDEN_NO_VOID_PERMISSION',
      errorMessage: `FORBIDDEN: Administrator (${input.adminId}) does not possess void permissions`,
    };
  }

  return { authorized: true };
}
