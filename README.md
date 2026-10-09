# Student Financial Portal | البوابة المالية للطلاب
### Cairo University — Faculty of Engineering (CUFE) | جامعة القاهرة — كلية الهندسة
*Pre-Production Pilot Financial Management System | النظام المالي التجريبي*

---

> ⚠️ **PRE-PRODUCTION PILOT ENVIRONMENT — DEMO DATA ONLY — NO REAL TRANSACTIONS**  
> ⚠️ **بيئة تجريبية قبل الإنتاج — بيانات تجريبية فقط — لا توجد معاملات حقيقية**

---

## 📌 Project Overview
The **Student Financial Portal** is a pre-production financial tracking and treasury management system designed for Cairo University Faculty of Engineering. 

In this pilot version:
- **Online payment is disabled.** All payments are recorded manually by authorized treasury cashiers and finance officers.
- **Students** can log in to review assessed semester fees, check real-time outstanding balances, inspect payment history, and download verifiable official receipts.
- **Admins** can look up students by ID or name, inspect semester account ledgers, record manual payments (Cash, Bank Transfer, POS, Other), issue verifiable receipts, and perform controlled voiding under strict audit logs.
- The system is built with **Arabic-first internationalization (RTL)** and a toggle for English (LTR).

---

## 🛠️ Technology Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS with native RTL direction support
- **Icons:** Lucide React
- **Typography:** Cairo font (`next/font/google`)
- **Database & Auth:** Supabase PostgreSQL 15+ & Supabase Auth (`@supabase/ssr`)
- **Validation:** Zod schemas
- **Architecture:** Zero-cost on-demand PDF receipts, privacy-preserving QR verification, server-side HMAC isolation

---

## 🔐 Authentication & Authorization Architecture (Phase 3)

The application implements a multi-tier, fail-closed authentication and authorization model using `@supabase/ssr` with HttpOnly cookies.

### 1. Client Architecture Separation
To prevent privilege escalation and credential leakage:
- **Browser Client (`src/lib/supabase/client.ts`):** Uses public anon key for safe client operations.
- **Server Client (`src/lib/supabase/server.ts`):** Uses Next.js 15 `cookies()` to securely read and set HttpOnly session cookies across Server Components and Server Actions.
- **Privileged Admin Client (`src/lib/supabase/admin.ts`):** Uses `SUPABASE_SERVICE_ROLE_KEY` with `import 'server-only'` to guarantee it can never be bundled or invoked on the browser. Used solely for backend lookups and audit logging.

### 2. Session Management & Middleware
- **Session Token Refresh (`src/middleware.ts`):** Intercepts requests, validates locale routing (`/ar` default, `/en`), and refreshes expiring Supabase Auth tokens via `@supabase/ssr`.
- **Edge Route Protection:** Unauthenticated access to `/[locale]/student/*` and `/[locale]/admin/*` is immediately redirected to `/[locale]/login?redirectTo=...`.
- **Fail-Closed Defense:** Middleware is a preliminary boundary; strict authorization is enforced server-side inside layouts and Server Components.

### 3. Server-Side Authorization Guards (`src/lib/auth/guards.ts`)
Client-side role claims are never trusted. All permissions are verified directly against database records in `public.profiles`, `public.students`, and `public.admins`:
- `requireAuthenticatedUser(locale, redirectTo)`: Asserts valid session and active profile (`is_active = true`).
- `requireStudent(locale, currentPath)`: Ensures user is authenticated, has role `STUDENT`, and owns a valid record in `public.students`. Redirects admins to `/admin/dashboard` and logs unauthorized attempts.
- `requireAdmin(locale, currentPath)`: Ensures user is authenticated, has role `ADMIN` or `SUPER_ADMIN`, and owns a record in `public.admins`. Redirects students to `/student/dashboard` and logs unauthorized attempts.
- `requireAdminWithVoidPermission(locale)`: Asserts administrative rights plus explicit void authorization (`admins.can_void_payments = true` or `role = SUPER_ADMIN`).

### 4. Audit & Logging Integration (`src/lib/audit/logger.ts`)
Security and authentication events produce structured server-side console logs and are recorded in `public.audit_logs`:
- `AUTH_LOGIN_SUCCESS`: Records user ID, email, role, IP address, and User-Agent.
- `AUTH_LOGIN_FAILED`: Records attempted identifier, failure reason, IP address, and User-Agent.
- `AUTH_LOGOUT`: Records user ID, timestamp, and metadata.
- `UNAUTHORIZED_ACCESS_ATTEMPT`: Triggered when an authenticated user attempts to access an unauthorized boundary (e.g., student accessing `/admin/*`).

