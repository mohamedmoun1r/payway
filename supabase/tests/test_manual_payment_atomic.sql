-- =============================================================================
-- Test Suite: test_manual_payment_atomic.sql
-- Description: Isolated integration test suite for public.record_manual_payment_atomic
-- Environment: Strictly isolated local PostgreSQL (Disposable transaction)
-- Safety: Wraps execution in BEGIN ... ROLLBACK to guarantee zero state mutation.
--
-- RUNTIME INVOCATION (Compatible with Supabase CLI on Windows / Docker):
--   cmd.exe /c npx supabase db query --local --file supabase/tests/test_manual_payment_atomic.sql
-- Or via psql:
--   psql -v ON_ERROR_STOP=1 "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/test_manual_payment_atomic.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. PRE-FLIGHT FIXTURE COLLISION GUARD
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM auth.users
        WHERE id IN (
            'f7777777-0000-0000-0000-000000000001'::uuid,
            'f7777777-0000-0000-0000-000000000002',
            'f7777777-0000-0000-0000-000000000003',
            'f7777777-0000-0000-0000-000000000011'
        )
    ) THEN
        RAISE EXCEPTION 'PRECONDITION FAILED: Test fixture user IDs already exist in auth.users.';
    END IF;
END $$;

-- =============================================================================
-- 1. SEED DEDICATED SYNTHETIC TEST FIXTURES
-- =============================================================================

