import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database.types';

type UserRole = Database['public']['Enums']['user_role'];
type Json = Database['public']['Tables']['audit_logs']['Row']['before_state'];

export interface AuditLogEntry {
  actorId?: string | null;
  actorRole?: UserRole | null;
  action: string;
  entityName: string;
  entityId: string;
  beforeState?: Json;
  afterState?: Json;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Structured audit logging for security and financial audit trails.
 * Logs to standard output (structured JSON) and persists to public.audit_logs via privileged admin client.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  const structuredLog = {
    timestamp,
    level: 'AUDIT',
    ...entry,
  };

  // 1. Structured Server Console Output
  console.info(`[AUDIT_EVENT] ${JSON.stringify(structuredLog)}`);

  // 2. Persist to Supabase Database (Fail-safe: does not interrupt caller if DB unavailable)
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('audit_logs').insert({
      actor_id: entry.actorId || null,
      actor_role: entry.actorRole || null,
      action: entry.action,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      before_state: entry.beforeState || null,
      after_state: entry.afterState || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    });

    if (error) {
      console.warn(`[AUDIT_WARNING] Failed to persist audit log to database: ${error.message}`);
    }
  } catch (err) {
    console.warn('[AUDIT_WARNING] Audit log persistence skipped or failed:', err);
  }
}

/**
 * Specialized logger for successful authentication events.
 */
export async function logAuthSuccess(params: {
  userId: string;
  email: string;
  role: UserRole;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.userId,
    actorRole: params.role,
    action: 'AUTH_LOGIN_SUCCESS',
    entityName: 'profiles',
    entityId: params.userId,
    afterState: {
      email: params.email,
      role: params.role,
      login_time: new Date().toISOString(),
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Specialized logger for failed authentication attempts.
 */
export async function logAuthFailure(params: {
  identifier: string;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await logAuditEvent({
    actorId: null,
    actorRole: null,
    action: 'AUTH_LOGIN_FAILED',
    entityName: 'auth_attempt',
    entityId: params.identifier,
    afterState: {
      attempted_identifier: params.identifier,
      failure_reason: params.reason,
      attempt_time: new Date().toISOString(),
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Specialized logger for user sign out.
 */
export async function logAuthLogout(params: {
  userId: string;
  role?: UserRole | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.userId,
    actorRole: params.role || null,
    action: 'AUTH_LOGOUT',
    entityName: 'profiles',
    entityId: params.userId,
    afterState: {
      logout_time: new Date().toISOString(),
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Specialized logger for unauthorized boundary access attempts (cross-role violations).
 */
export async function logUnauthorizedAccess(params: {
  userId: string;
  actualRole: UserRole;
  attemptedPath: string;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.userId,
    actorRole: params.actualRole,
    action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    entityName: 'route_guard',
    entityId: params.attemptedPath,
    beforeState: {
      user_id: params.userId,
      user_role: params.actualRole,
    },
    afterState: {
      attempted_path: params.attemptedPath,
      rejection_reason: params.reason,
      timestamp: new Date().toISOString(),
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}
