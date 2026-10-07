/**
 * Comprehensive Read-Only Verification of Seed Data in Supabase
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
let url = '', key = '';
env.split('\n').forEach((line) => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
});

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function runSeedVerification() {
  console.log('===============================================================');
  console.log('SUPABASE DATABASE SEED VERIFICATION');
  console.log('Project URL:', url);
  console.log('===============================================================\n');

  // 1. Table Counts
  const tables = [
    'profiles',
    'admins',
    'students',
    'semesters',
    'student_dues',
    'transactions',
    'receipts',
    'audit_logs',
  ];

  const counts: Record<string, number> = {};
  for (const t of tables) {
    const res = await client.from(t).select('*', { count: 'exact', head: true });
    counts[t] = res.count ?? 0;
    console.log(`- ${t}: count = ${counts[t]} (status: ${res.status})`);
  }

  // 2. Specific Entity Details
  const adminsRes = await client.from('admins').select('id, employee_id, office_department, can_void_payments');
  const studentsRes = await client.from('students').select('id, student_number, academic_program, academic_level');
  const profilesRes = await client.from('profiles').select('id, role, is_demo, is_active');
  const txnsRes = await client.from('transactions').select('id, transaction_number, status, amount, student_id, student_due_id');
  const rcpRes = await client.from('receipts').select('id, receipt_number, transaction_id, total_amount');
  const auditRes = await client.from('audit_logs').select('id, action, entity_name, entity_id, actor_role');

  console.log('\n--- VERIFICATION CHECKS ---');
  
  // Admins check
  const adminCount = adminsRes.data?.length ?? 0;
  console.log(`- Demo Admins: ${adminCount} (Expected: 2) -> ${adminCount === 2 ? 'PASS' : 'FAIL'}`);

  // Students check
  const studentCount = studentsRes.data?.length ?? 0;
  console.log(`- Demo Students: ${studentCount} (Expected: 5) -> ${studentCount === 5 ? 'PASS' : 'FAIL'}`);

  // Transactions check
  const txnCount = txnsRes.data?.length ?? 0;
  console.log(`- Demo Transactions: ${txnCount} (Expected: 7) -> ${txnCount === 7 ? 'PASS' : 'FAIL'}`);

  // Receipts check
  const rcpCount = rcpRes.data?.length ?? 0;
  console.log(`- Demo Receipts: ${rcpCount} (Expected: 6) -> ${rcpCount === 6 ? 'PASS' : 'FAIL'}`);

  // Audit Logs check
  const auditCount = auditRes.data?.length ?? 0;
  console.log(`- Demo Audit Logs: ${auditCount} (Expected: 5) -> ${auditCount === 5 ? 'PASS' : 'FAIL'}`);

  // Audit actions breakdown
  const paymentRecordedLogs = auditRes.data?.filter((a) => a.action === 'PAYMENT_RECORDED').length ?? 0;
  const paymentVoidedLogs = auditRes.data?.filter((a) => a.action === 'PAYMENT_VOIDED').length ?? 0;
  console.log(`- PAYMENT_RECORDED audit logs: ${paymentRecordedLogs} (Expected: 4) -> ${paymentRecordedLogs === 4 ? 'PASS' : 'FAIL'}`);
  console.log(`- PAYMENT_VOIDED audit logs: ${paymentVoidedLogs} (Expected: 1) -> ${paymentVoidedLogs === 1 ? 'PASS' : 'FAIL'}`);

  // is_demo check
  const allProfilesDemo = profilesRes.data?.every((p) => p.is_demo === true) ?? false;
  console.log(`- All profiles have is_demo = true: ${allProfilesDemo ? 'PASS' : 'FAIL'}`);

  // Voided transaction check
  const voidedTxn = txnsRes.data?.find((t) => t.status === 'VOIDED');
  console.log(`- Voided transaction verified: ${voidedTxn ? `YES (ID: ${voidedTxn.id}, Txn: ${voidedTxn.transaction_number})` : 'NO'} -> ${voidedTxn ? 'PASS' : 'FAIL'}`);

  // Foreign key relationship check between receipts and transactions
  const txnIds = new Set(txnsRes.data?.map((t) => t.id));
  const receiptsFkValid = rcpRes.data?.every((r) => txnIds.has(r.transaction_id)) ?? false;
  console.log(`- All receipts link to valid transactions: ${receiptsFkValid ? 'PASS' : 'FAIL'}`);

  // Check for duplicate student numbers
  const studentNumbers = studentsRes.data?.map((s) => s.student_number) ?? [];
  const uniqueStudentNumbers = new Set(studentNumbers);
  console.log(`- Zero duplicate student numbers: ${uniqueStudentNumbers.size === studentNumbers.length ? 'PASS' : 'FAIL'}`);

  console.log('\n===============================================================');
  return {
    counts,
    adminCount,
    studentCount,
    txnCount,
    rcpCount,
    auditCount,
    paymentRecordedLogs,
    paymentVoidedLogs,
    allProfilesDemo,
    voidedTxn: !!voidedTxn,
    receiptsFkValid,
  };
}

if (process.argv[1] && process.argv[1].includes('verify-seed')) {
  runSeedVerification().catch(console.error);
}
