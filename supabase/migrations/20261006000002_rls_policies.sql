-- =============================================================================
-- Migration: 20261006000002_rls_policies.sql
-- Description: Strict Row Level Security (RLS) policies for financial safety
-- Pre-Production Pilot System
-- =============================================================================

-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. HELPER FUNCTION TO GET AUTHENTICATED USER ROLE (SECURITY DEFINER WITH SAFE SEARCH_PATH)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role public.user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid() AND is_active = TRUE;
    
    RETURN v_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;


-- 3. PROFILES POLICIES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
    ON public.profiles FOR SELECT
    USING (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

DROP POLICY IF EXISTS "No direct client insert on profiles" ON public.profiles;
CREATE POLICY "No direct client insert on profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on profiles" ON public.profiles;
CREATE POLICY "No direct client update on profiles"
    ON public.profiles FOR UPDATE
    USING (false);

-- 4. STUDENTS POLICIES
DROP POLICY IF EXISTS "Students can read own student record" ON public.students;
CREATE POLICY "Students can read own student record"
    ON public.students FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all student records" ON public.students;
CREATE POLICY "Admins can read all student records"
    ON public.students FOR SELECT
    USING (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

DROP POLICY IF EXISTS "No direct client insert on students" ON public.students;
CREATE POLICY "No direct client insert on students"
    ON public.students FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on students" ON public.students;
CREATE POLICY "No direct client update on students"
    ON public.students FOR UPDATE
    USING (false);

-- 5. ADMINS POLICIES
DROP POLICY IF EXISTS "Admins can read admin directory" ON public.admins;
CREATE POLICY "Admins can read admin directory"
    ON public.admins FOR SELECT
    USING (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

DROP POLICY IF EXISTS "No direct client insert on admins" ON public.admins;
CREATE POLICY "No direct client insert on admins"
    ON public.admins FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on admins" ON public.admins;
CREATE POLICY "No direct client update on admins"
    ON public.admins FOR UPDATE
    USING (false);

-- 6. SEMESTERS POLICIES (All authenticated users can view active semesters)
DROP POLICY IF EXISTS "Authenticated users can read semesters" ON public.semesters;
CREATE POLICY "Authenticated users can read semesters"
    ON public.semesters FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "No direct client insert on semesters" ON public.semesters;
CREATE POLICY "No direct client insert on semesters"
    ON public.semesters FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on semesters" ON public.semesters;
CREATE POLICY "No direct client update on semesters"
    ON public.semesters FOR UPDATE
    USING (false);

-- 7. STUDENT DUES POLICIES (STUDENT READ ONLY OWN; ADMINS READ ALL)
DROP POLICY IF EXISTS "Students can read own dues" ON public.student_dues;
CREATE POLICY "Students can read own dues"
    ON public.student_dues FOR SELECT
    USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all student dues" ON public.student_dues;
CREATE POLICY "Admins can read all student dues"
    ON public.student_dues FOR SELECT
    USING (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- ZERO DIRECT CLIENT WRITES ON DUES
DROP POLICY IF EXISTS "No direct client insert on student dues" ON public.student_dues;
CREATE POLICY "No direct client insert on student dues"
    ON public.student_dues FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on student dues" ON public.student_dues;
CREATE POLICY "No direct client update on student dues"
    ON public.student_dues FOR UPDATE
    USING (false);

-- 8. TRANSACTIONS POLICIES (STUDENT READ ONLY OWN; ADMINS READ ALL)
DROP POLICY IF EXISTS "Students can read own transactions" ON public.transactions;
CREATE POLICY "Students can read own transactions"
    ON public.transactions FOR SELECT
    USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all transactions" ON public.transactions;
CREATE POLICY "Admins can read all transactions"
    ON public.transactions FOR SELECT
    USING (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- ZERO DIRECT CLIENT WRITES ON TRANSACTIONS
-- All mutations MUST happen via the atomic stored procedure
DROP POLICY IF EXISTS "No direct client insert on transactions" ON public.transactions;
CREATE POLICY "No direct client insert on transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on transactions" ON public.transactions;
CREATE POLICY "No direct client update on transactions"
    ON public.transactions FOR UPDATE
    USING (false);

-- 9. RECEIPTS POLICIES (STUDENT READ ONLY OWN; ADMINS READ ALL)
DROP POLICY IF EXISTS "Students can read own receipts" ON public.receipts;
CREATE POLICY "Students can read own receipts"
    ON public.receipts FOR SELECT
    USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all receipts" ON public.receipts;
CREATE POLICY "Admins can read all receipts"
    ON public.receipts FOR SELECT
    USING (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

-- ZERO DIRECT CLIENT WRITES ON RECEIPTS
DROP POLICY IF EXISTS "No direct client insert on receipts" ON public.receipts;
CREATE POLICY "No direct client insert on receipts"
    ON public.receipts FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on receipts" ON public.receipts;
CREATE POLICY "No direct client update on receipts"
    ON public.receipts FOR UPDATE
    USING (false);

-- 10. AUDIT LOGS POLICIES (IMMUTABLE - ADMINS READ ONLY)
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.get_user_role() IN ('ADMIN', 'SUPER_ADMIN'));

DROP POLICY IF EXISTS "No direct client insert on audit logs" ON public.audit_logs;
CREATE POLICY "No direct client insert on audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client update on audit logs" ON public.audit_logs;
CREATE POLICY "No direct client update on audit logs"
    ON public.audit_logs FOR UPDATE
    USING (false);