---

## 🗄️ Database Architecture (Phase 2)

The database schema is fully normalized and organized into migration files under `supabase/migrations/`:

| Migration File | Description |
|---|---|
| [`20261006000001_initial_schema.sql`](supabase/migrations/20261006000001_initial_schema.sql) | DDL for all 8 tables (`profiles`, `students`, `admins`, `semesters`, `student_dues`, `transactions`, `receipts`, `audit_logs`), custom ENUMs, sequential monotonic number generators (`txn_number_seq`, `rcp_number_seq`), performance indexes, and immutability delete-blocking triggers. |
| [`20261006000002_rls_policies.sql`](supabase/migrations/20261006000002_rls_policies.sql) | Row Level Security (RLS) on all tables. Enforces strict student isolation and blocks all direct browser/client `INSERT` or `UPDATE` operations on financial records (`WITH CHECK (false)`). |
| [`20261006000003_payment_functions.sql`](supabase/migrations/20261006000003_payment_functions.sql) | Stored procedures: `record_manual_payment_atomic` (atomic balance update, receipt issuance, idempotency check, concurrency lock), `void_transaction_atomic` (controlled reversal with audit reason), and `verify_receipt_public` (privacy-preserving QR lookup exposing zero student PII). |
| [`20261006000004_void_transaction_role_check.sql`](supabase/migrations/20261006000004_void_transaction_role_check.sql) | Hardens `void_transaction_atomic` database authorization by explicitly verifying caller has role `ADMIN` or `SUPER_ADMIN`. |
| [`seed.sql`](supabase/seed.sql) | Reproducible synthetic demo dataset with 2 admins (Cashier & Supervisor) and 5 student testing archetypes (unpaid, partially paid, fully paid, scholarship-discounted, multi-semester history). |

---

## ⚙️ Supabase Configuration & Setup

### 1. Required Environment Variables
Copy `.env.example` to `.env.local` and populate your project credentials:
```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://<project-id>.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/public key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service_role key (**SERVER-ONLY**, never exposed to the client).
- `RECEIPT_HMAC_SECRET`: 64-character random secret used for computing receipt verification hashes.
- `NEXT_PUBLIC_APP_URL`: Application origin URL (`http://localhost:3000` or production domain).
- `NEXT_PUBLIC_DEFAULT_LOCALE`: Default language code (`ar`).

### 2. How to Apply Migrations

#### Option A: Using Supabase CLI (Linked Project)
```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link your remote Supabase project
npx supabase link --project-ref your-project-id

# 3. Push migrations to remote database
npx supabase db push
```

