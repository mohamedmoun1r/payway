import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
});

const client = createClient(url, key);

async function probe() {
  console.log('Project URL:', url);
  const tables = ['profiles', 'students', 'admins', 'semesters', 'student_dues', 'transactions', 'receipts', 'audit_logs'];
  for (const t of tables) {
    const res = await client.from(t).select('*', { count: 'exact', head: true });
    console.log(`- ${t}: status ${res.status}, count: ${res.count}, error: ${res.error?.message || 'none'}`);
  }

  const rpc = await client.rpc('verify_receipt_public', { p_verification_hash: '0000000000000000000000000000000000000000000000000000000000000000' });
  console.log(`- RPC verify_receipt_public: status ${rpc.status}, error: ${rpc.error?.message || 'none'}`);
}

probe();
