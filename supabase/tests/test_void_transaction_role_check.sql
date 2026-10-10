-- =============================================================================
-- Test Suite: test_void_transaction_role_check.sql
-- Description: Isolated integration test suite for public.void_transaction_atomic
-- Target Migration: 20261006000004_void_transaction_role_check.sql
-- Environment: Strictly isolated local / staging PostgreSQL (Disposable transaction)
-- Safety: Wraps execution in BEGIN ... ROLLBACK to guarantee zero state mutation.
--
-- RUNTIME INVOCATION (Compatible with Supabase CLI 2.120.0 on Windows / Docker):
--   cmd.exe /c npx supabase db query --local --file supabase/tests/test_void_transaction_role_check.sql
-- Or via containerized / host psql:
--   psql -v ON_ERROR_STOP=1 "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/test_void_transaction_role_check.sql
--
-- NOTE ON FAILURE DETECTION:
--   - Any assertion failure raises an unhandled EXCEPTION, aborting the transaction
--     and causing the query runner to exit with a non-zero code.
--   - When invoking via psql, the `-v ON_ERROR_STOP=1` flag is strictly required
--     to prevent psql from ignoring errors and exiting with code 0 upon ROLLBACK.
--
-- POST-ROLLBACK PERSISTENCE VERIFICATION (Strictly scoped to test fixture UUIDs):
--   cmd.exe /c npx supabase db query --local "SELECT COUNT(*) AS leftover_txns FROM public.transactions WHERE id IN ('c7777777-0000-0000-0000-000000000001'::uuid, 'c7777777-0000-0000-0000-000000000002'::uuid, 'c7777777-0000-0000-0000-000000000003'::uuid);"
--   cmd.exe /c npx supabase db query --local "SELECT COUNT(*) AS leftover_audits FROM public.audit_logs WHERE entity_id IN ('c7777777-0000-0000-0000-000000000001', 'c7777777-0000-0000-0000-000000000002', 'c7777777-0000-0000-0000-000000000003');"
--   Both queries must return 0. (Do NOT assert COUNT(*) from public.audit_logs unconstrained,
--   as seed.sql inserts demo audit logs that legitimately exist in the database).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. PRE-FLIGHT FIXTURE COLLISION GUARD
-- =============================================================================
-- Ensure reserved test fixture IDs do not already exist in any relevant table.
-- Fails fast to prevent non-deterministic test results or modifying existing data.
DO $$
BEGIN
    -- 0.1 Check auth.users for any reserved administrator or student user IDs
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id IN (
            'a7777777-0000-0000-0000-000000000001'::uuid,
            'a7777777-0000-0000-0000-000000000002'::uuid,
            'a7777777-0000-0000-0000-000000000003'::uuid,
            'a7777777-0000-0000-0000-000000000004'::uuid,
            'a7777777-0000-0000-0000-000000000005'::uuid,
            'a7777777-0000-0000-0000-000000000006'::uuid,
            'b7777777-0000-0000-0000-000000000001'::uuid,
            'b7777777-0000-0000-0000-000000000002'::uuid,
            'b7777777-0000-0000-0000-000000000003'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE PRECONDITION FAILED: Reserved test user IDs already exist in auth.users.';
    END IF;

    -- 0.2 Check public.profiles for any reserved administrator or student profile IDs
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id IN (
            'a7777777-0000-0000-0000-000000000001'::uuid,
            'a7777777-0000-0000-0000-000000000002'::uuid,
            'a7777777-0000-0000-0000-000000000003'::uuid,
            'a7777777-0000-0000-0000-000000000004'::uuid,
            'a7777777-0000-0000-0000-000000000005'::uuid,
            'a7777777-0000-0000-0000-000000000006'::uuid,
            'b7777777-0000-0000-0000-000000000001'::uuid,
            'b7777777-0000-0000-0000-000000000002'::uuid,
            'b7777777-0000-0000-0000-000000000003'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE PRECONDITION FAILED: Reserved test profile IDs already exist in public.profiles.';
    END IF;

    -- 0.3 Check public.admins for any reserved administrator IDs
    IF EXISTS (
        SELECT 1 FROM public.admins 
        WHERE id IN (
            'a7777777-0000-0000-0000-000000000001'::uuid,
            'a7777777-0000-0000-0000-000000000002'::uuid,
            'a7777777-0000-0000-0000-000000000003'::uuid,
            'a7777777-0000-0000-0000-000000000004'::uuid,
            'a7777777-0000-0000-0000-000000000005'::uuid,
            'a7777777-0000-0000-0000-000000000006'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE PRECONDITION FAILED: Reserved test admin IDs already exist in public.admins.';
    END IF;

    -- 0.4 Check public.students for any reserved student IDs
    IF EXISTS (
        SELECT 1 FROM public.students 
        WHERE id IN (
            'b7777777-0000-0000-0000-000000000001'::uuid,
            'b7777777-0000-0000-0000-000000000002'::uuid,
            'b7777777-0000-0000-0000-000000000003'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE PRECONDITION FAILED: Reserved test student IDs already exist in public.students.';
    END IF;

    -- 0.5 Check public.student_dues for all three reserved due IDs
    IF EXISTS (
        SELECT 1 FROM public.student_dues 
        WHERE id IN (
            'd7777777-0000-0000-0000-000000000001'::uuid,
            'd7777777-0000-0000-0000-000000000002'::uuid,
            'd7777777-0000-0000-0000-000000000003'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE PRECONDITION FAILED: Reserved test due IDs already exist in public.student_dues.';
    END IF;

    -- 0.6 Check public.transactions for all three reserved transaction IDs
    IF EXISTS (
        SELECT 1 FROM public.transactions 
        WHERE id IN (
            'c7777777-0000-0000-0000-000000000001'::uuid,
            'c7777777-0000-0000-0000-000000000002'::uuid,
            'c7777777-0000-0000-0000-000000000003'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'FIXTURE PRECONDITION FAILED: Reserved test transaction IDs already exist in public.transactions.';
    END IF;

    -- 0.7 Check public.semesters for the dedicated test semester ID
    IF EXISTS (
        SELECT 1 FROM public.semesters 
        WHERE id = 'e1111111-0000-0000-0000-000000000001'::uuid
    ) THEN
        RAISE EXCEPTION 'FIXTURE PRECONDITION FAILED: Dedicated test semester ID e1111111-0000-0000-0000-000000000001 already exists in public.semesters.';
    END IF;
END $$;

-- =============================================================================
-- 1. SEED TEST FIXTURES
-- =============================================================================

-- 1.0 Auth Users Fixtures (Prerequisite for public.profiles foreign key constraint)
INSERT INTO auth.users (
    id, instance_id, aud, role, email, created_at, updated_at
) VALUES
('a7777777-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'anomalous_student@eng.cu.edu.eg', NOW(), NOW()),
('a7777777-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'inactive_admin@eng.cu.edu.eg', NOW(), NOW()),
('a7777777-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'admin_no_void@eng.cu.edu.eg', NOW(), NOW()),
('a7777777-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'superadmin_no_void@eng.cu.edu.eg', NOW(), NOW()),
('a7777777-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'authorized_admin@eng.cu.edu.eg', NOW(), NOW()),
('a7777777-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'authorized_superadmin@eng.cu.edu.eg', NOW(), NOW()),
('b7777777-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'student_fixture_1@eng.cu.edu.eg', NOW(), NOW()),
('b7777777-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'student_fixture_2@eng.cu.edu.eg', NOW(), NOW()),
('b7777777-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'student_fixture_3@eng.cu.edu.eg', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 1.1 Academic Semester Fixture (Using season column with semester_season enum)
INSERT INTO public.semesters (
    id, code, name_ar, name_en, academic_year, season, start_date, end_date, is_current
) VALUES (
    'e1111111-0000-0000-0000-000000000001'::uuid,
    'FALL2026-TEST',
    'خريف 2026 تجريبي',
    'Fall 2026 Test',
    '2026/2027',
    'FALL'::public.semester_season,
    '2026-09-01',
    '2027-01-31',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 1.2 Fixture: STUDENT profile with anomalous can_void_payments = TRUE in public.admins
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'a7777777-0000-0000-0000-000000000001'::uuid,
    'anomalous_student@eng.cu.edu.eg',
    'طالب بحساب شاذ',
    'Anomalous Student Role',
    '30101010100001',
    'STUDENT',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (
    id, employee_id, office_department, can_void_payments
) VALUES (
    'a7777777-0000-0000-0000-000000000001'::uuid,
    'EMP-ANOM-01',
    'Treasury Desk',
    TRUE
) ON CONFLICT (id) DO UPDATE SET can_void_payments = TRUE;

-- 1.3 Fixture: Inactive ADMIN profile with can_void_payments = TRUE
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'a7777777-0000-0000-0000-000000000002'::uuid,
    'inactive_admin@eng.cu.edu.eg',
    'مسؤول معطل',
    'Inactive Administrator',
    '30101010100002',
    'ADMIN',
    FALSE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (
    id, employee_id, office_department, can_void_payments
) VALUES (
    'a7777777-0000-0000-0000-000000000002'::uuid,
    'EMP-INACT-02',
    'Treasury Desk',
    TRUE
) ON CONFLICT (id) DO UPDATE SET can_void_payments = TRUE;

-- 1.4 Fixture: Active ADMIN profile without void permission (can_void_payments = FALSE)
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'a7777777-0000-0000-0000-000000000003'::uuid,
    'admin_no_void@eng.cu.edu.eg',
    'مسؤول بدون صلاحية إلغاء',
    'Admin Without Void Permission',
    '30101010100003',
    'ADMIN',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (
    id, employee_id, office_department, can_void_payments
) VALUES (
    'a7777777-0000-0000-0000-000000000003'::uuid,
    'EMP-NOVD-03',
    'Treasury Desk',
    FALSE
) ON CONFLICT (id) DO UPDATE SET can_void_payments = FALSE;

-- 1.5 Fixture: Active SUPER_ADMIN profile without void permission (Policy Option A)
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'a7777777-0000-0000-0000-000000000004'::uuid,
    'superadmin_no_void@eng.cu.edu.eg',
    'مشرف عام بدون صلاحية إلغاء',
    'SuperAdmin Without Void Permission',
    '30101010100004',
    'SUPER_ADMIN',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (
    id, employee_id, office_department, can_void_payments
) VALUES (
    'a7777777-0000-0000-0000-000000000004'::uuid,
    'EMP-SPNV-04',
    'University Supervision',
    FALSE
) ON CONFLICT (id) DO UPDATE SET can_void_payments = FALSE;

-- 1.6 Fixture: Authorized Active ADMIN with can_void_payments = TRUE
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'a7777777-0000-0000-0000-000000000005'::uuid,
    'authorized_admin@eng.cu.edu.eg',
    'مسؤول خزانة مخول',
    'Authorized Treasury Admin',
    '30101010100005',
    'ADMIN',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (
    id, employee_id, office_department, can_void_payments
) VALUES (
    'a7777777-0000-0000-0000-000000000005'::uuid,
    'EMP-AUTH-05',
    'Treasury Desk',
    TRUE
) ON CONFLICT (id) DO UPDATE SET can_void_payments = TRUE;

-- 1.7 Fixture: Authorized Active SUPER_ADMIN with can_void_payments = TRUE
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'a7777777-0000-0000-0000-000000000006'::uuid,
    'authorized_superadmin@eng.cu.edu.eg',
    'مشرف عام مخول',
    'Authorized Super Admin',
    '30101010100006',
    'SUPER_ADMIN',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admins (
    id, employee_id, office_department, can_void_payments
) VALUES (
    'a7777777-0000-0000-0000-000000000006'::uuid,
    'EMP-SPAT-06',
    'University Supervision',
    TRUE
) ON CONFLICT (id) DO UPDATE SET can_void_payments = TRUE;

-- 1.8 Fixture: Legitimate Test Student 1
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'b7777777-0000-0000-0000-000000000001'::uuid,
    'student_fixture_1@eng.cu.edu.eg',
    'طالب تجريبي أول',
    'Test Student One',
    '30101010100007',
    'STUDENT',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.students (
    id, student_number, academic_program, academic_department, academic_level
) VALUES (
    'b7777777-0000-0000-0000-000000000001'::uuid,
    '20261001',
    'Credit Hours System',
    'Computer & Systems Engineering',
    1
) ON CONFLICT (id) DO NOTHING;

-- 1.9 Fixture: Student Due 1 (Total: 5000.00, Paid: 1500.00, Remaining: 3500.00)
INSERT INTO public.student_dues (
    id, student_id, semester_id, original_amount, discount_amount, paid_amount, status
) VALUES (
    'd7777777-0000-0000-0000-000000000001'::uuid,
    'b7777777-0000-0000-0000-000000000001'::uuid,
    'e1111111-0000-0000-0000-000000000001'::uuid,
    5000.00,
    0.00,
    1500.00,
    'PARTIALLY_PAID'
) ON CONFLICT (id) DO NOTHING;

-- 1.10 Fixture: Test Transaction 1 (Amount: 1500.00 EGP, COMPLETED)
INSERT INTO public.transactions (
    id, transaction_number, student_id, semester_id, student_due_id, amount,
    payment_method, payment_date, payment_time, status, idempotency_key, recorded_by
) VALUES (
    'c7777777-0000-0000-0000-000000000001'::uuid,
    'CUFE-TXN-TEST-000001',
    'b7777777-0000-0000-0000-000000000001'::uuid,
    'e1111111-0000-0000-0000-000000000001'::uuid,
    'd7777777-0000-0000-0000-000000000001'::uuid,
    1500.00,
    'CASH',
    CURRENT_DATE,
    CURRENT_TIME,
    'COMPLETED',
    'test-idemp-key-fixture-001',
    'a7777777-0000-0000-0000-000000000005'::uuid
) ON CONFLICT (id) DO NOTHING;

-- 1.11 Fixture: Legitimate Test Student 2
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'b7777777-0000-0000-0000-000000000002'::uuid,
    'student_fixture_2@eng.cu.edu.eg',
    'طالب تجريبي ثان',
    'Test Student Two',
    '30101010100008',
    'STUDENT',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.students (
    id, student_number, academic_program, academic_department, academic_level
) VALUES (
    'b7777777-0000-0000-0000-000000000002'::uuid,
    '20261002',
    'Credit Hours System',
    'Mechanical Power Engineering',
    1
) ON CONFLICT (id) DO NOTHING;

-- 1.12 Fixture: Student Due 2 (Total: 6000.00, Paid: 2000.00, Remaining: 4000.00)
INSERT INTO public.student_dues (
    id, student_id, semester_id, original_amount, discount_amount, paid_amount, status
) VALUES (
    'd7777777-0000-0000-0000-000000000002'::uuid,
    'b7777777-0000-0000-0000-000000000002'::uuid,
    'e1111111-0000-0000-0000-000000000001'::uuid,
    6000.00,
    0.00,
    2000.00,
    'PARTIALLY_PAID'
) ON CONFLICT (id) DO NOTHING;

-- 1.13 Fixture: Test Transaction 2 (Amount: 2000.00 EGP, COMPLETED - For SuperAdmin Success Test)
INSERT INTO public.transactions (
    id, transaction_number, student_id, semester_id, student_due_id, amount,
    payment_method, payment_date, payment_time, status, idempotency_key, recorded_by
) VALUES (
    'c7777777-0000-0000-0000-000000000002'::uuid,
    'CUFE-TXN-TEST-000002',
    'b7777777-0000-0000-0000-000000000002'::uuid,
    'e1111111-0000-0000-0000-000000000001'::uuid,
    'd7777777-0000-0000-0000-000000000002'::uuid,
    2000.00,
    'BANK_TRANSFER',
    CURRENT_DATE,
    CURRENT_TIME,
    'COMPLETED',
    'test-idemp-key-fixture-002',
    'a7777777-0000-0000-0000-000000000006'::uuid
) ON CONFLICT (id) DO NOTHING;

-- 1.14 Fixture: Legitimate Test Student 3 (For Authenticated Admin Success Test)
INSERT INTO public.profiles (
    id, email, full_name_ar, full_name_en, national_id, role, is_active
) VALUES (
    'b7777777-0000-0000-0000-000000000003'::uuid,
    'student_fixture_3@eng.cu.edu.eg',
    'طالب تجريبي ثالث',
    'Test Student Three',
    '30101010100009',
    'STUDENT',
    TRUE
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.students (
    id, student_number, academic_program, academic_department, academic_level
) VALUES (
    'b7777777-0000-0000-0000-000000000003'::uuid,
    '20261003',
    'Credit Hours System',
    'Civil Engineering',
    1
) ON CONFLICT (id) DO NOTHING;

-- 1.15 Fixture: Student Due 3 (Total: 4000.00, Paid: 1000.00, Remaining: 3000.00)
INSERT INTO public.student_dues (
    id, student_id, semester_id, original_amount, discount_amount, paid_amount, status
) VALUES (
    'd7777777-0000-0000-0000-000000000003'::uuid,
    'b7777777-0000-0000-0000-000000000003'::uuid,
    'e1111111-0000-0000-0000-000000000001'::uuid,
    4000.00,
    0.00,
    1000.00,
    'PARTIALLY_PAID'
) ON CONFLICT (id) DO NOTHING;

-- 1.16 Fixture: Test Transaction 3 (Amount: 1000.00 EGP, COMPLETED - For Authenticated Admin Success Test)
INSERT INTO public.transactions (
    id, transaction_number, student_id, semester_id, student_due_id, amount,
    payment_method, payment_date, payment_time, status, idempotency_key, recorded_by
) VALUES (
    'c7777777-0000-0000-0000-000000000003'::uuid,
    'CUFE-TXN-TEST-000003',
    'b7777777-0000-0000-0000-000000000003'::uuid,
    'e1111111-0000-0000-0000-000000000001'::uuid,
    'd7777777-0000-0000-0000-000000000003'::uuid,
    1000.00,
    'CASH',
    CURRENT_DATE,
    CURRENT_TIME,
    'COMPLETED',
    'test-idemp-key-fixture-003',
    'a7777777-0000-0000-0000-000000000005'::uuid
) ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 2. REJECTION TEST CASES (ISOLATED NESTED BLOCKS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Test 1: STUDENT with anomalous can_void_payments = TRUE MUST BE REJECTED
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_caught_expected_exception BOOLEAN := FALSE;
    v_actual_errm TEXT;
    v_is_active BOOLEAN;
    v_role public.user_role;
    v_can_void BOOLEAN;
BEGIN
    -- Precondition assertion: Verify fixture state is an active STUDENT with can_void_payments=true
    SELECT p.is_active, p.role, a.can_void_payments
    INTO v_is_active, v_role, v_can_void
    FROM public.profiles p
    JOIN public.admins a ON a.id = p.id
    WHERE p.id = 'a7777777-0000-0000-0000-000000000001'::uuid;

    IF v_is_active IS NOT TRUE OR v_role != 'STUDENT' OR v_can_void IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 1 SETUP ERROR: Fixture must be an active STUDENT with can_void_payments=true (found is_active=%, role=%, can_void=%)',
            v_is_active, v_role, v_can_void;
    END IF;

    BEGIN
        PERFORM public.void_transaction_atomic(
            'c7777777-0000-0000-0000-000000000001'::uuid,
            'Unauthorized student void test reason exceeding 10 characters',
            'a7777777-0000-0000-0000-000000000001'::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_actual_errm := SQLERRM;
        IF v_actual_errm ILIKE '%is not an active authorized administrator%' THEN
            v_caught_expected_exception := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 1 FAILED: Caught unexpected error: "%" (SQLSTATE: %)', v_actual_errm, SQLSTATE;
        END IF;
    END;

    IF NOT v_caught_expected_exception THEN
        RAISE EXCEPTION 'TEST 1 FAILED: Function unexpectedly succeeded for STUDENT with void privilege!';
    END IF;

    RAISE NOTICE 'TEST 1 PASSED: STUDENT with can_void_payments=true rejected as expected.';
END $$;

-- -----------------------------------------------------------------------------
-- Test 2: Inactive ADMIN MUST BE REJECTED
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_caught_expected_exception BOOLEAN := FALSE;
    v_actual_errm TEXT;
    v_is_active BOOLEAN;
    v_role public.user_role;
    v_can_void BOOLEAN;
BEGIN
    -- Precondition assertion: Verify fixture state is an inactive ADMIN with can_void_payments=true
    SELECT p.is_active, p.role, a.can_void_payments
    INTO v_is_active, v_role, v_can_void
    FROM public.profiles p
    JOIN public.admins a ON a.id = p.id
    WHERE p.id = 'a7777777-0000-0000-0000-000000000002'::uuid;

    IF v_is_active IS NOT FALSE OR v_role != 'ADMIN' OR v_can_void IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 2 SETUP ERROR: Fixture must be an inactive ADMIN with can_void_payments=true (found is_active=%, role=%, can_void=%)',
            v_is_active, v_role, v_can_void;
    END IF;

    BEGIN
        PERFORM public.void_transaction_atomic(
            'c7777777-0000-0000-0000-000000000001'::uuid,
            'Inactive administrator void reason exceeding 10 characters',
            'a7777777-0000-0000-0000-000000000002'::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_actual_errm := SQLERRM;
        IF v_actual_errm ILIKE '%is not an active authorized administrator%' THEN
            v_caught_expected_exception := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 2 FAILED: Caught unexpected error: "%" (SQLSTATE: %)', v_actual_errm, SQLSTATE;
        END IF;
    END;

    IF NOT v_caught_expected_exception THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Function unexpectedly succeeded for inactive ADMIN!';
    END IF;

    RAISE NOTICE 'TEST 2 PASSED: Inactive ADMIN rejected as expected.';
END $$;

-- -----------------------------------------------------------------------------
-- Test 3: Active ADMIN without void permission MUST BE REJECTED
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_caught_expected_exception BOOLEAN := FALSE;
    v_actual_errm TEXT;
    v_is_active BOOLEAN;
    v_role public.user_role;
    v_can_void BOOLEAN;
BEGIN
    -- Precondition assertion: Verify fixture state is an active ADMIN without void permission
    SELECT p.is_active, p.role, a.can_void_payments
    INTO v_is_active, v_role, v_can_void
    FROM public.profiles p
    JOIN public.admins a ON a.id = p.id
    WHERE p.id = 'a7777777-0000-0000-0000-000000000003'::uuid;

    IF v_is_active IS NOT TRUE OR v_role != 'ADMIN' OR v_can_void IS NOT FALSE THEN
        RAISE EXCEPTION 'TEST 3 SETUP ERROR: Fixture must be an active ADMIN with can_void_payments=false (found is_active=%, role=%, can_void=%)',
            v_is_active, v_role, v_can_void;
    END IF;

    BEGIN
        PERFORM public.void_transaction_atomic(
            'c7777777-0000-0000-0000-000000000001'::uuid,
            'No-permission admin void reason exceeding 10 characters',
            'a7777777-0000-0000-0000-000000000003'::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_actual_errm := SQLERRM;
        IF v_actual_errm ILIKE '%does not possess void permissions%' THEN
            v_caught_expected_exception := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 3 FAILED: Caught unexpected error: "%" (SQLSTATE: %)', v_actual_errm, SQLSTATE;
        END IF;
    END;

    IF NOT v_caught_expected_exception THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Function unexpectedly succeeded for ADMIN without void permission!';
    END IF;

    RAISE NOTICE 'TEST 3 PASSED: Active ADMIN without void permission rejected as expected.';
END $$;

-- -----------------------------------------------------------------------------
-- Test 4: Active SUPER_ADMIN without void permission MUST BE REJECTED (Policy Option A)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_caught_expected_exception BOOLEAN := FALSE;
    v_actual_errm TEXT;
    v_is_active BOOLEAN;
    v_role public.user_role;
    v_can_void BOOLEAN;
BEGIN
    -- Precondition assertion: Verify fixture state is an active SUPER_ADMIN without void permission
    SELECT p.is_active, p.role, a.can_void_payments
    INTO v_is_active, v_role, v_can_void
    FROM public.profiles p
    JOIN public.admins a ON a.id = p.id
    WHERE p.id = 'a7777777-0000-0000-0000-000000000004'::uuid;

    IF v_is_active IS NOT TRUE OR v_role != 'SUPER_ADMIN' OR v_can_void IS NOT FALSE THEN
        RAISE EXCEPTION 'TEST 4 SETUP ERROR: Fixture must be an active SUPER_ADMIN with can_void_payments=false (found is_active=%, role=%, can_void=%)',
            v_is_active, v_role, v_can_void;
    END IF;

    BEGIN
        PERFORM public.void_transaction_atomic(
            'c7777777-0000-0000-0000-000000000001'::uuid,
            'No-permission superadmin void reason exceeding 10 characters',
            'a7777777-0000-0000-0000-000000000004'::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_actual_errm := SQLERRM;
        IF v_actual_errm ILIKE '%does not possess void permissions%' THEN
            v_caught_expected_exception := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 4 FAILED: Caught unexpected error: "%" (SQLSTATE: %)', v_actual_errm, SQLSTATE;
        END IF;
    END;

    IF NOT v_caught_expected_exception THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Function unexpectedly succeeded for SUPER_ADMIN without void permission!';
    END IF;

    RAISE NOTICE 'TEST 4 PASSED: Active SUPER_ADMIN without void permission rejected as expected (Policy A).';
END $$;

-- -----------------------------------------------------------------------------
-- Test 5: Caller ID Spoofing (auth.uid() != p_admin_id) MUST BE REJECTED
-- -----------------------------------------------------------------------------
-- Set both request.jwt.claims JSON object and request.jwt.claim.sub scalar
-- to guarantee auth.uid() resolves across all Supabase/PostgREST version variations.
SET LOCAL "request.jwt.claims" = '{"sub": "a7777777-0000-0000-0000-000000000001", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = 'a7777777-0000-0000-0000-000000000001';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    v_caught_expected_exception BOOLEAN := FALSE;
    v_actual_errm TEXT;
BEGIN
    BEGIN
        PERFORM public.void_transaction_atomic(
            'c7777777-0000-0000-0000-000000000001'::uuid,
            'Caller ID spoofing attempt reason exceeding 10 characters',
            'a7777777-0000-0000-0000-000000000005'::uuid -- Targets authorized admin ID
        );
    EXCEPTION WHEN OTHERS THEN
        v_actual_errm := SQLERRM;
        IF v_actual_errm ILIKE '%does not match specified admin_id%' THEN
            v_caught_expected_exception := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 5 FAILED: Caught unexpected error: "%" (SQLSTATE: %)', v_actual_errm, SQLSTATE;
        END IF;
    END;

    IF NOT v_caught_expected_exception THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Spoofed caller was permitted to execute void!';
    END IF;

    RAISE NOTICE 'TEST 5 PASSED: Caller ID spoofing attempt rejected as expected.';
END $$;

RESET "request.jwt.claim.role";
RESET "request.jwt.claim.sub";
RESET "request.jwt.claims";


-- =============================================================================
-- 3. ACCEPTANCE TEST CASES (INDEPENDENT SUCCESS VERIFICATIONS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Test 6: Authorized Active ADMIN with void permission MUST SUCCEED
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_res RECORD;
    v_txn_status public.transaction_status;
    v_txn_voided_by UUID;
    v_txn_void_reason TEXT;
    v_due_rem NUMERIC(12, 2);
    v_due_paid NUMERIC(12, 2);
    v_due_status public.due_status;
    v_audit_count INT;
    v_audit_role public.user_role;
    v_expected_reason CONSTANT TEXT := 'Authorized treasury officer voiding incorrect cash receipt';
BEGIN
    -- Execute void as Authorized ADMIN (a1111111-...05)
    SELECT * INTO v_res FROM public.void_transaction_atomic(
        'c7777777-0000-0000-0000-000000000001'::uuid,
        v_expected_reason,
        'a7777777-0000-0000-0000-000000000005'::uuid
    );

    -- 1. Assert returned row
    IF v_res.transaction_id != 'c7777777-0000-0000-0000-000000000001'::uuid THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Returned transaction_id mismatch: %', v_res.transaction_id;
    END IF;
    IF v_res.restored_balance != 5000.00 THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Returned restored_balance mismatch: % (expected 5000.00)', v_res.restored_balance;
    END IF;

    -- 2. Assert transaction record state
    SELECT status, voided_by, void_reason 
    INTO v_txn_status, v_txn_voided_by, v_txn_void_reason
    FROM public.transactions 
    WHERE id = 'c7777777-0000-0000-0000-000000000001'::uuid;

    IF v_txn_status != 'VOIDED' THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Transaction status is % instead of VOIDED', v_txn_status;
    END IF;
    IF v_txn_voided_by != 'a7777777-0000-0000-0000-000000000005'::uuid THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Transaction voided_by is % instead of admin ID', v_txn_voided_by;
    END IF;
    IF v_txn_void_reason != v_expected_reason THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Transaction void_reason mismatch: %', v_txn_void_reason;
    END IF;

    -- 3. Assert student due state reversal (original: 5000, was paid 1500 -> restored to paid 0, rem 5000, UNPAID)
    SELECT remaining_balance, paid_amount, status
    INTO v_due_rem, v_due_paid, v_due_status
    FROM public.student_dues 
    WHERE id = 'd7777777-0000-0000-0000-000000000001'::uuid;

    IF v_due_rem != 5000.00 THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Restored remaining_balance is % instead of 5000.00', v_due_rem;
    END IF;
    IF v_due_paid != 0.00 THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Due paid_amount is % instead of 0.00', v_due_paid;
    END IF;
    IF v_due_status != 'UNPAID' THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Due status is % instead of UNPAID', v_due_status;
    END IF;

    -- 4. Assert audit log integrity
    SELECT COUNT(*), MAX(actor_role)
    INTO v_audit_count, v_audit_role
    FROM public.audit_logs 
    WHERE entity_id = 'c7777777-0000-0000-0000-000000000001' 
      AND action = 'PAYMENT_VOIDED'
      AND actor_id = 'a7777777-0000-0000-0000-000000000005'::uuid;

    IF v_audit_count < 1 THEN
        RAISE EXCEPTION 'TEST 6 FAILED: PAYMENT_VOIDED audit log entry was not found!';
    END IF;
    IF v_audit_role != 'ADMIN' THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Audit log actor_role is % instead of ADMIN', v_audit_role;
    END IF;

    RAISE NOTICE 'TEST 6 PASSED: Authorized ADMIN void succeeded with complete ledger and audit verification.';
END $$;

-- -----------------------------------------------------------------------------
-- Test 7: Authorized Active SUPER_ADMIN with void permission MUST SUCCEED (INDEPENDENT)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_res RECORD;
    v_txn_status public.transaction_status;
    v_txn_voided_by UUID;
    v_txn_void_reason TEXT;
    v_due_rem NUMERIC(12, 2);
    v_due_paid NUMERIC(12, 2);
    v_due_status public.due_status;
    v_audit_count INT;
    v_audit_role public.user_role;
    v_expected_reason CONSTANT TEXT := 'University financial supervision executive void authorization';
BEGIN
    -- Execute void as Authorized SUPER_ADMIN (a1111111-...06) on Transaction 2
    SELECT * INTO v_res FROM public.void_transaction_atomic(
        'c7777777-0000-0000-0000-000000000002'::uuid,
        v_expected_reason,
        'a7777777-0000-0000-0000-000000000006'::uuid
    );

    -- 1. Assert returned row
    IF v_res.transaction_id != 'c7777777-0000-0000-0000-000000000002'::uuid THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Returned transaction_id mismatch: %', v_res.transaction_id;
    END IF;
    IF v_res.restored_balance != 6000.00 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Returned restored_balance mismatch: % (expected 6000.00)', v_res.restored_balance;
    END IF;

    -- 2. Assert transaction record state
    SELECT status, voided_by, void_reason 
    INTO v_txn_status, v_txn_voided_by, v_txn_void_reason
    FROM public.transactions 
    WHERE id = 'c7777777-0000-0000-0000-000000000002'::uuid;

    IF v_txn_status != 'VOIDED' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Transaction status is % instead of VOIDED', v_txn_status;
    END IF;
    IF v_txn_voided_by != 'a7777777-0000-0000-0000-000000000006'::uuid THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Transaction voided_by is % instead of superadmin ID', v_txn_voided_by;
    END IF;
    IF v_txn_void_reason != v_expected_reason THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Transaction void_reason mismatch: %', v_txn_void_reason;
    END IF;

    -- 3. Assert student due state reversal (original: 6000, was paid 2000 -> restored to paid 0, rem 6000, UNPAID)
    SELECT remaining_balance, paid_amount, status
    INTO v_due_rem, v_due_paid, v_due_status
    FROM public.student_dues 
    WHERE id = 'd7777777-0000-0000-0000-000000000002'::uuid;

    IF v_due_rem != 6000.00 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Restored remaining_balance is % instead of 6000.00', v_due_rem;
    END IF;
    IF v_due_paid != 0.00 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Due paid_amount is % instead of 0.00', v_due_paid;
    END IF;
    IF v_due_status != 'UNPAID' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Due status is % instead of UNPAID', v_due_status;
    END IF;

    -- 4. Assert audit log integrity
    SELECT COUNT(*), MAX(actor_role)
    INTO v_audit_count, v_audit_role
    FROM public.audit_logs 
    WHERE entity_id = 'c7777777-0000-0000-0000-000000000002' 
      AND action = 'PAYMENT_VOIDED'
      AND actor_id = 'a7777777-0000-0000-0000-000000000006'::uuid;

    IF v_audit_count < 1 THEN
        RAISE EXCEPTION 'TEST 7 FAILED: PAYMENT_VOIDED audit log entry was not found for SUPER_ADMIN! (found %)', v_audit_count;
    END IF;
    IF v_audit_role != 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Audit log actor_role is % instead of SUPER_ADMIN', v_audit_role;
    END IF;

    RAISE NOTICE 'TEST 7 PASSED: Authorized SUPER_ADMIN void succeeded with complete ledger and audit verification.';
END $$;

-- -----------------------------------------------------------------------------
-- Test 8: Authorized Active ADMIN with matching auth.uid() (auth.uid() = p_admin_id) MUST SUCCEED
-- -----------------------------------------------------------------------------
-- Simulates an authenticated caller session where auth.uid() matches p_admin_id.
-- Validates that the authentication check (auth.uid() IS NOT NULL AND auth.uid() != p_admin_id)
-- passes cleanly and does not block legitimate authenticated administrators.
--
-- NOTE: This test verifies the SQL-level procedural guard (auth.uid() = p_admin_id) within PostgreSQL.
-- It does NOT claim to verify PostgREST HTTP token processing, JWT cryptographic signature
-- verification, or network-level claims parsing.
SET LOCAL "request.jwt.claims" = '{"sub": "a7777777-0000-0000-0000-000000000005", "role": "authenticated"}';
SET LOCAL "request.jwt.claim.sub" = 'a7777777-0000-0000-0000-000000000005';
SET LOCAL "request.jwt.claim.role" = 'authenticated';

DO $$
DECLARE
    v_res RECORD;
    v_txn_status public.transaction_status;
    v_txn_voided_by UUID;
    v_txn_void_reason TEXT;
    v_due_rem NUMERIC(12, 2);
    v_due_paid NUMERIC(12, 2);
    v_due_status public.due_status;
    v_audit_count INT;
    v_audit_role public.user_role;
    v_expected_reason CONSTANT TEXT := 'Authorized treasury officer voiding incorrect receipt in authenticated session';
BEGIN
    -- Verify auth.uid() is resolved to caller
    IF auth.uid() IS NULL OR auth.uid() != 'a7777777-0000-0000-0000-000000000005'::uuid THEN
        RAISE EXCEPTION 'TEST 8 SETUP ERROR: auth.uid() did not resolve to expected admin UUID: %', auth.uid();
    END IF;

    -- Execute void as Authorized ADMIN (a1111111-...05) on Transaction 3
    SELECT * INTO v_res FROM public.void_transaction_atomic(
        'c7777777-0000-0000-0000-000000000003'::uuid,
        v_expected_reason,
        'a7777777-0000-0000-0000-000000000005'::uuid
    );

    -- 1. Assert returned row
    IF v_res.transaction_id != 'c7777777-0000-0000-0000-000000000003'::uuid THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Returned transaction_id mismatch: %', v_res.transaction_id;
    END IF;
    IF v_res.restored_balance != 4000.00 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Returned restored_balance mismatch: % (expected 4000.00)', v_res.restored_balance;
    END IF;

    -- 2. Assert transaction record state
    SELECT status, voided_by, void_reason 
    INTO v_txn_status, v_txn_voided_by, v_txn_void_reason
    FROM public.transactions 
    WHERE id = 'c7777777-0000-0000-0000-000000000003'::uuid;

    IF v_txn_status != 'VOIDED' THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Transaction status is % instead of VOIDED', v_txn_status;
    END IF;
    IF v_txn_voided_by != 'a7777777-0000-0000-0000-000000000005'::uuid THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Transaction voided_by is % instead of admin ID', v_txn_voided_by;
    END IF;
    IF v_txn_void_reason != v_expected_reason THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Transaction void_reason mismatch: %', v_txn_void_reason;
    END IF;

    -- 3. Assert student due state reversal (original: 4000, was paid 1000 -> restored to paid 0, rem 4000, UNPAID)
    SELECT remaining_balance, paid_amount, status
    INTO v_due_rem, v_due_paid, v_due_status
    FROM public.student_dues 
    WHERE id = 'd7777777-0000-0000-0000-000000000003'::uuid;

    IF v_due_rem != 4000.00 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Restored remaining_balance is % instead of 4000.00', v_due_rem;
    END IF;
    IF v_due_paid != 0.00 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Due paid_amount is % instead of 0.00', v_due_paid;
    END IF;
    IF v_due_status != 'UNPAID' THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Due status is % instead of UNPAID', v_due_status;
    END IF;

    -- 4. Assert audit log integrity
    SELECT COUNT(*), MAX(actor_role)
    INTO v_audit_count, v_audit_role
    FROM public.audit_logs 
    WHERE entity_id = 'c7777777-0000-0000-0000-000000000003' 
      AND action = 'PAYMENT_VOIDED'
      AND actor_id = 'a7777777-0000-0000-0000-000000000005'::uuid;

    IF v_audit_count < 1 THEN
        RAISE EXCEPTION 'TEST 8 FAILED: PAYMENT_VOIDED audit log entry was not found for authenticated ADMIN!';
    END IF;
    IF v_audit_role != 'ADMIN' THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Audit log actor_role is % instead of ADMIN', v_audit_role;
    END IF;

    RAISE NOTICE 'TEST 8 PASSED: Authorized ADMIN void in simulated authenticated session succeeded.';
END $$;

RESET "request.jwt.claim.role";
RESET "request.jwt.claim.sub";
RESET "request.jwt.claims";

-- -----------------------------------------------------------------------------
-- Test 9: Re-voiding an ALREADY_VOIDED transaction MUST BE REJECTED
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_caught_expected_exception BOOLEAN := FALSE;
    v_actual_errm TEXT;
BEGIN
    BEGIN
        PERFORM public.void_transaction_atomic(
            'c7777777-0000-0000-0000-000000000001'::uuid, -- Already voided in Test 6
            'Attempting to re-void an already voided transaction',
            'a7777777-0000-0000-0000-000000000005'::uuid
        );
    EXCEPTION WHEN OTHERS THEN
        v_actual_errm := SQLERRM;
        IF v_actual_errm ILIKE '%is already voided%' THEN
            v_caught_expected_exception := TRUE;
        ELSE
            RAISE EXCEPTION 'TEST 9 FAILED: Caught unexpected error: "%" (SQLSTATE: %)', v_actual_errm, SQLSTATE;
        END IF;
    END;

    IF NOT v_caught_expected_exception THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Re-voiding an already voided transaction unexpectedly succeeded!';
    END IF;

    RAISE NOTICE 'TEST 9 PASSED: Re-voiding an already voided transaction rejected as expected.';
END $$;


-- =============================================================================
-- 4. ATOMIC ROLLBACK GUARANTEE
-- =============================================================================
-- Roll back all test fixtures, seed inserts, void mutations, and audit records.
-- Guarantees zero residual state changes in database.
ROLLBACK;

-- Documented Verification Queries (To execute post-run):
-- 1. Scoped Transaction Check (Expected: 0)
--    SELECT COUNT(*) FROM public.transactions WHERE id IN ('c7777777-0000-0000-0000-000000000001'::uuid, 'c7777777-0000-0000-0000-000000000002'::uuid, 'c7777777-0000-0000-0000-000000000003'::uuid);
-- 2. Scoped Audit Log Check (Expected: 0)
--    SELECT COUNT(*) FROM public.audit_logs WHERE entity_id IN ('c7777777-0000-0000-0000-000000000001', 'c7777777-0000-0000-0000-000000000002', 'c7777777-0000-0000-0000-000000000003');
