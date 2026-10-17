-- =============================================================================
-- Migration: 20261006000005_revoke_manual_payment_authenticated.sql
-- Description: Revoke EXECUTE privilege on public.record_manual_payment_atomic
--              from the 'authenticated' role to prevent direct client RPC invocation.
--              Explicitly preserves EXECUTE privilege for 'service_role'.
--
-- Security Context:
--   The manual payment flow has been updated in the application layer
--   (src/lib/actions/payment.actions.ts) to execute via the server-only
--   admin client (createAdminClient()) using service_role credentials.
--   Revoking EXECUTE from 'authenticated' ensures that regular authenticated
--   sessions (such as students or unauthorized callers attempting direct PostgREST RPC)
--   cannot invoke the payment recording function directly.
--
-- Rollout Sequence:
--   1. Deploy application code with createAdminClient() to production first.
--   2. Verify that manual payments succeed using the new code.
--   3. Apply this migration in a separately authorized step to revoke direct
--      authenticated access.
--   WARNING: Applying this migration before deploying the application code
--   will cause immediate permission errors (PostgreSQL 42501) for cashier payment actions.
-- =============================================================================

-- 1. Revoke EXECUTE on public.record_manual_payment_atomic from authenticated
REVOKE EXECUTE ON FUNCTION public.record_manual_payment_atomic(
    UUID,
    UUID,
    NUMERIC,
    public.payment_method,
    DATE,
    TIME,
    VARCHAR,
    TEXT,
    UUID,
    VARCHAR,
    VARCHAR
) FROM authenticated;

-- 2. Explicitly preserve EXECUTE for service_role
GRANT EXECUTE ON FUNCTION public.record_manual_payment_atomic(
    UUID,
    UUID,
    NUMERIC,
    public.payment_method,
    DATE,
    TIME,
    VARCHAR,
    TEXT,
    UUID,
    VARCHAR,
    VARCHAR
) TO service_role;
