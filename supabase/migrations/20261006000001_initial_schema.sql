-- =============================================================================
-- Migration: 20261006000001_initial_schema.sql
-- Description: Core financial schema for Cairo University Faculty of Engineering
-- Pre-Production Pilot System
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER', 'POS', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('COMPLETED', 'VOIDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE due_status AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE semester_season AS ENUM ('FALL', 'SPRING', 'SUMMER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES (Base user table linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'STUDENT',
    national_id VARCHAR(14) UNIQUE,
    full_name_ar VARCHAR(255) NOT NULL,
    full_name_en VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. STUDENTS (Specializes profiles for students)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_number VARCHAR(20) NOT NULL UNIQUE, -- e.g., 'DEMO-100001'
    academic_program VARCHAR(100) NOT NULL,    -- 'Credit Hours System' or 'Mainstream Program'
    academic_department VARCHAR(100) NOT NULL, -- 'Computer Engineering', 'Mechanical', etc.
    academic_level INT NOT NULL DEFAULT 1,      -- 1 to 5
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ADMINS (Specializes profiles for financial administration)
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    office_department VARCHAR(100) NOT NULL DEFAULT 'Student Financial Affairs',
    can_void_payments BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ACADEMIC SEMESTERS
CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,          -- '2024-FALL', '2025-SPRING'
    name_ar VARCHAR(100) NOT NULL,             -- 'الفصل الدراسي الأول 2024/2025'
    name_en VARCHAR(100) NOT NULL,             -- 'Fall Semester 2024/2025'
    academic_year VARCHAR(20) NOT NULL,        -- '2024/2025'
    season semester_season NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_semester_dates CHECK (end_date >= start_date)
);

-- 7. STUDENT DUES (Assessed semester fees per student)
-- Simplified pilot fee unit: Student + Semester + Total Due
CREATE TABLE IF NOT EXISTS public.student_dues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
    title_ar VARCHAR(255) NOT NULL DEFAULT 'المصروفات الدراسية للفصل',
    title_en VARCHAR(255) NOT NULL DEFAULT 'Semester Tuition & Fees',
    original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    net_due_amount NUMERIC(12, 2) GENERATED ALWAYS AS (original_amount - discount_amount) STORED,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    remaining_balance NUMERIC(12, 2) GENERATED ALWAYS AS (original_amount - discount_amount - paid_amount) STORED,
    status due_status NOT NULL DEFAULT 'UNPAID',
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_semester_due UNIQUE (student_id, semester_id),
    CONSTRAINT check_net_positive CHECK (original_amount >= discount_amount),
    CONSTRAINT check_balance_non_negative CHECK (original_amount - discount_amount - paid_amount >= 0)
);

-- 8. SEQUENCES FOR MONOTONIC TRANSACTION & RECEIPT NUMBERS
CREATE SEQUENCE IF NOT EXISTS txn_number_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS rcp_number_seq START WITH 10001;

-- 9. FINANCIAL TRANSACTIONS (Append-Only Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(50) NOT NULL UNIQUE, -- 'CUFE-TXN-2026-10001'
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
    student_due_id UUID NOT NULL REFERENCES public.student_dues(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
    payment_method payment_method NOT NULL,
    payment_date DATE NOT NULL,
    payment_time TIME NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference_number VARCHAR(100),              -- POS slip / Bank voucher
    notes TEXT,
    status transaction_status NOT NULL DEFAULT 'COMPLETED',
    idempotency_key VARCHAR(100) UNIQUE,
    recorded_by UUID NOT NULL REFERENCES public.admins(id),
    
    -- Voiding Fields (Controlled reversal without hard deletes)
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES public.admins(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. RECEIPTS (Metadata stored in DB only - dynamic on-demand PDF)
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) NOT NULL UNIQUE,     -- 'CUFE-RCP-2026-10001'
    transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
    verification_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 HMAC (generated on server)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,    -- Snapshot of cashier, method, date
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. AUDIT LOGS (Immutable Activity Log)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES auth.users(id),
    actor_role user_role,
    action VARCHAR(100) NOT NULL,                   -- 'PAYMENT_RECORDED', 'PAYMENT_VOIDED', etc.
    entity_name VARCHAR(50) NOT NULL,               -- 'transactions', 'student_dues'
    entity_id VARCHAR(100) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_students_student_number ON public.students(student_number);
CREATE INDEX IF NOT EXISTS idx_profiles_names ON public.profiles(full_name_ar, full_name_en);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_student_dues_lookup ON public.student_dues(student_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_transactions_student ON public.transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_semester ON public.transactions(semester_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recorded_at ON public.transactions(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON public.transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_receipts_hash ON public.receipts(verification_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON public.receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 13. IMMUTABILITY TRIGGER: PREVENT HARD DELETION OF FINANCIAL RECORDS
-- Explicit search_path set to prevent trojan / hijack attacks
CREATE OR REPLACE FUNCTION public.prevent_financial_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Financial deletion is strictly prohibited on table (%). Reversals must use audited voiding.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_delete_transactions ON public.transactions;
CREATE TRIGGER trg_no_delete_transactions
BEFORE DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();

DROP TRIGGER IF EXISTS trg_no_delete_receipts ON public.receipts;
CREATE TRIGGER trg_no_delete_receipts
BEFORE DELETE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();

DROP TRIGGER IF EXISTS trg_no_delete_student_dues ON public.student_dues;
CREATE TRIGGER trg_no_delete_student_dues
BEFORE DELETE ON public.student_dues
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_hard_delete();
