/**
 * Phase 5 - Read-Only Supabase Connection and Configuration Test
 * Cairo University Faculty of Engineering (CUFE) - Student Financial Portal
 *
 * Verifies:
 * 1. Supabase URL configuration
 * 2. Public client initialization
 * 3. Server privileged client initialization
 * 4. HMAC secret availability
 * 5. Client secret isolation
 * 6. Safe read-only connectivity against Supabase API
 *
 * ZERO mutations performed. ZERO secrets exposed.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local variables safely
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

async function runConnectionTest() {
  console.log('=================================================================');
  console.log('RUNNING READ-ONLY SUPABASE CONNECTIVITY & CONFIGURATION TEST');
  console.log('=================================================================\n');

  const results: Record<string, 'PASS' | 'FAIL'> = {
    supabaseUrl: 'FAIL',
    publicClientInit: 'FAIL',
    serverPrivilegedClientInit: 'FAIL',
    hmacSecretAvailability: 'FAIL',
    clientSecretIsolation: 'FAIL',
    readOnlyConnectivity: 'FAIL',
  };

  const details: Record<string, string> = {};

  // 1. Supabase URL configuration
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && url.startsWith('https://') && url.includes('.supabase.co')) {
    results.supabaseUrl = 'PASS';
    details.supabaseUrl = 'Valid HTTPS Supabase project host detected';
  } else {
    details.supabaseUrl = 'Missing or invalid Supabase URL format';
  }

  // 2. Public client initialization
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let publicClient: any = null;
  if (url && anonKey) {
    try {
      publicClient = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (publicClient && publicClient.auth) {
        results.publicClientInit = 'PASS';
        details.publicClientInit = 'Public client initialized with anon credentials';
      }
    } catch (err: any) {
      details.publicClientInit = `Init error: ${err.message}`;
    }
  } else {
    details.publicClientInit = 'Missing URL or anon key';
  }

  // 3. Server privileged client initialization
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let adminClient: any = null;
  if (url && serviceRoleKey) {
    try {
      adminClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (adminClient && adminClient.auth) {
        results.serverPrivilegedClientInit = 'PASS';
        details.serverPrivilegedClientInit = 'Privileged client initialized with service-role credential';
      }
    } catch (err: any) {
      details.serverPrivilegedClientInit = `Init error: ${err.message}`;
    }
  } else {
    details.serverPrivilegedClientInit = 'Missing service-role key';
  }

  // 4. HMAC secret availability
  const hmacSecret = process.env.RECEIPT_HMAC_SECRET;
  if (hmacSecret && hmacSecret.length === 64 && /^[a-fA-F0-9]{64}$/.test(hmacSecret)) {
    results.hmacSecretAvailability = 'PASS';
    details.hmacSecretAvailability = 'Valid 64-character hex cryptographic secret available';
  } else {
    details.hmacSecretAvailability = 'Missing or invalid HMAC secret length/format';
  }

  // 5. Client secret isolation check
  function scanDir(dir: string, forbidden: string[]): string[] {
    const found: string[] = [];
    if (!fs.existsSync(dir)) return found;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        found.push(...scanDir(full, forbidden));
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        const text = fs.readFileSync(full, 'utf8');
        for (const token of forbidden) {
          if (text.includes(token)) {
            found.push(`${full}: ${token}`);
          }
        }
      }
    }
    return found;
  }

  const clientLeaks = scanDir(path.join(process.cwd(), 'src', 'components'), [
    'SUPABASE_SERVICE_ROLE_KEY',
    'RECEIPT_HMAC_SECRET',
  ]);

  if (clientLeaks.length === 0) {
    results.clientSecretIsolation = 'PASS';
    details.clientSecretIsolation = 'Zero secret occurrences found in src/components';
  } else {
    details.clientSecretIsolation = `Found leaks: ${clientLeaks.join(', ')}`;
  }

  // 6. Safe Read-Only Connectivity Check against Supabase API
  if (url && (publicClient || adminClient)) {
    try {
      // Perform safe HTTPS ping to Supabase REST gateway or auth endpoint
      const clientToUse = adminClient || publicClient;
      
      // Safe read query with head: true (zero rows retrieved, no data mutation)
      const res = await clientToUse.from('profiles').select('*', { count: 'exact', head: true });
      
      // Even if tables do not exist yet (PGRST204 or 404 relation does not exist),
      // receiving an HTTP response from the Supabase PostgREST server proves connectivity!
      if (res.status === 200 || res.status === 404 || res.status === 400 || (res.error && res.error.code)) {
        results.readOnlyConnectivity = 'PASS';
        const statusMsg = res.status ? `HTTP status ${res.status}` : 'API responded';
        const info = res.error ? `(${res.error.message || res.error.code})` : '(API active)';
        details.readOnlyConnectivity = `Successfully connected to Supabase backend API [${statusMsg} ${info}]`;
      } else {
        // Fallback test via native fetch to Supabase Auth settings endpoint
        const authPing = await fetch(`${url}/auth/v1/settings`, {
          headers: { apikey: anonKey || '' },
        });
        if (authPing.ok || authPing.status === 200) {
          results.readOnlyConnectivity = 'PASS';
          details.readOnlyConnectivity = `Successfully connected to Supabase Auth API [HTTP ${authPing.status}]`;
        } else {
          details.readOnlyConnectivity = `API response status: ${authPing.status}`;
        }
      }
    } catch (netErr: any) {
      details.readOnlyConnectivity = `Network error connecting to Supabase: ${netErr.message}`;
    }
  }

  console.log('TEST RESULTS:');
  console.log(`- Supabase URL configuration: ${results.supabaseUrl}`);
  console.log(`  Details: ${details.supabaseUrl}`);
  console.log(`- Public client initialization: ${results.publicClientInit}`);
  console.log(`  Details: ${details.publicClientInit}`);
  console.log(`- Server privileged client initialization: ${results.serverPrivilegedClientInit}`);
  console.log(`  Details: ${details.serverPrivilegedClientInit}`);
  console.log(`- HMAC secret availability: ${results.hmacSecretAvailability}`);
  console.log(`  Details: ${details.hmacSecretAvailability}`);
  console.log(`- Client secret isolation: ${results.clientSecretIsolation}`);
  console.log(`  Details: ${details.clientSecretIsolation}`);
  console.log(`- Read-only connectivity: ${results.readOnlyConnectivity}`);
  console.log(`  Details: ${details.readOnlyConnectivity}`);

  console.log('\n=================================================================');
}

runConnectionTest().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
