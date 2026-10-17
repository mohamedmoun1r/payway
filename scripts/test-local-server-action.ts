/**
 * Automated Local Supabase Integration Test: recordManualPaymentAction Server Action
 * Repository: PayWay (Cairo University Faculty of Engineering)
 *
 * SAFETY INVARIANTS:
 * 1. Strictly bound to localhost / 127.0.0.1. Rejects execution on any external host.
 * 2. Zero production credentials, tokens, or secrets used or logged.
 * 3. Exercises real server action logic without modifying application source code.
 * 4. Verifies authentication, input validation, HMAC signing, atomic execution,
 *    idempotency replay/conflict, and database error mapping.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

// =============================================================================
// 0. ENVIRONMENT & SAFETY PRECONDITIONS
// =============================================================================
const LOCAL_SUPABASE_URL = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE_ROLE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const LOCAL_HMAC_SECRET = process.env.RECEIPT_HMAC_SECRET || 'local-test-receipt-signing-secret-key-32chars';

// Project Continuity Target Configuration
const EXPECTED_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'payway';
const DB_CONTAINER_NAME = process.env.SUPABASE_DB_CONTAINER || `supabase_db_${EXPECTED_PROJECT_ID}`;
const KONG_CONTAINER_NAME = process.env.SUPABASE_KONG_CONTAINER || `supabase_kong_${EXPECTED_PROJECT_ID}`;

// Mandatory Hostname Validation
const parsedUrl = new URL(LOCAL_SUPABASE_URL);
if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
  console.error(`FATAL SAFETY VIOLATION: Refusing to run tests against non-local host: ${parsedUrl.hostname}`);
  process.exit(1);
}

// Set runtime environment variables for server action
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
process.env.RECEIPT_HMAC_SECRET = LOCAL_HMAC_SECRET;

// =============================================================================
// 1. IN-MEMORY NEXT.JS ENVIRONMENT HARNESS
// =============================================================================
// Backing cookie store simulating Next.js request cookies
const cookieMap = new Map<string, string>();
const cookieStore = {
  getAll: () => Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value })),
  set: (name: string, value: string) => {
    cookieMap.set(name, value);
  },
  get: (name: string) => (cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined),
  delete: (name: string) => {
    cookieMap.delete(name);
  },
};

export const revalidatedPaths: string[] = [];

// Mock next/headers
interface CacheEntry {
  id: string;
  filename: string;
  loaded: boolean;
  exports: unknown;
}
const modCache = require.cache as unknown as Record<string, CacheEntry>;

const nextHeadersPath = require.resolve('next/headers');
modCache[nextHeadersPath] = {
  id: nextHeadersPath,
  filename: nextHeadersPath,
  loaded: true,
  exports: {
    cookies: async () => cookieStore,
    headers: async () => new Headers(),
  },
};

// Mock next/cache
const nextCachePath = require.resolve('next/cache');
modCache[nextCachePath] = {
  id: nextCachePath,
  filename: nextCachePath,
  loaded: true,
  exports: {
    revalidatePath: (p: string) => {
      revalidatedPaths.push(p);
    },
    revalidateTag: () => {},
  },
};

// Direct Supabase clients for session management and database state inspection
const ssrAuthClient = createServerClient<Database>(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
  cookies: {
    getAll: () => cookieStore.getAll(),
    setAll: (list) => list.forEach((c) => cookieStore.set(c.name, c.value)),
  },
});

const adminDbClient = createSupabaseClient<Database>(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Session Management Helpers
function clearSession(): void {
  cookieMap.clear();
  revalidatedPaths.length = 0;
}

async function loginAsCashier(): Promise<void> {
  clearSession();
  const { data, error } = await ssrAuthClient.auth.signInWithPassword({
    email: 'admin.cashier@eng.cu.edu.eg',
    password: 'demo123456',
  });
  if (error || !data.session) {
    throw new Error(`Failed to log in as Cashier Admin: ${error?.message}`);
  }
}

async function loginAsStudent(): Promise<void> {
  clearSession();
  const { data, error } = await ssrAuthClient.auth.signInWithPassword({
    email: 'demo.student1@eng.cu.edu.eg',
    password: 'demo123456',
  });
  if (error || !data.session) {
    throw new Error(`Failed to log in as Student: ${error?.message}`);
  }
}

// =============================================================================
// DATABASE STATE VERIFICATION, RESTORATION & SCOPED CLEANUP (LOCAL DOCKER ONLY)
// =============================================================================

/**
 * Verifies that:
 * 1. LOCAL_SUPABASE_URL is strictly localhost or 127.0.0.1.
 * 2. PostgreSQL container (DB_CONTAINER_NAME) is running and belongs to the expected project.
 * 3. Kong API Gateway container (KONG_CONTAINER_NAME) is running, belongs to the expected project,
 *    and its mapped host port matches LOCAL_SUPABASE_URL's port.
 *
 * Fails closed if any target requirement cannot be established.
 */
