-- =============================================================================
-- Migration: 20261006000004_void_transaction_role_check.sql
-- Description: Harden public.void_transaction_atomic database-level authorization.
--              Explicitly verifies caller has role 'ADMIN' or 'SUPER_ADMIN' in
--              public.profiles, preventing privilege escalation if a non-admin
--              account has a row in public.admins with can_void_payments = true.
-- Pre-Production Pilot System
-- =============================================================================

CREATE OR REPLACE FUNCTION public.void_transaction_atomic(
    p_transaction_id UUID,
    p_void_reason TEXT,
    p_admin_id UUID
)
RETURNS TABLE (
    transaction_id UUID,
    restored_balance NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_txn RECORD;
    v_due RECORD;
    v_can_void BOOLEAN;
    v_new_balance NUMERIC(12, 2);
    v_caller_role public.user_role;
BEGIN
    -- 2.1 Authentication & Caller Spoofing Defense
    IF auth.uid() IS NOT NULL AND auth.uid() != p_admin_id THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authenticated caller (%) does not match specified admin_id (%)', auth.uid(), p_admin_id;
    END IF;

    -- 2.2 Verify caller is an active authorized administrator with void permissions
    SELECT a.can_void_payments, p.role INTO v_can_void, v_caller_role
    FROM public.admins a
    JOIN public.profiles p ON p.id = a.id
    WHERE a.id = p_admin_id AND p.is_active = TRUE;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
        RAISE EXCEPTION 'FORBIDDEN: Caller (%) is not an active authorized administrator', p_admin_id;
    END IF;

    IF v_can_void IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN: Administrator (%) does not possess void permissions', p_admin_id;
    END IF;

    -- 2.3 Validate reason length
    IF LENGTH(TRIM(p_void_reason)) < 10 THEN
        RAISE EXCEPTION 'INVALID_REASON: A detailed void reason of at least 10 characters is required';
    END IF;

    -- 2.4 Fetch and lock transaction
    SELECT * INTO v_txn
    FROM public.transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF v_txn.id IS NULL THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: Transaction (%) does not exist', p_transaction_id;
    END IF;

    IF v_txn.status = 'VOIDED' THEN
        RAISE EXCEPTION 'ALREADY_VOIDED: Transaction (%) is already voided', p_transaction_id;
    END IF;

    -- 2.5 Lock student due row
    SELECT * INTO v_due
    FROM public.student_dues
    WHERE id = v_txn.student_due_id
    FOR UPDATE;

    -- 2.6 Reverse paid amount on due
    UPDATE public.student_dues
    SET 
        paid_amount = GREATEST(0, paid_amount - v_txn.amount),
        status = CASE 
            WHEN (paid_amount - v_txn.amount) <= 0 THEN 'UNPAID'::public.due_status
            ELSE 'PARTIALLY_PAID'::public.due_status
        END,
        updated_at = NOW()
    WHERE id = v_txn.student_due_id
    RETURNING remaining_balance INTO v_new_balance;

    -- 2.7 Update transaction status to VOIDED
    UPDATE public.transactions
    SET 
        status = 'VOIDED',
        void_reason = p_void_reason,
        voided_at = NOW(),
        voided_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- 2.8 Record in Audit Log
    INSERT INTO public.audit_logs (
        actor_id, actor_role, action, entity_name, entity_id, before_state, after_state
    ) VALUES (
        p_admin_id, v_caller_role, 'PAYMENT_VOIDED', 'transactions', p_transaction_id::text,
        jsonb_build_object('status', 'COMPLETED', 'amount', v_txn.amount),
        jsonb_build_object('status', 'VOIDED', 'void_reason', p_void_reason, 'restored_balance', v_new_balance)
    );

    RETURN QUERY SELECT p_transaction_id, v_new_balance;
END;
$$;
