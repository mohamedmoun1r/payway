import fs from 'node:fs';
import path from 'node:path';
import { createServerClient } from '@supabase/ssr';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((l) => {
  const [k, ...v] = l.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

async function main() {
  const cookieJar = new Map<string, string>();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => cookieJar.set(name, value));
      },
    },
  });

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'demo.student1@eng.cu.edu.eg',
    password: 'demo123456',
  });

  if (authErr || !authData.user) {
    console.error('Failed to authenticate student:', authErr);
    process.exit(1);
  }

  console.log('Authenticated as Student:', authData.user.email, authData.user.id);
  console.log('Cookies in jar:', Array.from(cookieJar.keys()));

  const cookieHeader = Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

  // 1. Student -> /[locale]/admin/reports
  console.log('\n--- 1. Student -> /ar/admin/reports ---');
  const res1 = await fetch('http://localhost:3001/ar/admin/reports', {
    headers: {
      Cookie: cookieHeader,
    },
    redirect: 'manual',
  });
  console.log('Status:', res1.status, res1.statusText);
  console.log('Location:', res1.headers.get('location'));
  console.log('Headers:', Object.fromEntries(res1.headers.entries()));

  // 2. Student -> /api/admin/export/payments
  console.log('\n--- 2. Student -> /api/admin/export/payments ---');
  const res2 = await fetch('http://localhost:3001/api/admin/export/payments', {
    headers: {
      Cookie: cookieHeader,
    },
    redirect: 'manual',
  });
  console.log('Status:', res2.status, res2.statusText);
  const text2 = await res2.text();
  console.log('Body:', text2);

  // 3. Student -> /api/admin/export/reconciliation
  console.log('\n--- 3. Student -> /api/admin/export/reconciliation ---');
  const res3 = await fetch('http://localhost:3001/api/admin/export/reconciliation', {
    headers: {
      Cookie: cookieHeader,
    },
    redirect: 'manual',
  });
  console.log('Status:', res3.status, res3.statusText);
  const text3 = await res3.text();
  console.log('Body:', text3);

  // 4. Unauthenticated -> both export endpoints
  console.log('\n--- 4a. Unauthenticated -> /api/admin/export/payments ---');
  const res4a = await fetch('http://localhost:3001/api/admin/export/payments', {
    redirect: 'manual',
  });
  console.log('Status:', res4a.status, res4a.statusText);
  console.log('Body:', await res4a.text());

  console.log('\n--- 4b. Unauthenticated -> /api/admin/export/reconciliation ---');
  const res4b = await fetch('http://localhost:3001/api/admin/export/reconciliation', {
    redirect: 'manual',
  });
  console.log('Status:', res4b.status, res4b.statusText);
  console.log('Body:', await res4b.text());
}

main().catch(console.error);