function verifyLocalSupabaseTarget(): void {
  const parsed = new URL(LOCAL_SUPABASE_URL);
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error(`SECURITY FATAL: Refusing to run tests against non-local host: ${parsed.hostname}`);
  }

  const expectedPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

  try {
    // 1. Inspect PostgreSQL container
    const dbRaw = execSync(`docker inspect ${DB_CONTAINER_NAME}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    const dbInfo = JSON.parse(dbRaw)[0];
    if (!dbInfo?.State?.Running) {
      throw new Error(`PostgreSQL container "${DB_CONTAINER_NAME}" is not running`);
    }

    const dbProject =
      dbInfo.Config?.Labels?.['com.supabase.cli.project'] ||
      dbInfo.Config?.Labels?.['com.docker.compose.project'];
    if (dbProject && dbProject !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `PostgreSQL container "${DB_CONTAINER_NAME}" belongs to project "${dbProject}", expected "${EXPECTED_PROJECT_ID}"`
      );
    }

    // 2. Inspect Kong API Gateway container
    const kongRaw = execSync(`docker inspect ${KONG_CONTAINER_NAME}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    const kongInfo = JSON.parse(kongRaw)[0];
    if (!kongInfo?.State?.Running) {
      throw new Error(`Kong API Gateway container "${KONG_CONTAINER_NAME}" is not running`);
    }

    const kongProject =
      kongInfo.Config?.Labels?.['com.supabase.cli.project'] ||
      kongInfo.Config?.Labels?.['com.docker.compose.project'];
    if (kongProject && kongProject !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `Kong container "${KONG_CONTAINER_NAME}" belongs to project "${kongProject}", expected "${EXPECTED_PROJECT_ID}"`
      );
    }

    const portBindings = kongInfo.NetworkSettings?.Ports?.['8000/tcp'] as
      | Array<{ HostIp: string; HostPort: string }>
      | undefined;
    const boundPorts = portBindings?.map((b) => b.HostPort) || [];
    if (!boundPorts.includes(expectedPort)) {
      throw new Error(
        `Kong container "${KONG_CONTAINER_NAME}" port mapping (${boundPorts.join(', ')}) does not match test HTTP endpoint port "${expectedPort}" (${LOCAL_SUPABASE_URL})`
      );
    }

    console.log(
      `[SAFETY CHECK] Local Supabase project continuity verified: HTTP endpoint (${LOCAL_SUPABASE_URL}) and PostgreSQL container (${DB_CONTAINER_NAME}) belong to project "${EXPECTED_PROJECT_ID}".`
    );
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    throw new Error(`FATAL: Local Supabase project continuity verification failed: ${errorDetails}`);
  }
}

/**
 * Verifies that the seeded student's due row is in its canonical pristine baseline state:
 * original_amount: 15000.00, discount_amount: 0.00, paid_amount: 0.00, status: 'UNPAID'.
 * Fails closed immediately if it differs, preventing silent overwrites or testing on dirty state.
 */
async function verifySeededStudentDueBaseline(dueId: string): Promise<void> {
  const { data: due, error } = await adminDbClient
    .from('student_dues')
    .select('id, original_amount, discount_amount, paid_amount, status')
    .eq('id', dueId)
    .single();

  if (error || !due) {
    throw new Error(`FATAL: Could not fetch seeded student due ${dueId}: ${error?.message}`);
  }

  const original = Number(due.original_amount);
  const discount = Number(due.discount_amount);
  const paid = Number(due.paid_amount);
  const status = due.status;

  if (original !== 15000 || discount !== 0 || paid !== 0 || status !== 'UNPAID') {
    throw new Error(
      `FATAL BASELINE VIOLATION: Seeded student due ${dueId} is not in pristine baseline state! ` +
        `Expected: original=15000.00, discount=0.00, paid=0.00, status='UNPAID'. ` +
        `Actual: original=${original}, discount=${discount}, paid=${paid}, status='${status}'. ` +
        `Refusing to proceed to prevent overwriting or testing against unexpected financial state. ` +
        `Please reset the local database using 'supabase db reset'.`
    );
  }

  console.log(`[SAFETY CHECK] Seeded student due baseline verified for ${dueId}: pristine (15000/0/0/UNPAID).`);
}

/**
 * Conditionally reverts the exact payment amount applied to the seeded student due row.
 * Checks in PostgreSQL whether a transaction was committed under this test run's idempotency key.
 * If committed, uses an atomic conditional UPDATE with strict WHERE predicates and verifies exactly 1 row was updated.
 * Guarantees that:
 * 1. Even if an exception occurred before Node.js could assign committedTxnId, the committed payment is safely reverted.
 * 2. If no payment was committed, student_dues remains untouched.
 * 3. Concurrent or unrelated changes cannot be overwritten.
 */