#### Option B: Using Supabase Dashboard (SQL Editor)
If managing via the Supabase Web Console:
1. Open your project on [supabase.com](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Run the migrations in order:
   - Run `supabase/migrations/20261006000001_initial_schema.sql`
   - Run `supabase/migrations/20261006000002_rls_policies.sql`
   - Run `supabase/migrations/20261006000003_payment_functions.sql`
   - Run `supabase/migrations/20261006000004_void_transaction_role_check.sql`

### 3. How to Seed Demo Data
To populate the database with the pre-production pilot test accounts:
- In Supabase CLI:
  ```bash
  npx supabase db reset --linked
  # or execute seed directly:
  npx supabase db execute --file supabase/seed.sql
  ```
- Or copy the contents of `supabase/seed.sql` and run it in the Supabase Dashboard **SQL Editor**.

---

## 🧪 Demo User Accounts (Pre-configured)

Password for all synthetic demo accounts: `demo123456`

The login form supports logging in using either **University Email** or **Student/Employee ID**, and includes quick-fill buttons for rapid review:

| Role | Email | Identifier | Archetype |
|---|---|---|---|
| **Treasury Cashier** | `admin.cashier@eng.cu.edu.eg` | `DEMO-ADM-001` | Front-desk cashier desk 1 |
| **Finance Director** | `admin.super@eng.cu.edu.eg` | `DEMO-ADM-002` | Supervisor with void privileges |
| **Student (Partial)** | `demo.student1@eng.cu.edu.eg` | `DEMO-100001` | Due: 15k, Paid: 10k, Balance: 5k EGP |
| **Student (Paid in Full)** | `demo.student2@eng.cu.edu.eg` | `DEMO-100002` | Due: 12k, Paid: 12k, Balance: 0 EGP |
| **Student (Unpaid)** | `demo.student3@eng.cu.edu.eg` | `DEMO-100003` | Due: 15k, Paid: 0, Balance: 15k EGP |
| **Student (Scholarship)**| `demo.student4@eng.cu.edu.eg` | `DEMO-100004` | Due: 18k, Discount: 3k, Paid: 15k EGP |
| **Student (History)** | `demo.student5@eng.cu.edu.eg` | `DEMO-100005` | Multiple semester transaction history |

---

## 🖥️ Student & Admin Functional UI Implementation (Phase 4)

In **Phase 4**, all placeholder Student and Admin routes have been transformed into fully responsive, production-quality UI interfaces backed by a server-side Data Access Layer (DAL).

### 1. Student Portal (`/[locale]/student/*`)
- **Dashboard (`/student/dashboard`):** Real-time identity bar with academic department, program, student number, and DEMO DATA badge; financial summary KPI cards (Total Due, Total Paid, Outstanding Balance); recent transactions ledger; and quick navigation actions.
- **Tuition & Semester Fees (`/student/fees`):** Assessed semester dues table detailing original fees, scholarships/discounts, net due, paid amount, remaining balance, due dates, and payment status badges. Includes an explicit pre-production pilot notice clarifying that online payment is disabled.
- **Payment History (`/student/transactions`):** Complete historical ledger of treasury payments displaying transaction numbers, receipt numbers, semester attribution, payment dates/times, payment methods (Cash, POS, Bank Transfer, Other), amounts, and lifecycle statuses (Completed, Voided).
- **Transaction Details (`/student/transactions/[id]`):** Isolated receipt/voucher view strictly validating student ownership on the server side before retrieval. Shows transaction metadata, treasury cashier/station identifier, notes, reference numbers, and void reason banners when applicable.
- **Student Profile (`/student/profile`):** Verified academic identity card displaying full Arabic/English names, university email, academic number, department, program, study level, and masked National ID (`••••••••••1234`) with an immutability alert.

### 2. Admin Portal (`/[locale]/admin/*`)
- **Financial Dashboard (`/admin/dashboard`):** High-level treasury performance metrics (Total Pilot Collections, Outstanding Dues, Active Student Accounts, Recent Transactions), daily collection breakdown, and quick access to administrative modules.
- **Student Directory (`/admin/students`):** Searchable student registry by academic number, national ID, or name, presenting net dues, payments, outstanding balances, and direct links to individual student ledgers.
- **Student Ledger Profile (`/admin/students/[id]`):** Comprehensive administrative view of a student's full financial history, multi-semester dues breakdown, completed/voided transaction timeline, and quick-action trigger for recording manual payments.
- **Payment Management (`/admin/payments`):** Treasury transaction journal with real-time text and status filtering, method badges, reference numbers, and an interactive **Record Manual Payment** modal shell (`ManualPaymentModalShell.tsx`).
- **Audit Logs (`/admin/audit-logs`):** Administrative activity tracking log detailing action categories (`MANUAL_PAYMENT_RECORDED`, `TRANSACTION_VOIDED`, `AUTH_LOGIN_SUCCESS`, `UNAUTHORIZED_ACCESS_ATTEMPT`), actor identifiers, client IP addresses, timestamps, and JSON state diffs.

### 3. Server-Side Data Access Layer (DAL)
The application separates data fetching concerns through server-only modules:
- `src/lib/data/student.ts`: Queries student dues, transactions, and profile data from Supabase PostgreSQL using server clients, gracefully falling back to structured seed mock data when running in unconfigured or local demo mode.
- `src/lib/data/admin.ts`: Queries system-wide metrics, student directory searches, individual student financial profiles, payment journals, and audit logs.
- `src/lib/data/mock-data.ts`: Type-safe mock dataset reflecting `supabase/seed.sql` for all 5 student personas and 2 admin archetypes, enabling full visual and interaction testing without external dependencies.

### 4. Strict Security & Architectural Boundaries
- **Zero Financial Writes in Phase 4:** The manual payment modal in Phase 4 is an interactive preview shell detailing pre-production boundaries. Execution of `record_manual_payment_atomic` is intentionally deferred to Phase 5.
- **No Online Payment Gateways:** Online payments remain disabled per the pilot specifications.
- **No PDF/QR Receipt Generation:** Dynamically generated PDF receipts and public QR code verification will be implemented in Phase 6.
- **No Client Identity Trust:** All student data queries derive user identity strictly from the server-side session (`await requireStudent(locale)`), completely ignoring any client-provided user IDs.

---

## 💳 Secure Manual Payment Workflow (Phase 5)

In **Phase 5**, the secure manual payment recording workflow is fully implemented and connected to the atomic PostgreSQL `record_manual_payment_atomic` function. This represents the first phase that enables financial mutation in the system.

### 1. Architectural Mutation Flow
```
Authorized Admin UI Form (ManualPaymentModalShell)
        ↓  (Submits via Server Action with Client Debounce & Idempotency Key)
Authorized Server Action (src/lib/actions/payment.actions.ts)
        ↓  (Validates Server Admin Session via requireAdmin, Validates Schema with Zod)
Server-side Pre-computation of Verification Hash (HMAC SHA-256 via RECEIPT_HMAC_SECRET)
        ↓
PostgreSQL Atomic Transaction: record_manual_payment_atomic(...)
        ↓  (Row-lock FOR UPDATE on student_dues, checks overpayment & idempotency)
Monotonic Sequence Generation (CUFE-TXN-... & CUFE-RCP-...)
        ↓
Atomic Updates (Transactions INSERT + Student Dues UPDATE + Receipts INSERT + Audit Log INSERT)
```

### 2. Authorized Roles & Server Guards
- Only authenticated users with role `ADMIN` or `SUPER_ADMIN` and `is_active = true` can invoke manual payments.
- Student accounts attempting to call payment actions are immediately rejected.
- Admin ID is strictly derived from the server-side session (`requireAdmin`); client-supplied admin IDs are never accepted.

### 3. Idempotency & Replay Protection
- Every payment submission is accompanied by a unique cryptographic idempotency key generated on the client.
- Double-clicks, browser retries, and network replays are handled gracefully: if a transaction with the same idempotency key already exists, the server returns the existing transaction and receipt without re-executing or creating duplicate financial entries (`isDuplicate: true`).

### 4. Overpayment Protection
- Both the client UI and the database function enforce strict overpayment guards:
  $$\text{Payment Amount} \le \text{Remaining Balance} = (\text{Original Amount} - \text{Discount Amount}) - \text{Paid Amount}$$
- Overpayment attempts are immediately blocked in the UI with bilingual alerts and rejected by PostgreSQL with an `OVERPAYMENT` exception.

### 5. HMAC Receipt Verification Security
- The 64-character hex receipt verification hash is pre-computed server-side in the Node.js runtime using `RECEIPT_HMAC_SECRET`.
- The secret key **never touches PostgreSQL** and **never reaches the browser bundle**.

### 6. Automated Security & Integrity Tests
Run the standalone automated security test suite:
```bash
npm run test:security
```
This tests all 14 mandatory security criteria:
1. Student cannot invoke manual payment.
2. Unauthenticated user cannot invoke manual payment.
3. Admin can record a valid payment.
4. Admin cannot record payment for a nonexistent student.
5. Admin cannot record payment for an invalid due.
6. Overpayment is rejected.
7. Duplicate idempotency submission does not create duplicate transaction.
8. Financial transaction is created atomically.
9. `student_dues` paid amount/status updates correctly.
10. Receipt row is created with server-computed HMAC.
11. Audit log is created with previous and new balance states.
12. No service-role secret reaches client bundle or components.
13. No HMAC secret reaches client bundle or components.
14. No financial write occurs directly from browser code.

### 7. What Remains Intentionally Disabled
- ⚠️ **Online Payment Gateways:** Online payments remain completely disabled for this pre-production pilot.
- ⚠️ **PDF Receipt Generation:** On-demand PDF generation is deferred to Phase 6.
- ⚠️ **QR Verification:** Public QR scanning and verification lookup is deferred to Phase 6.
- ⚠️ **Void Workflow:** Controlled transaction voiding (`void_transaction_atomic`) is deferred to Phase 7.

---

## 🚀 Running the Project

```bash
# Run Development Server
npm run dev

# Run Automated Security Tests
npm run test:security

# Run TypeScript Validation
npx tsc --noEmit

# Run Code Linter
npm run lint

# Run Production Build
npm run build
```
