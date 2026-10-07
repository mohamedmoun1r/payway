-- =============================================================================
-- Supabase Database Seed File: seed.sql
-- Description: Synthetic DEMO DATA ONLY for Cairo University Faculty of Engineering
-- Pre-Production Pilot System
-- =============================================================================

-- =============================================================================
-- 1. AUTH USERS (Synthetic Mock Credentials)
-- Password for all demo accounts: 'demo123456'
-- Encrypted with standard bcrypt ($2a$10$...)
-- =============================================================================
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
-- Admin 1 (Cashier Desk 1)
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
 'admin.cashier@eng.cu.edu.eg', crypt('demo123456', gen_salt('bf')), NOW(), 
 '{"provider":"email","providers":["email"]}', '{"full_name_ar":"مسؤول خزينة الكلية","full_name_en":"Treasury Cashier"}', NOW(), NOW()),

-- Admin 2 (Finance Supervisor - Void Permissions)
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
 'admin.super@eng.cu.edu.eg', crypt('demo123456', gen_salt('bf')), NOW(), 
 '{"provider":"email","providers":["email"]}', '{"full_name_ar":"مشرف الشؤون المالية","full_name_en":"Finance Supervisor"}', NOW(), NOW()),

-- Student 1 (Partially Paid)
('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
 'demo.student1@eng.cu.edu.eg', crypt('demo123456', gen_salt('bf')), NOW(), 
 '{"provider":"email","providers":["email"]}', '{"student_number":"DEMO-100001"}', NOW(), NOW()),

-- Student 2 (Fully Paid)
('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
 'demo.student2@eng.cu.edu.eg', crypt('demo123456', gen_salt('bf')), NOW(), 
 '{"provider":"email","providers":["email"]}', '{"student_number":"DEMO-100002"}', NOW(), NOW()),

-- Student 3 (Unpaid)
('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
 'demo.student3@eng.cu.edu.eg', crypt('demo123456', gen_salt('bf')), NOW(), 
 '{"provider":"email","providers":["email"]}', '{"student_number":"DEMO-100003"}', NOW(), NOW()),

-- Student 4 (Scholarship Discount)
('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
 'demo.student4@eng.cu.edu.eg', crypt('demo123456', gen_salt('bf')), NOW(), 
 '{"provider":"email","providers":["email"]}', '{"student_number":"DEMO-100004"}', NOW(), NOW()),