function revertSeededStudentDue(dueId: string, amountToRevert: number, testIdemKey: string): void {
  const targetHost = new URL(LOCAL_SUPABASE_URL).hostname;
  if (targetHost !== 'localhost' && targetHost !== '127.0.0.1') {
    throw new Error(`SECURITY FATAL: Refusing database operations on non-local host: ${targetHost}`);
  }

  const sqlRevert = `
    DO $$
    DECLARE
      v_has_committed_txn BOOLEAN;
      v_rows INTEGER;
    BEGIN
      -- Verify if a payment transaction was actually committed under this test run's idempotency key
      SELECT EXISTS (
        SELECT 1 FROM public.transactions WHERE idempotency_key = '${testIdemKey}'
      ) INTO v_has_committed_txn;

      IF v_has_committed_txn THEN
        UPDATE public.student_dues
        SET paid_amount = paid_amount - ${amountToRevert.toFixed(2)},
            status = 'UNPAID',
            updated_at = NOW()
        WHERE id = '${dueId}'
          AND paid_amount = ${amountToRevert.toFixed(2)}
          AND status = 'PARTIALLY_PAID';

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
          RAISE EXCEPTION 'Conditional student_dues restoration failed: expected 1 row affected, got %', v_rows;
        END IF;
      END IF;
    END $$;
  `;

  try {
    execSync(`docker exec -i ${DB_CONTAINER_NAME} psql -U postgres -d postgres -v ON_ERROR_STOP=1`, {
      input: sqlRevert,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to conditionally revert student_dues row ${dueId}: ${errorDetails}`);
  }
}

function cleanLocalFixtures(unauthAuditId?: number | null, testTxnId?: string | null): void {
  // Safety Invariant: NEVER run if target is not localhost / 127.0.0.1
  const targetHost = new URL(LOCAL_SUPABASE_URL).hostname;
  if (targetHost !== 'localhost' && targetHost !== '127.0.0.1') {
    throw new Error(`SECURITY FATAL: Refusing database cleanup on non-local host: ${targetHost}`);
  }

  // Validate unauthAuditId format if provided to prevent SQL injection
  const safeUnauthAuditId =
    typeof unauthAuditId === 'number' && Number.isInteger(unauthAuditId) && unauthAuditId > 0
      ? unauthAuditId
      : null;

  // Validate testTxnId UUID format if provided to prevent SQL injection
  const safeTestTxnId =
    typeof testTxnId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testTxnId)
      ? testTxnId
      : null;

  const sqlCleanup = `
    -- Wrap in transaction with SET LOCAL to guarantee automatic restoration to origin
    BEGIN;
    SET LOCAL session_replication_role = 'replica';

    -- 1. Delete test payment audit entries strictly referencing test transactions BEFORE deleting transactions
    DELETE FROM public.audit_logs
    WHERE action = 'PAYMENT_RECORDED'
      AND entity_name = 'transactions'
      AND (
        ${safeTestTxnId !== null ? `entity_id = '${safeTestTxnId}' OR ` : ''}
        entity_id IN (
          SELECT id::text FROM public.transactions
          WHERE idempotency_key LIKE 'ACTION-PAY-E2E-%'
        )
      );

    -- 2. Delete test receipts linked strictly to test-owned transactions or matching unique test reference prefix
    DELETE FROM public.receipts
    WHERE (
      ${safeTestTxnId !== null ? `transaction_id = '${safeTestTxnId}'::uuid OR ` : ''}
      metadata->>'reference_number' LIKE 'REF-ACTION-E2E-%' OR
      transaction_id IN (
        SELECT id FROM public.transactions
        WHERE idempotency_key LIKE 'ACTION-PAY-E2E-%'
      )
    );

    -- 3. Delete test transactions strictly matching test idempotency prefix or captured test txn id
    DELETE FROM public.transactions
    WHERE (
      ${safeTestTxnId !== null ? `id = '${safeTestTxnId}'::uuid OR ` : ''}
      idempotency_key LIKE 'ACTION-PAY-E2E-%'
    );

    -- 4. Delete only the specific unauthorized access attempt audit log created in this test run (if captured)
    ${safeUnauthAuditId !== null ? `DELETE FROM public.audit_logs WHERE id = ${safeUnauthAuditId};` : ''}

    COMMIT;

    -- Explicit failsafe restoration outside transaction
    SET session_replication_role = 'origin';

    -- 5. Sanitize auth.users tokens for GoTrue signInWithPassword compatibility
    UPDATE auth.users
    SET confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, '')
    WHERE confirmation_token IS NULL
       OR recovery_token IS NULL
       OR email_change_token_new IS NULL
       OR email_change IS NULL;

    -- 6. Enforce Migration 5 RPC permissions on record_manual_payment_atomic
    REVOKE EXECUTE ON FUNCTION public.record_manual_payment_atomic(UUID, UUID, NUMERIC, public.payment_method, DATE, TIME, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR) FROM authenticated, anon;
    GRANT EXECUTE ON FUNCTION public.record_manual_payment_atomic(UUID, UUID, NUMERIC, public.payment_method, DATE, TIME, VARCHAR, TEXT, UUID, VARCHAR, VARCHAR) TO service_role;
  `;

  try {
    execSync(`docker exec -i ${DB_CONTAINER_NAME} psql -U postgres -d postgres -v ON_ERROR_STOP=1`, {
      input: sqlCleanup,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    console.error(`[CLEANUP / STATE INITIALIZATION ERROR] Docker psql execution failed: ${errorDetails}`);
    throw new Error(`Failed to ensure clean local database state: ${errorDetails}`);
  }
}

// =============================================================================
// TEST SUITE DEFINITIONS
// =============================================================================
interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runActionTestSuite(): Promise<void> {
  console.log('=============================================================================');
  console.log('PAYWAY LOCAL SERVER ACTION INTEGRATION TEST SUITE');
  console.log('Target: recordManualPaymentAction against Local Supabase Stack');
  console.log(`Endpoint: ${LOCAL_SUPABASE_URL} (Verified Localhost)`);
  console.log('=============================================================================\n');

  // Pre-Flight: Ensure stale test fixture manifest from previous runs is purged
  const manifestPath = path.join(process.cwd(), '.temp', 'test-fixtures.json');
  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
    console.log('[PRE-FLIGHT] Removed stale test fixtures manifest (.temp/test-fixtures.json).');
  }

  // Step 0: Pre-flight continuity verification between HTTP endpoint and PostgreSQL container
  console.log('[PRE-FLIGHT] Verifying project continuity between HTTP endpoint and PostgreSQL container...');
  verifyLocalSupabaseTarget();

  // Step 1: Pre-flight state initialization & cleanup of leftover test fixtures
  console.log('[PRE-FLIGHT] Initializing clean database state and removing any stale fixtures...');
  cleanLocalFixtures();

  // Step 2: Pre-flight verification of seeded student financial baseline
  const SEEDED_STUDENT_DUE_ID = 'd3333333-0000-0000-0000-000000000001';
  console.log('[PRE-FLIGHT] Verifying seeded student financial baseline...');
  await verifySeededStudentDueBaseline(SEEDED_STUDENT_DUE_ID);
  console.log('[PRE-FLIGHT] Database state confirmed clean and ready.\n');

  // Test Fixtures & Shared State
  const STUDENT_3_ID = '00000000-0000-0000-0000-000000000013'; // Demo Student 3 (Unpaid)
  const SEMESTER_ID = '11111111-1111-1111-1111-111111111111'; // Fall 2026/2027
  const paymentAmount = 2500.0;
  const validIdemKey = `ACTION-PAY-E2E-${Date.now()}`;
  const validRefNumber = `REF-ACTION-E2E-${Date.now()}`;
  let committedTxnId = '';
  let committedReceiptId = '';
  let committedReceiptNumber = '';
  let committedTxnNumber = '';
  let unauthAuditLogId: number | null = null;

  try {
    // Import the real server action after the mocks and environment are set up
    const { recordManualPaymentAction } = await import('../src/lib/actions/payment.actions');

    // ---------------------------------------------------------------------------
    // TEST 1: Unauthenticated Caller Rejection
    // ---------------------------------------------------------------------------
    try {
      clearSession(); // Empty cookies
    const result = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: 500,
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '10:00:00',
        referenceNumber: 'UNAUTH-REF',
        notes: 'Probe unauthenticated',
        idempotencyKey: `UNAUTH-${Date.now()}`,
      },
      'ar'
    );

    const isRejected =
      result.success === false &&
      (result.error?.includes('غير مصرح') || result.error?.includes('Unauthorized'));

    results.push({
      name: 'Authentication Guard: Unauthenticated caller strictly rejected',
      passed: !!isRejected,
      details: isRejected
        ? `Rejected with expected error: "${result.error}"`
        : `Unexpected success: ${JSON.stringify(result)}`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Authentication Guard: Unauthenticated caller strictly rejected',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Cross-Role Boundary Protection (Student Session Rejection)
  // ---------------------------------------------------------------------------
  try {
    await loginAsStudent(); // Student 1 authenticated session

    // Snapshot existing unauthorized access audit log IDs before invoking the guarded action
    const { data: preExistingLogs, error: preErr } = await adminDbClient
      .from('audit_logs')
      .select('id')
      .eq('action', 'UNAUTHORIZED_ACCESS_ATTEMPT')
      .eq('entity_name', 'route_guard')
      .eq('entity_id', '/en/admin/payments')
      .eq('actor_id', '00000000-0000-0000-0000-000000000011');

    if (preErr) {
      throw new Error(`Failed to query pre-existing audit logs: ${preErr.message}`);
    }

    const preExistingIds = new Set((preExistingLogs || []).map((row) => row.id));

    const result = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: 500,
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '10:05:00',
        referenceNumber: 'STUDENT-PROBE-REF',
        notes: 'Probe student caller',
        idempotencyKey: `STUDENT-PROBE-${Date.now()}`,
      },
      'en'
    );

    const isRejected =
      result.success === false &&
      result.error?.includes('Unauthorized: Active authorized administrator session required');

    // Query audit logs post-call to correlate the exact test-owned row
    const { data: postLogs, error: postErr } = await adminDbClient
      .from('audit_logs')
      .select('id, action, entity_name, entity_id, actor_id, created_at')
      .eq('action', 'UNAUTHORIZED_ACCESS_ATTEMPT')
      .eq('entity_name', 'route_guard')
      .eq('entity_id', '/en/admin/payments')
      .eq('actor_id', '00000000-0000-0000-0000-000000000011');

    if (postErr) {
      throw new Error(`Failed to query post-test audit logs: ${postErr.message}`);
    }

    const newlyCreated = (postLogs || []).filter((row) => !preExistingIds.has(row.id));

    if (newlyCreated.length === 0) {
      throw new Error('Expected 1 security audit log for unauthorized access attempt, but found 0');
    } else if (newlyCreated.length > 1) {
      throw new Error(
        `Ambiguous unauthorized audit logs detected: expected exactly 1 new record, found ${newlyCreated.length} ` +
          `(ids: ${newlyCreated.map((r) => r.id).join(', ')}). Failing safely to avoid deleting ambiguous records under concurrency.`
      );
    }

    unauthAuditLogId = newlyCreated[0].id;
    const auditLogged = unauthAuditLogId !== null;

    results.push({
      name: 'Authorization Guard: Student session rejected from administrative action',
      passed: !!(isRejected && auditLogged),
      details: `Action rejected with: "${result.error}". Security audit log recorded: ${auditLogged} (id: ${unauthAuditLogId !== null ? unauthAuditLogId : 'none'}).`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Authorization Guard: Student session rejected from administrative action',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Zod Schema Input Validation (Fail-Fast Pre-Database Checks)
  // ---------------------------------------------------------------------------
  try {
    await loginAsCashier();

    // 3a: Negative amount
    const negativeRes = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: -250,
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '10:10:00',
        referenceNumber: 'NEG-REF',
        notes: null,
        idempotencyKey: `NEG-${Date.now()}`,
      },
      'ar'
    );

    // 3b: Empty studentId
    const emptyStudentRes = await recordManualPaymentAction(
      {
        studentId: '',
        semesterId: SEMESTER_ID,
        amount: 500,
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '10:10:00',
        referenceNumber: 'EMPTY-REF',
        notes: null,
        idempotencyKey: `EMPTY-${Date.now()}`,
      },
      'en'
    );

    // 3c: Invalid payment method
    const invalidMethodRes = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: 500,
        paymentMethod: 'CRYPTO' as unknown as Database['public']['Enums']['payment_method'],
        paymentDate: '2026-10-14',
        paymentTime: '10:10:00',
        referenceNumber: 'BAD-METHOD-REF',
        notes: null,
        idempotencyKey: `BAD-METHOD-${Date.now()}`,
      },
      'en'
    );

    const validationPassed =
      negativeRes.success === false &&
      !!negativeRes.fieldErrors?.amount &&
      emptyStudentRes.success === false &&
      !!emptyStudentRes.fieldErrors?.studentId &&
      invalidMethodRes.success === false &&
      !!invalidMethodRes.fieldErrors?.paymentMethod;

    results.push({
      name: 'Input Validation: Zod schema blocks negative amounts, missing IDs, and invalid methods',
      passed: validationPassed,
      details: `Negative amount rejected: ${!!negativeRes.fieldErrors?.amount}. Missing student rejected: ${!!emptyStudentRes.fieldErrors?.studentId}. Invalid method rejected: ${!!invalidMethodRes.fieldErrors?.paymentMethod}.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Input Validation: Zod schema blocks negative amounts, missing IDs, and invalid methods',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Successful Manual Payment via Server Action (End-to-End Flow)
  // ---------------------------------------------------------------------------
  try {
    await loginAsCashier();
    revalidatedPaths.length = 0;

    // Fetch initial balance
    const { data: beforeDue } = await adminDbClient
      .from('student_dues')
      .select('original_amount, discount_amount, paid_amount')
      .eq('student_id', STUDENT_3_ID)
      .eq('semester_id', SEMESTER_ID)
      .single();

    const initialRemaining =
      Number(beforeDue!.original_amount) - Number(beforeDue!.discount_amount) - Number(beforeDue!.paid_amount);

    const actionRes = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: paymentAmount,
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '11:00:00',
        referenceNumber: validRefNumber,
        notes: 'End-to-end server action verification',
        idempotencyKey: validIdemKey,
      },
      'ar'
    );

    if (!actionRes.success || !actionRes.data) {
      throw new Error(`Action failed unexpectedly: ${actionRes.error}`);
    }

    const payload = actionRes.data;
    committedTxnId = payload.transactionId;
    committedReceiptId = payload.receiptId;
    committedTxnNumber = payload.transactionNumber;
    committedReceiptNumber = payload.receiptNumber;

    const expectedNewRemaining = initialRemaining - paymentAmount;

    const dataIntegrityPassed =
      payload.amount === paymentAmount &&
      payload.newRemainingBalance === expectedNewRemaining &&
      payload.paymentMethod === 'CASH' &&
      payload.status === 'COMPLETED' &&
      payload.isDuplicate === false &&
      payload.studentNumber === 'DEMO-100003' &&
      payload.studentNameAr.length > 0 &&
      payload.studentNameEn.length > 0;

    const cacheRevalidated =
      revalidatedPaths.includes('/ar/admin/payments') &&
      revalidatedPaths.includes('/ar/admin/students') &&
      revalidatedPaths.includes('/ar/admin/dashboard') &&
      revalidatedPaths.includes('/ar/student/dashboard') &&
      revalidatedPaths.includes('/ar/student/transactions');

    results.push({
      name: 'Server Action Execution: Valid payment successfully commits and revalidates views',
      passed: dataIntegrityPassed && cacheRevalidated,
      details: `Txn #${committedTxnNumber}, Receipt #${committedReceiptNumber}. Remaining balance: ${payload.newRemainingBalance} EGP. Revalidated ${revalidatedPaths.length} cache paths.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Server Action Execution: Valid payment successfully commits and revalidates views',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Multi-Table Database Consistency Verification
  // ---------------------------------------------------------------------------
  try {
    // 5a. transactions table
    const { data: txnRow, error: txnErr } = await adminDbClient
      .from('transactions')
      .select('id, status, amount, payment_method, student_id, semester_id, idempotency_key')
      .eq('id', committedTxnId)
      .single();

    if (txnErr || !txnRow || txnRow.status !== 'COMPLETED' || Number(txnRow.amount) !== paymentAmount) {
      throw new Error(`Transactions table inconsistency: ${JSON.stringify(txnRow)}`);
    }

    // 5b. receipts table
    const { data: rcpRow, error: rcpErr } = await adminDbClient
      .from('receipts')
      .select('id, receipt_number, total_amount, verification_hash')
      .eq('id', committedReceiptId)
      .single();

    if (rcpErr || !rcpRow || Number(rcpRow.total_amount) !== paymentAmount || !rcpRow.verification_hash) {
      throw new Error(`Receipts table inconsistency: ${JSON.stringify(rcpRow)}`);
    }

    // 5c. student_dues table
    const { data: dueRow, error: dueErr } = await adminDbClient
      .from('student_dues')
      .select('paid_amount, status')
      .eq('student_id', STUDENT_3_ID)
      .eq('semester_id', SEMESTER_ID)
      .single();

    if (dueErr || !dueRow || Number(dueRow.paid_amount) < paymentAmount) {
      throw new Error(`Student dues table inconsistency: ${JSON.stringify(dueRow)}`);
    }

    // 5d. audit_logs table
    const { data: auditRow, error: auditErr } = await adminDbClient
      .from('audit_logs')
      .select('id, action, entity_name, entity_id')
      .eq('entity_name', 'transactions')
      .eq('entity_id', committedTxnId)
      .single();

    if (auditErr || !auditRow || auditRow.action !== 'PAYMENT_RECORDED') {
      throw new Error(`Audit logs table inconsistency: ${JSON.stringify(auditRow)}`);
    }

    results.push({
      name: 'Multi-Table Consistency: PostgreSQL state matches across transactions, receipts, dues, audit_logs',
      passed: true,
      details: `Verified: transactions (COMPLETED), receipts (hashed), student_dues (paid: ${dueRow.paid_amount} EGP), audit_logs (PAYMENT_RECORDED).`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Multi-Table Consistency: PostgreSQL state matches across transactions, receipts, dues, audit_logs',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Server-Side HMAC Receipt Verification (Public Proof)
  // ---------------------------------------------------------------------------
  try {
    const { data: rcpRow } = await adminDbClient
      .from('receipts')
      .select('verification_hash')
      .eq('id', committedReceiptId)
      .single();

    const { data: verifyData, error: verifyErr } = await adminDbClient.rpc('verify_receipt_public', {
      p_verification_hash: rcpRow!.verification_hash,
    });

    if (verifyErr || !verifyData || verifyData.length === 0) {
      throw new Error(`Verification RPC failed: ${verifyErr?.message}`);
    }

    const verification = verifyData[0];
    const isPublicValid =
      verification.is_valid === true &&
      verification.receipt_number === committedReceiptNumber &&
      Number(verification.amount) === paymentAmount &&
      verification.currency === 'EGP' &&
      verification.payment_status === 'COMPLETED';

    // Verify ZERO student PII keys
    const piiKeys = ['student_id', 'student_name', 'national_id', 'phone', 'email', 'student_number'];
    const leakedKeys = Object.keys(verification).filter((k) => piiKeys.includes(k));

    if (!isPublicValid || leakedKeys.length > 0) {
      throw new Error(`Verification integrity failure. Leaked PII: ${leakedKeys.join(', ')}`);
    }

    results.push({
      name: 'HMAC Signing & Public Verification: Server-generated hash verified without leaking student PII',
      passed: true,
      details: `Receipt #${verification.receipt_number} valid for ${verification.amount} ${verification.currency}. Zero student PII exposed.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'HMAC Signing & Public Verification: Server-generated hash verified without leaking student PII',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Idempotency Protection — Identical Replay
  // ---------------------------------------------------------------------------
  try {
    await loginAsCashier();

    const countBefore = (await adminDbClient.from('transactions').select('*', { count: 'exact', head: true })).count;

    // Call server action with the exact same idempotency key and identical parameters
    const replayRes = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: paymentAmount,
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '11:00:00',
        referenceNumber: validRefNumber,
        notes: 'End-to-end server action verification',
        idempotencyKey: validIdemKey, // IDENTICAL KEY
      },
      'ar'
    );

    const countAfter = (await adminDbClient.from('transactions').select('*', { count: 'exact', head: true })).count;

    const isIdenticalReplay =
      replayRes.success === true &&
      replayRes.data?.isDuplicate === true &&
      replayRes.data?.transactionId === committedTxnId &&
      countBefore === countAfter; // Zero new transactions inserted

    results.push({
      name: 'Idempotency Protection: Identical replay safely resolved with isDuplicate=true and zero extra rows',
      passed: isIdenticalReplay,
      details: `Replay returned isDuplicate=true for Txn #${replayRes.data?.transactionNumber}. Transaction row count unchanged (${countBefore} -> ${countAfter}).`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Idempotency Protection: Identical replay safely resolved with isDuplicate=true and zero extra rows',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 8: Idempotency Conflict — Conflicting Parameter Replay
  // ---------------------------------------------------------------------------
  try {
    await loginAsCashier();

    // Call server action with the same key, but different amount ($9999)
    const conflictRes = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: 9999.0, // CONFLICTING AMOUNT
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '11:00:00',
        referenceNumber: validRefNumber,
        notes: null,
        idempotencyKey: validIdemKey,
      },
      'ar'
    );

    const isConflictCaught =
      conflictRes.success === false &&
      (conflictRes.error?.includes('تعارض في مفتاح منع التكرار') ?? false);

    results.push({
      name: 'Idempotency Protection: Conflicting parameters on reused key strictly rejected',
      passed: isConflictCaught,
      details: `Conflict caught with error: "${conflictRes.error}"`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Idempotency Protection: Conflicting parameters on reused key strictly rejected',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 9: Database Error Mapping — Overpayment
  // ---------------------------------------------------------------------------
  try {
    await loginAsCashier();

    const overpaymentRes = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: SEMESTER_ID,
        amount: 500000.0, // Massive overpayment
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '11:30:00',
        referenceNumber: 'OVERPAY-ACTION-REF',
        notes: null,
        idempotencyKey: `OVERPAY-ACTION-${Date.now()}`,
      },
      'ar'
    );

    const isOverpaymentHandled =
      overpaymentRes.success === false &&
      overpaymentRes.error === 'مبلغ السداد يتجاوز الرصيد المستحق على الطالب';

    results.push({
      name: 'Error Mapping: Database OVERPAYMENT error cleanly mapped to user-facing message',
      passed: isOverpaymentHandled,
      details: `Mapped to localized message: "${overpaymentRes.error}"`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Error Mapping: Database OVERPAYMENT error cleanly mapped to user-facing message',
      passed: false,
      error: errorMsg,
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 10: Database Error Mapping — Fee Record Not Found (DUE_NOT_FOUND)
  // ---------------------------------------------------------------------------
  try {
    await loginAsCashier();

    const missingDueRes = await recordManualPaymentAction(
      {
        studentId: STUDENT_3_ID,
        semesterId: '99999999-9999-9999-9999-999999999999', // Non-existent semester
        amount: 1000.0,
        paymentMethod: 'CASH',
        paymentDate: '2026-10-14',
        paymentTime: '11:35:00',
        referenceNumber: 'NO-DUE-REF',
        notes: null,
        idempotencyKey: `NO-DUE-${Date.now()}`,
      },
      'ar'
    );

    const isDueNotFoundHandled =
      missingDueRes.success === false &&
      missingDueRes.error === 'لم يتم العثور على مستحق مالي لهذا الطالب في الفصل الدراسي المحدد';

    results.push({
      name: 'Error Mapping: Database DUE_NOT_FOUND error cleanly mapped to user-facing message',
      passed: isDueNotFoundHandled,
      details: `Mapped to localized message: "${missingDueRes.error}"`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      name: 'Error Mapping: Database DUE_NOT_FOUND error cleanly mapped to user-facing message',
      passed: false,
      error: errorMsg,
    });
  }
  } finally {
    console.log('\n[TEARDOWN] Executing post-test fixture cleanup...');
    try {
      // 1. Resolve committed transaction ID and receipt ID if not already captured in JS
      if (!committedTxnId) {
        const { data: committedTxn } = await adminDbClient
          .from('transactions')
          .select('id, transaction_number')
          .eq('idempotency_key', validIdemKey)
          .maybeSingle();
        if (committedTxn?.id) {
          committedTxnId = committedTxn.id;
          committedTxnNumber = committedTxn.transaction_number;
        }
      }
      if (committedTxnId && !committedReceiptId) {
        const { data: committedRcp } = await adminDbClient
          .from('receipts')
          .select('id, receipt_number')
          .eq('transaction_id', committedTxnId)
          .maybeSingle();
        if (committedRcp?.id) {
          committedReceiptId = committedRcp.id;
          committedReceiptNumber = committedRcp.receipt_number;
        }
      }

      // 2. Validate all required test fixture identifiers were captured before proceeding with cleanup
      const missingRequiredIds: string[] = [];
      if (!committedTxnId) missingRequiredIds.push('transactionId');
      if (!committedReceiptId) missingRequiredIds.push('receiptId');
      if (!committedTxnNumber) missingRequiredIds.push('transactionNumber');
      if (!committedReceiptNumber) missingRequiredIds.push('receiptNumber');
      if (!validRefNumber) missingRequiredIds.push('referenceNumber');
      if (!unauthAuditLogId) missingRequiredIds.push('unauthAuditLogId');

      if (missingRequiredIds.length > 0) {
        throw new Error(
          `FATAL: Failed to capture all required test fixture identifiers before cleanup (missing: ${missingRequiredIds.join(', ')}). ` +
          `Refusing to proceed with cleanup to prevent deleting ambiguous or unowned records. ` +
          `Manual database inspection or reset ('supabase db reset') required.`
        );
      }

      // 3. Persist test fixture manifest for external / CI verification BEFORE deleting rows
      const fixturesManifest = {
        idempotencyKey: validIdemKey,
        transactionId: committedTxnId,
        receiptId: committedReceiptId,
        transactionNumber: committedTxnNumber,
        receiptNumber: committedReceiptNumber,
        referenceNumber: validRefNumber,
        unauthAuditLogId: unauthAuditLogId,
      };
      const tempDir = path.join(process.cwd(), '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(tempDir, 'test-fixtures.json'),
        JSON.stringify(fixturesManifest, null, 2),
        'utf8'
      );

      console.log(
        `[TEARDOWN] Conditionally reverting test payment on due ${SEEDED_STUDENT_DUE_ID} if committed...`
      );
      revertSeededStudentDue(SEEDED_STUDENT_DUE_ID, paymentAmount, validIdemKey);

      cleanLocalFixtures(unauthAuditLogId, committedTxnId);

      // A. Verify zero residual state for current-run test fixtures (independent of parent table deletions)
      const { count: remainingRunTxns } = await adminDbClient
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .or(`id.eq.${committedTxnId},idempotency_key.eq.${validIdemKey}`);

      const { count: remainingRunReceipts } = await adminDbClient
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .or(`id.eq.${committedReceiptId},transaction_id.eq.${committedTxnId}`);

      const { count: remainingRunPaymentAudits } = await adminDbClient
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'PAYMENT_RECORDED')
        .eq('entity_name', 'transactions')
        .eq('entity_id', committedTxnId);

      const { count: remainingRunUnauthAudit } = await adminDbClient
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('id', unauthAuditLogId!);

      // B. Verify zero residual state for leftover fixtures matching shared test prefix
      const { count: remainingPrefixTxns } = await adminDbClient
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .like('idempotency_key', 'ACTION-PAY-E2E-%');

      // C. Verify student dues baseline is strictly restored
      const { data: dueCheck } = await adminDbClient
        .from('student_dues')
        .select('paid_amount, status')
        .eq('id', SEEDED_STUDENT_DUE_ID)
        .single();

      const runFixturesResidual =
        (remainingRunTxns || 0) > 0 ||
        (remainingRunReceipts || 0) > 0 ||
        (remainingRunPaymentAudits || 0) > 0 ||
        (remainingRunUnauthAudit || 0) > 0;

      const prefixLeftoversResidual = (remainingPrefixTxns || 0) > 0;

      const baselineViolated =
        Number(dueCheck?.paid_amount) !== 0 || dueCheck?.status !== 'UNPAID';

      if (runFixturesResidual || prefixLeftoversResidual || baselineViolated) {
        if (runFixturesResidual) {
          console.error(
            `[FATAL CLEANUP FAILURE - CURRENT RUN] Test fixtures created by this run were not deleted! ` +
            `Txns: ${remainingRunTxns}, Receipts: ${remainingRunReceipts}, Payment audits: ${remainingRunPaymentAudits}, Unauth audits: ${remainingRunUnauthAudit}`
          );
        }
        if (prefixLeftoversResidual) {
          console.error(
            `[FATAL CLEANUP FAILURE - PREFIX LEFTOVERS] Leftover transactions matching prefix ACTION-PAY-E2E-% detected: ${remainingPrefixTxns}`
          );
        }
        if (baselineViolated) {
          console.error(
            `[FATAL CLEANUP FAILURE - BASELINE VIOLATION] Student due was not restored to baseline! Paid amount: ${dueCheck?.paid_amount}, Status: ${dueCheck?.status}`
          );
        }
        process.exit(1);
      } else {
        console.log('[TEARDOWN] Zero residual state verified. Current-run fixtures and prefix leftovers confirmed clean.\n');
      }
    } catch (cleanupErr: unknown) {
      const cleanupMsg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
      console.error(`[FATAL TEARDOWN ERROR] ${cleanupMsg}`);
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n=============================================================================');
  console.log('SERVER ACTION TEST EXECUTION RESULTS SUMMARY');
  console.log('=============================================================================');

  let totalPassed = 0;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} : ${r.name}`);
    if (r.details) console.log(`       Evidence: ${r.details}`);
    if (r.error) console.log(`       Error: ${r.error}`);
    if (r.passed) totalPassed++;
  }

  console.log('=============================================================================');
  console.log(`TOTAL: ${totalPassed}/${results.length} PASSED (${Math.round((totalPassed / results.length) * 100)}%)`);
  console.log('=============================================================================\n');

  if (totalPassed !== results.length) {
    process.exit(1);
  }
}

runActionTestSuite().catch((err: unknown) => {
  console.error('FATAL TEST RUNNER ERROR:', err);
  process.exit(1);
});
