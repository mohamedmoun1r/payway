import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((l) => {
  const [k, ...v] = l.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: txns } = await client.from('transactions').select('id, transaction_number, student_id, amount, status, payment_date, void_reason');
  console.log('TRANSACTIONS COUNT:', txns?.length);
  console.log('TRANSACTIONS:', JSON.stringify(txns, null, 2));

  const { data: dues } = await client.from('student_dues').select('id, student_id, original_amount, discount_amount, paid_amount, status');
  console.log('DUES COUNT:', dues?.length);
  console.log('DUES:', JSON.stringify(dues, null, 2));
}

main().catch(console.error);