-- 1.1 Auth Users
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at) VALUES
('f7777777-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'active_cashier_test@eng.cu.edu.eg', NOW(), NOW()),
('f7777777-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'inactive_cashier_test@eng.cu.edu.eg', NOW(), NOW()),
('f7777777-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'non_admin_test@eng.cu.edu.eg', NOW(), NOW()),
('f7777777-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'manual_pay_student_test@eng.cu.edu.eg', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 1.2 Profiles
INSERT INTO public.profiles (id, email, full_name_ar, full_name_en, national_id, role, is_active) VALUES
('f7777777-0000-0000-0000-000000000001'::uuid, 'active_cashier_test@eng.cu.edu.eg', 'محصل اختبار نشط', 'Active Cashier Test', '39001010000001', 'ADMIN', TRUE),
('f7777777-0000-0000-0000-000000000002'::uuid, 'inactive_cashier_test@eng.cu.edu.eg', 'محصل اختبار معطل', 'Inactive Cashier Test', '39001010000002', 'ADMIN', FALSE),
('f7777777-0000-0000-0000-000000000003'::uuid, 'non_admin_test@eng.cu.edu.eg', 'مستخدم عادي غير مصرح', 'Unauthorized User Test', '39001010000003', 'STUDENT', TRUE),
('f7777777-0000-0000-0000-000000000011'::uuid, 'manual_pay_student_test@eng.cu.edu.eg', 'طالب اختبار السداد', 'Manual Pay Student Test', '39901010000011', 'STUDENT', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 1.3 Admins
INSERT INTO public.admins (id, employee_id, office_department, can_void_payments) VALUES
('f7777777-0000-0000-0000-000000000001'::uuid, 'EMP-TEST-PAY-01', 'Test Treasury Desk', FALSE),
('f7777777-0000-0000-0000-000000000002'::uuid, 'EMP-TEST-PAY-02', 'Test Treasury Desk', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 1.4 Students
INSERT INTO public.students (id, student_number, academic_program, academic_department, academic_level) VALUES
('f7777777-0000-0000-0000-000000000011'::uuid, 'TEST-STU-PAY-01', 'Credit Hours System', 'Computer Engineering', 3)
ON CONFLICT (id) DO NOTHING;

-- 1.5 Semesters
INSERT INTO public.semesters (id, code, name_ar, name_en, academic_year, season, start_date, end_date, is_current) VALUES
('f1111111-0000-0000-0000-000000000001'::uuid, 'FALL2026-PAYTEST', 'خريف 2026 سداد', 'Fall 2026 Payment Test', '2026/2027', 'FALL'::public.semester_season, '2026-09-01', '2027-01-31', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 1.6 Student Due (Original: 15,000, Discount: 0, Paid: 0, Remaining: 15,000, Status: UNPAID)
INSERT INTO public.student_dues (id, student_id, semester_id, title_ar, title_en, original_amount, discount_amount, paid_amount, status) VALUES
('f2222222-0000-0000-0000-000000000001'::uuid, 'f7777777-0000-0000-0000-000000000011'::uuid, 'f1111111-0000-0000-0000-000000000001'::uuid, 'مصروفات دراسية تجريبية', 'Test Tuition', 15000.00, 0.00, 0.00, 'UNPAID'::public.due_status)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. TEST CASES
-- =============================================================================

DO $$
DECLARE
    v_res RECORD;
    v_txn RECORD;
    v_due RECORD;
    v_rcp RECORD;
    v_audit RECORD;
    v_verify_res RECORD;
    v_hash VARCHAR(64) := 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    v_hash2 VARCHAR(64) := 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1';
    v_caught BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=== STARTING RECORD_MANUAL_PAYMENT_ATOMIC TEST SUITE ===';

    -- -------------------------------------------------------------------------
    -- TEST 0: Privilege Boundaries on record_manual_payment_atomic (Migration 5)
    -- -------------------------------------------------------------------------
    -- 0.1 Verify 'authenticated' role CANNOT execute record_manual_payment_atomic
    IF has_function_privilege('authenticated', 'public.record_manual_payment_atomic(uuid, uuid, numeric, public.payment_method, date, time, character varying, text, uuid, character varying, character varying)', 'EXECUTE') THEN
        RAISE EXCEPTION 'TEST 0 FAILED: Role "authenticated" holds EXECUTE on public.record_manual_payment_atomic. Migration 5 revocation failed or was reverted.';
    END IF;

    -- 0.2 Verify 'anon' role CANNOT execute record_manual_payment_atomic
    IF has_function_privilege('anon', 'public.record_manual_payment_atomic(uuid, uuid, numeric, public.payment_method, date, time, character varying, text, uuid, character varying, character varying)', 'EXECUTE') THEN
        RAISE EXCEPTION 'TEST 0 FAILED: Role "anon" holds EXECUTE on public.record_manual_payment_atomic.';
    END IF;

    -- 0.3 Verify 'service_role' CAN execute record_manual_payment_atomic
    IF NOT has_function_privilege('service_role', 'public.record_manual_payment_atomic(uuid, uuid, numeric, public.payment_method, date, time, character varying, text, uuid, character varying, character varying)', 'EXECUTE') THEN
        RAISE EXCEPTION 'TEST 0 FAILED: Role "service_role" does NOT hold EXECUTE on public.record_manual_payment_atomic.';
    END IF;

    -- 0.4 Verify role switching to 'authenticated' fails closed with insufficient_privilege (42501)
    v_caught := FALSE;
    BEGIN
        SET LOCAL ROLE authenticated;
        PERFORM public.record_manual_payment_atomic(
            'f7777777-0000-0000-0000-000000000011'::uuid,
            'f1111111-0000-0000-0000-000000000001'::uuid,
            1000.00,
            'CASH'::public.payment_method,
            '2026-10-13'::date,
            '10:30:00'::time,
            'REF-TEST-AUTH-PROBE',
            'Probe authenticated role execution directly',
            'f7777777-0000-0000-0000-000000000001'::uuid,
            'idemp-test-auth-probe',
            v_hash
        );
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught := TRUE;
        RESET ROLE;
    END;

    IF NOT v_caught THEN
        RESET ROLE;
        RAISE EXCEPTION 'TEST 0 FAILED: Direct invocation under role "authenticated" was permitted or did not raise insufficient_privilege (42501).';
    END IF;

    -- 0.5 Verify role switching to 'anon' fails closed with insufficient_privilege (42501)
    v_caught := FALSE;
    BEGIN
        SET LOCAL ROLE anon;
        PERFORM public.record_manual_payment_atomic(
            'f7777777-0000-0000-0000-000000000011'::uuid,
            'f1111111-0000-0000-0000-000000000001'::uuid,
            1000.00,
            'CASH'::public.payment_method,
            '2026-10-13'::date,
            '10:30:00'::time,
            'REF-TEST-ANON-PROBE',
            'Probe anon role execution directly',
            'f7777777-0000-0000-0000-000000000001'::uuid,
            'idemp-test-anon-probe',
            v_hash
        );
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught := TRUE;
        RESET ROLE;
    END;

    IF NOT v_caught THEN
        RESET ROLE;
        RAISE EXCEPTION 'TEST 0 FAILED: Direct invocation under role "anon" was permitted or did not raise insufficient_privilege (42501).';
    END IF;

    RAISE NOTICE '✅ TEST 0 PASSED: Database catalog privilege boundaries verified (authenticated=FALSE, anon=FALSE, service_role=TRUE)';

    -- -------------------------------------------------------------------------
    -- TEST 1: Valid Partial Payment (5,000 EGP out of 15,000 EGP)
    -- -------------------------------------------------------------------------
    SELECT * INTO v_res FROM public.record_manual_payment_atomic(
        'f7777777-0000-0000-0000-000000000011'::uuid,
        'f1111111-0000-0000-0000-000000000001'::uuid,
        5000.00,
        'CASH'::public.payment_method,
        '2026-10-13'::date,
        '10:30:00'::time,
        'REF-TEST-001',
        'Valid test partial payment notes',
        'f7777777-0000-0000-0000-000000000001'::uuid,
        'idemp-test-atomic-001',
        v_hash
    );

    IF v_res.transaction_id IS NULL OR v_res.receipt_id IS NULL THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Function returned null transaction or receipt ID';
    END IF;

    -- Verify transaction record
    SELECT * INTO v_txn FROM public.transactions WHERE id = v_res.transaction_id;
    IF v_txn.amount != 5000.00 OR v_txn.status != 'COMPLETED' OR v_txn.idempotency_key != 'idemp-test-atomic-001' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Transaction record inconsistent with submitted data';
    END IF;

    -- Verify student due update (15000 original - 5000 paid = 10000 remaining, PARTIALLY_PAID)
    SELECT * INTO v_due FROM public.student_dues WHERE id = 'f2222222-0000-0000-0000-000000000001'::uuid;
    IF v_due.paid_amount != 5000.00 OR v_due.remaining_balance != 10000.00 OR v_due.status != 'PARTIALLY_PAID' THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Due balance or status incorrect. Paid: %, Remaining: %, Status: %',
            v_due.paid_amount, v_due.remaining_balance, v_due.status;
    END IF;

    -- Verify receipt record
    SELECT * INTO v_rcp FROM public.receipts WHERE id = v_res.receipt_id;
    IF v_rcp.total_amount != 5000.00 OR v_rcp.verification_hash != v_hash THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Receipt total amount or verification hash incorrect';
    END IF;

    -- Verify audit log
    SELECT * INTO v_audit FROM public.audit_logs
    WHERE entity_id = v_res.transaction_id::text AND action = 'PAYMENT_RECORDED';
    IF v_audit.id IS NULL OR (v_audit.after_state->>'amount')::numeric != 5000.00 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Audit log record missing or incorrect';
    END IF;

    RAISE NOTICE '✅ TEST 1 PASSED: Valid partial payment committed with consistent multi-table updates';

    -- -------------------------------------------------------------------------
    -- TEST 2: Idempotency Replay (Duplicate Submission with Same Key)
    -- -------------------------------------------------------------------------
    v_caught := FALSE;
    BEGIN
        PERFORM public.record_manual_payment_atomic(
            'f7777777-0000-0000-0000-000000000011'::uuid,
            'f1111111-0000-0000-0000-000000000001'::uuid,
            5000.00,
            'CASH'::public.payment_method,
            '2026-10-13'::date,
            '10:30:00'::time,
            'REF-TEST-001',
            'Duplicate submission attempt',
            'f7777777-0000-0000-0000-000000000001'::uuid,
            'idemp-test-atomic-001',
            v_hash
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%DUPLICATE_SUBMISSION%' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 2 FAILED: Expected DUPLICATE_SUBMISSION but got: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Duplicate idempotency key was not rejected';
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Duplicate idempotency key strictly rejected with DUPLICATE_SUBMISSION';

    -- -------------------------------------------------------------------------
    -- TEST 3: Overpayment Protection (Remaining is 10,000; Attempt 12,000)
    -- -------------------------------------------------------------------------
    v_caught := FALSE;
    BEGIN
        PERFORM public.record_manual_payment_atomic(
            'f7777777-0000-0000-0000-000000000011'::uuid,
            'f1111111-0000-0000-0000-000000000001'::uuid,
            12000.00,
            'CASH'::public.payment_method,
            '2026-10-13'::date,
            '10:35:00'::time,
            'REF-OVERPAY',
            'Overpayment test',
            'f7777777-0000-0000-0000-000000000001'::uuid,
            'idemp-test-atomic-overpay',
            v_hash2
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%OVERPAYMENT%' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 3 FAILED: Expected OVERPAYMENT but got: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Overpayment of 12,000 against 10,000 remaining was not rejected';
    END IF;

    -- Verify balance remained untouched at 10,000
    SELECT * INTO v_due FROM public.student_dues WHERE id = 'f2222222-0000-0000-0000-000000000001'::uuid;
    IF v_due.remaining_balance != 10000.00 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Balance was modified during rejected overpayment';
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Overpayment strictly rejected without altering financial records';

    -- -------------------------------------------------------------------------
    -- TEST 4: Invalid Verification Hash Format (Not 64-char Hex)
    -- -------------------------------------------------------------------------
    v_caught := FALSE;
    BEGIN
        PERFORM public.record_manual_payment_atomic(
            'f7777777-0000-0000-0000-000000000011'::uuid,
            'f1111111-0000-0000-0000-000000000001'::uuid,
            1000.00,
            'CASH'::public.payment_method,
            '2026-10-13'::date,
            '10:40:00'::time,
            'REF-HASH',
            'Bad hash test',
            'f7777777-0000-0000-0000-000000000001'::uuid,
            'idemp-test-atomic-badhash',
            'not-a-valid-64-hex-hash'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%INVALID_HASH%' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 4 FAILED: Expected INVALID_HASH but got: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Malformed verification hash was not rejected';
    END IF;
    RAISE NOTICE '✅ TEST 4 PASSED: Malformed verification hash strictly rejected';

    -- -------------------------------------------------------------------------
    -- TEST 5: Unauthorized Caller (Inactive Admin or Non-Admin Profile)
    -- -------------------------------------------------------------------------
    v_caught := FALSE;
    BEGIN
        PERFORM public.record_manual_payment_atomic(
            'f7777777-0000-0000-0000-000000000011'::uuid,
            'f1111111-0000-0000-0000-000000000001'::uuid,
            1000.00,
            'CASH'::public.payment_method,
            '2026-10-13'::date,
            '10:45:00'::time,
            'REF-UNAUTH',
            'Inactive admin test',
            'f7777777-0000-0000-0000-000000000002'::uuid, -- Inactive Admin
            'idemp-test-atomic-unauth',
            v_hash2
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%FORBIDDEN%' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 5 FAILED: Expected FORBIDDEN for inactive admin but got: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Inactive admin was not rejected';
    END IF;
    RAISE NOTICE '✅ TEST 5 PASSED: Inactive administrator strictly rejected';

    -- -------------------------------------------------------------------------
    -- TEST 6: Complete Remaining Payment (Transitions status to PAID)
    -- -------------------------------------------------------------------------
    SELECT * INTO v_res FROM public.record_manual_payment_atomic(
        'f7777777-0000-0000-0000-000000000011'::uuid,
        'f1111111-0000-0000-0000-000000000001'::uuid,
        10000.00,
        'POS'::public.payment_method,
        '2026-10-13'::date,
        '10:50:00'::time,
        'REF-FINAL-PAY',
        'Final payment to clear dues',
        'f7777777-0000-0000-0000-000000000001'::uuid,
        'idemp-test-atomic-final',
        v_hash2
    );

    SELECT * INTO v_due FROM public.student_dues WHERE id = 'f2222222-0000-0000-0000-000000000001'::uuid;
    IF v_due.paid_amount != 15000.00 OR v_due.remaining_balance != 0.00 OR v_due.status != 'PAID' THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Due status did not transition to PAID or remaining != 0. Paid: %, Remaining: %, Status: %',
            v_due.paid_amount, v_due.remaining_balance, v_due.status;
    END IF;
    RAISE NOTICE '✅ TEST 6 PASSED: Final payment cleanly transitioned due status to PAID with remaining = 0';

    -- -------------------------------------------------------------------------
    -- TEST 7: Receipt Public Verification via verify_receipt_public RPC
    -- -------------------------------------------------------------------------
    SELECT * INTO v_verify_res FROM public.verify_receipt_public(v_hash);
    IF v_verify_res.receipt_number IS NULL OR v_verify_res.amount != 5000.00 OR v_verify_res.payment_status != 'COMPLETED' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Public receipt verification failed for valid payment hash';
    END IF;
    RAISE NOTICE '✅ TEST 7 PASSED: Public receipt verification successfully verified payment hash without leaking secrets';

    RAISE NOTICE '=== ALL 7 SQL INTEGRATION TESTS PASSED SUCCESSFULLY! ===';
END $$;

-- Guarantee zero state mutation
ROLLBACK;