-- Student 5 (Multi-Semester History)
('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
 'demo.student5@eng.cu.edu.eg', crypt('demo123456', gen_salt('bf')), NOW(), 
 '{"provider":"email","providers":["email"]}', '{"student_number":"DEMO-100005"}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. PROFILES
-- =============================================================================
INSERT INTO public.profiles (
    id, role, national_id, full_name_ar, full_name_en, email, phone, is_demo, is_active
) VALUES
('00000000-0000-0000-0000-000000000001', 'ADMIN', '28001010000001', 'أ / محمد صبري النجار (خزينة 1)', 'Mohamed Sabry El-Naggar (Cashier 1)', 'admin.cashier@eng.cu.edu.eg', '+201000000001', TRUE, TRUE),
('00000000-0000-0000-0000-000000000002', 'SUPER_ADMIN', '27501010000002', 'د / محمود سامي خليل (مدير الحسابات)', 'Dr. Mahmoud Samy Khalil (Finance Director)', 'admin.super@eng.cu.edu.eg', '+201000000002', TRUE, TRUE),
('00000000-0000-0000-0000-000000000011', 'STUDENT', '29901010000011', 'أحمد محمود علي', 'Ahmed Mahmoud Ali', 'demo.student1@eng.cu.edu.eg', '+201000000011', TRUE, TRUE),
('00000000-0000-0000-0000-000000000012', 'STUDENT', '29901010000012', 'سارة حسن إبراهيم', 'Sara Hassan Ibrahim', 'demo.student2@eng.cu.edu.eg', '+201000000012', TRUE, TRUE),
('00000000-0000-0000-0000-000000000013', 'STUDENT', '29901010000013', 'يوسف طارق المنشاوي', 'Youssef Tarek El-Minshawy', 'demo.student3@eng.cu.edu.eg', '+201000000013', TRUE, TRUE),
('00000000-0000-0000-0000-000000000014', 'STUDENT', '29901010000014', 'نور عمرو عبد الرحمن', 'Nour Amr Abdel-Rahman', 'demo.student4@eng.cu.edu.eg', '+201000000014', TRUE, TRUE),
('00000000-0000-0000-0000-000000000015', 'STUDENT', '29901010000015', 'مريم خالد مصطفى', 'Mariam Khaled Mostafa', 'demo.student5@eng.cu.edu.eg', '+201000000015', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
    full_name_ar = EXCLUDED.full_name_ar,
    full_name_en = EXCLUDED.full_name_en;

-- =============================================================================
-- 3. ADMINS
-- =============================================================================
INSERT INTO public.admins (id, employee_id, office_department, can_void_payments) VALUES
('00000000-0000-0000-0000-000000000001', 'DEMO-ADM-001', 'Student Financial Affairs - Treasury', FALSE),
('00000000-0000-0000-0000-000000000002', 'DEMO-ADM-002', 'Student Financial Affairs - General Administration', TRUE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. STUDENTS
-- =============================================================================
INSERT INTO public.students (id, student_number, academic_program, academic_department, academic_level) VALUES
('00000000-0000-0000-0000-000000000011', 'DEMO-100001', 'Credit Hours System', 'Computer & Systems Engineering', 3),
('00000000-0000-0000-0000-000000000012', 'DEMO-100002', 'Mainstream Program', 'Architectural Engineering', 4),
('00000000-0000-0000-0000-000000000013', 'DEMO-100003', 'Credit Hours System', 'Mechanical Power Engineering', 2),
('00000000-0000-0000-0000-000000000014', 'DEMO-100004', 'Credit Hours System', 'Electronics & Communications', 3),
('00000000-0000-0000-0000-000000000015', 'DEMO-100005', 'Mainstream Program', 'Civil Engineering', 4)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 5. SEMESTERS
-- =============================================================================
INSERT INTO public.semesters (id, code, name_ar, name_en, academic_year, season, start_date, end_date, is_current) VALUES
('11111111-1111-1111-1111-111111111111', '2024-FALL', 'الفصل الدراسي الأول 2024/2025', 'Fall Semester 2024/2025', '2024/2025', 'FALL', '2024-09-28', '2025-01-30', TRUE),
('22222222-2222-2222-2222-222222222222', '2024-SPRING', 'الفصل الدراسي الثاني 2023/2024', 'Spring Semester 2023/2024', '2023/2024', 'SPRING', '2024-02-10', '2024-06-20', FALSE),
('33333333-3333-3333-3333-333333333333', '2023-FALL', 'الفصل الدراسي الأول 2023/2024', 'Fall Semester 2023/2024', '2023/2024', 'FALL', '2023-09-30', '2024-01-25', FALSE)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6. STUDENT DUES
-- =============================================================================
INSERT INTO public.student_dues (
    id, student_id, semester_id, title_ar, title_en, 
    original_amount, discount_amount, paid_amount, status, due_date
) VALUES
-- Student 1 (DEMO-100001): Fall 2024 - Net 15,000, Paid 10,000, Remaining 5,000 (Partially Paid)
('d1111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 
 'المصروفات الدراسية للفصل الأول', 'Fall Tuition & Lab Fees', 15000.00, 0.00, 10000.00, 'PARTIALLY_PAID', '2024-11-15'),

-- Student 2 (DEMO-100002): Fall 2024 - Net 12,000, Paid 12,000, Remaining 0 (Paid)
('d2222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 
 'المصروفات الدراسية للفصل الأول', 'Fall Tuition & Lab Fees', 12000.00, 0.00, 12000.00, 'PAID', '2024-11-15'),

-- Student 3 (DEMO-100003): Fall 2024 - Net 15,000, Paid 0, Remaining 15,000 (Unpaid)
('d3333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 
 'المصروفات الدراسية للفصل الأول', 'Fall Tuition & Lab Fees', 15000.00, 0.00, 0.00, 'UNPAID', '2024-11-15'),

-- Student 4 (DEMO-100004): Fall 2024 - Original 18,000, Discount 3,000, Net 15,000, Paid 15,000, Remaining 0 (Paid with Scholarship)
('d4444444-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 
 'مصروفات الساعات المعتمدة (منحة تفوق)', 'Credit Hours Tuition (Academic Scholarship)', 18000.00, 3000.00, 15000.00, 'PAID', '2024-11-15'),

-- Student 5 (DEMO-100005): Fall 2024 - Net 12,000, Paid 0, Remaining 12,000 (Unpaid)
('d5555555-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 
 'المصروفات الدراسية للفصل الأول', 'Fall Tuition & Lab Fees', 12000.00, 0.00, 0.00, 'UNPAID', '2024-11-15'),

-- Student 5 (DEMO-100005): Spring 2024 - Net 11,500, Paid 11,500, Remaining 0 (History - Paid)
('d5555555-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 
 'المصروفات الدراسية للفصل الثاني', 'Spring Tuition & Lab Fees', 11500.00, 0.00, 11500.00, 'PAID', '2024-03-20'),

-- Student 5 (DEMO-100005): Fall 2023 - Net 11,000, Paid 11,000, Remaining 0 (History - Paid)
('d5555555-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', 
 'المصروفات الدراسية للفصل الأول', 'Fall Tuition & Lab Fees', 11000.00, 0.00, 11000.00, 'PAID', '2023-11-10')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 7. TRANSACTIONS
-- =============================================================================
INSERT INTO public.transactions (
    id, transaction_number, student_id, semester_id, student_due_id,
    amount, currency, payment_method, payment_date, payment_time,
    reference_number, notes, status, idempotency_key, recorded_by
) VALUES
-- Transaction 1: Student 1 paid 10,000 Cash
('a1111111-0000-0000-0000-000000000001', 'CUFE-TXN-2024-010001', 
 '00000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'd1111111-0000-0000-0000-000000000001',
 10000.00, 'EGP', 'CASH', '2024-10-06', '11:30:00',
 'VOUCHER-CASH-9910', 'سداد نقدي مثبت بقسيمة الخزينة رقم 9910', 'COMPLETED', 'IDEMP-DEMO-TXN-001', '00000000-0000-0000-0000-000000000001'),

-- Transaction 2: Student 2 paid 6,000 POS (First installment)
('a2222222-0000-0000-0000-000000000001', 'CUFE-TXN-2024-010002', 
 '00000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'd2222222-0000-0000-0000-000000000001',
 6000.00, 'EGP', 'POS', '2024-10-02', '10:15:00',
 'POS-AUTH-882194', 'سداد عبر نقطة بيع البنك الأهلي بالكلية', 'COMPLETED', 'IDEMP-DEMO-TXN-002', '00000000-0000-0000-0000-000000000001'),

-- Transaction 3: Student 2 paid 6,000 Cash (Second installment - Paid in Full)
('a2222222-0000-0000-0000-000000000002', 'CUFE-TXN-2024-010003', 
 '00000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'd2222222-0000-0000-0000-000000000001',
 6000.00, 'EGP', 'CASH', '2024-10-05', '12:00:00',
 'VOUCHER-CASH-9945', 'سداد القسط الثاني نقداً بالخزينة', 'COMPLETED', 'IDEMP-DEMO-TXN-003', '00000000-0000-0000-0000-000000000001'),

-- Transaction 4: Student 4 paid 15,000 Bank Transfer
('a4444444-0000-0000-0000-000000000001', 'CUFE-TXN-2024-010004', 
 '00000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'd4444444-0000-0000-0000-000000000001',
 15000.00, 'EGP', 'BANK_TRANSFER', '2024-10-01', '09:45:00',
 'BM-TRANS-4481023', 'تحويل بنكي على حساب الكلية ببنك مصر', 'COMPLETED', 'IDEMP-DEMO-TXN-004', '00000000-0000-0000-0000-000000000002'),

-- Transaction 5: Student 5 historical Spring 2024 (11,500 Cash)
('a5555555-0000-0000-0000-000000000001', 'CUFE-TXN-2024-008120', 
 '00000000-0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 'd5555555-0000-0000-0000-000000000002',
 11500.00, 'EGP', 'CASH', '2024-02-15', '11:00:00',
 'VOUCHER-CASH-7412', 'سداد المصروفات بالكامل', 'COMPLETED', 'IDEMP-DEMO-TXN-005', '00000000-0000-0000-0000-000000000001'),

-- Transaction 6: Student 5 historical Fall 2023 (11,000 Cash)
('a5555555-0000-0000-0000-000000000002', 'CUFE-TXN-2023-004501', 
 '00000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', 'd5555555-0000-0000-0000-000000000003',
 11000.00, 'EGP', 'CASH', '2023-10-10', '10:30:00',
 'VOUCHER-CASH-5100', 'سداد الفصل الأول', 'COMPLETED', 'IDEMP-DEMO-TXN-006', '00000000-0000-0000-0000-000000000001'),

-- Transaction 7 (CONTROLLED VOIDED TRANSACTION FOR AUDIT VERIFICATION)
('a9999999-0000-0000-0000-000000000001', 'CUFE-TXN-2024-009988', 
 '00000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'd3333333-0000-0000-0000-000000000001',
 5000.00, 'EGP', 'BANK_TRANSFER', '2024-10-04', '14:20:00',
 'ERR-TRANS-9901', 'معاملة مسجلة بالخطأ تم إلغاؤها عبر المشرف المالي', 'VOIDED', 'IDEMP-DEMO-TXN-VOID', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Update Void Metadata on Transaction 7
UPDATE public.transactions
SET 
    void_reason = 'Duplicate entry recorded by cashier slip error. Reversed 5,000 EGP back to student balance.',
    voided_at = '2024-10-04 14:25:00+02',
    voided_by = '00000000-0000-0000-0000-000000000002'
WHERE id = 'a9999999-0000-0000-0000-000000000001';

-- =============================================================================
-- 8. RECEIPTS
-- =============================================================================
INSERT INTO public.receipts (
    id, receipt_number, transaction_id, student_id, issued_at,
    total_amount, currency, verification_hash, metadata
) VALUES
('b1111111-0000-0000-0000-000000000001', 'CUFE-RCP-2024-010001', 
 'a1111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', '2024-10-06 11:30:00+02',
 10000.00, 'EGP', 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f01',
 '{"recorded_by":"DEMO-ADM-001","payment_method":"CASH","student_number":"DEMO-100001"}'::jsonb),

('b2222222-0000-0000-0000-000000000001', 'CUFE-RCP-2024-010002', 
 'a2222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', '2024-10-02 10:15:00+02',
 6000.00, 'EGP', 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9002',
 '{"recorded_by":"DEMO-ADM-001","payment_method":"POS","student_number":"DEMO-100002"}'::jsonb),

('b2222222-0000-0000-0000-000000000002', 'CUFE-RCP-2024-010003', 
 'a2222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', '2024-10-05 12:00:00+02',
 6000.00, 'EGP', 'c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a003',
 '{"recorded_by":"DEMO-ADM-001","payment_method":"CASH","student_number":"DEMO-100002"}'::jsonb),

('b4444444-0000-0000-0000-000000000001', 'CUFE-RCP-2024-010004', 
 'a4444444-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', '2024-10-01 09:45:00+02',
 15000.00, 'EGP', 'd4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b004',
 '{"recorded_by":"DEMO-ADM-002","payment_method":"BANK_TRANSFER","student_number":"DEMO-100004"}'::jsonb),

('b5555555-0000-0000-0000-000000000001', 'CUFE-RCP-2024-008120', 
 'a5555555-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000015', '2024-02-15 11:00:00+02',
 11500.00, 'EGP', 'e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c005',
 '{"recorded_by":"DEMO-ADM-001","payment_method":"CASH","student_number":"DEMO-100005"}'::jsonb),

('b5555555-0000-0000-0000-000000000002', 'CUFE-RCP-2023-004501', 
 'a5555555-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000015', '2023-10-10 10:30:00+02',
 11000.00, 'EGP', 'f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d006',
 '{"recorded_by":"DEMO-ADM-001","payment_method":"CASH","student_number":"DEMO-100005"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9. AUDIT LOGS (Idempotent seed using WHERE NOT EXISTS)
-- =============================================================================
INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_name, entity_id, before_state, after_state, created_at
)
SELECT 
    v.actor_id, v.actor_role, v.action, v.entity_name, v.entity_id, v.before_state, v.after_state, v.created_at
FROM (
    VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid, 'ADMIN'::public.user_role, 'PAYMENT_RECORDED'::varchar, 'transactions'::varchar, 'a1111111-0000-0000-0000-000000000001'::varchar,
     '{"previous_balance":15000}'::jsonb,
     '{"amount":10000,"new_balance":5000,"txn_number":"CUFE-TXN-2024-010001","rcp_number":"CUFE-RCP-2024-010001"}'::jsonb,
     '2024-10-06 11:30:14+02'::timestamptz),

    ('00000000-0000-0000-0000-000000000001'::uuid, 'ADMIN'::public.user_role, 'PAYMENT_RECORDED'::varchar, 'transactions'::varchar, 'a2222222-0000-0000-0000-000000000001'::varchar,
     '{"previous_balance":12000}'::jsonb,
     '{"amount":6000,"new_balance":6000,"txn_number":"CUFE-TXN-2024-010002","rcp_number":"CUFE-RCP-2024-010002"}'::jsonb,
     '2024-10-02 10:15:02+02'::timestamptz),

    ('00000000-0000-0000-0000-000000000001'::uuid, 'ADMIN'::public.user_role, 'PAYMENT_RECORDED'::varchar, 'transactions'::varchar, 'a2222222-0000-0000-0000-000000000002'::varchar,
     '{"previous_balance":6000}'::jsonb,
     '{"amount":6000,"new_balance":0,"txn_number":"CUFE-TXN-2024-010003","rcp_number":"CUFE-RCP-2024-010003"}'::jsonb,
     '2024-10-05 12:00:15+02'::timestamptz),

    ('00000000-0000-0000-0000-000000000002'::uuid, 'SUPER_ADMIN'::public.user_role, 'PAYMENT_RECORDED'::varchar, 'transactions'::varchar, 'a4444444-0000-0000-0000-000000000001'::varchar,
     '{"previous_balance":15000}'::jsonb,
     '{"amount":15000,"new_balance":0,"txn_number":"CUFE-TXN-2024-010004","rcp_number":"CUFE-RCP-2024-010004"}'::jsonb,
     '2024-10-01 09:45:30+02'::timestamptz),

    ('00000000-0000-0000-0000-000000000002'::uuid, 'SUPER_ADMIN'::public.user_role, 'PAYMENT_VOIDED'::varchar, 'transactions'::varchar, 'a9999999-0000-0000-0000-000000000001'::varchar,
     '{"status":"COMPLETED","amount":5000}'::jsonb,
     '{"status":"VOIDED","void_reason":"Duplicate entry recorded by cashier slip error. Reversed 5,000 EGP back to student balance.","restored_balance":15000}'::jsonb,
     '2024-10-04 14:25:00+02'::timestamptz)
) AS v(actor_id, actor_role, action, entity_name, entity_id, before_state, after_state, created_at)
WHERE NOT EXISTS (
    SELECT 1 FROM public.audit_logs a 
    WHERE a.entity_id = v.entity_id AND a.action = v.action
);
