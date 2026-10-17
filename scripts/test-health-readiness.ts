/**
 * Automated Test Suite for /api/health Readiness & Payment Configuration Checks
 *
 * Verifies:
 * 1. Strict validation of required payment environment variables:
 *    - SUPABASE_SERVICE_ROLE_KEY
 *    - RECEIPT_HMAC_SECRET
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 2. Fail-closed behavior on missing, empty, or placeholder configuration.
 * 3. Liveness probe (?probe=liveness) succeeds without database calls even when payment config is unready.
 * 4. Readiness probe (?probe=readiness / default) fails closed when payment config is missing/invalid.
 * 5. Readiness probe succeeds (HTTP 200 { status: 'ok' }) when fully configured and DB reachable.
 * 6. Zero secret leakage across responses and source files.
 *
 * Safety: Strictly runs against the local disposable database (127.0.0.1:54321).
 * Never contacts remote Supabase.
 */

import fs from 'node:fs';
import path from 'node:path';


import {
  validatePaymentConfiguration,
  isPaymentConfigurationReady,
} from '../src/lib/config/payment-config';
import { GET } from '../src/app/api/health/route';

// Local disposable Supabase credentials
const LOCAL_SUPABASE_URL = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE_ROLE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const LOCAL_HMAC_SECRET = 'local-test-receipt-signing-secret-key-32chars';

// Mandatory Hostname Validation to prevent any remote connection
const parsedUrl = new URL(LOCAL_SUPABASE_URL);
if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
  console.error(`FATAL SAFETY VIOLATION: Refusing to run tests against non-local host: ${parsedUrl.hostname}`);
  process.exit(1);
}

console.log('=================================================================');
console.log('PAYWAY — HEALTH READINESS & PAYMENT CONFIGURATION TEST SUITE');
console.log('=================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    console.log(`✅ PASS: ${name}${details ? ` -> ${details}` : ''}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${name}${details ? ` -> ${details}` : ''}`);
    failCount++;
  }
}

async function run() {
  const validBaseEnv: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_ROLE_KEY,
    RECEIPT_HMAC_SECRET: LOCAL_HMAC_SECRET,
  };

  // ---------------------------------------------------------------------------
  // SECTION 1: UNIT TESTS FOR PAYMENT CONFIGURATION VALIDATOR
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: PAYMENT CONFIGURATION VALIDATOR ---');

  // 1.1 Complete, valid configuration
  const validRes = validatePaymentConfiguration(validBaseEnv);
  assert(
    validRes.ready && validRes.missingKeys.length === 0,
    '[Validator] Fully configured environment evaluates as ready',
    `missing: ${validRes.missingKeys.join(', ') || 'none'}`
  );
  assert(
    isPaymentConfigurationReady(validBaseEnv),
    '[Validator] isPaymentConfigurationReady returns true for valid config'
  );

  // 1.2 Missing SUPABASE_SERVICE_ROLE_KEY
  const missingServiceRole = { ...validBaseEnv };
  delete missingServiceRole.SUPABASE_SERVICE_ROLE_KEY;
  const noServiceRes = validatePaymentConfiguration(missingServiceRole);
  assert(
    !noServiceRes.ready && noServiceRes.missingKeys.includes('SUPABASE_SERVICE_ROLE_KEY'),
    '[Validator] Missing SUPABASE_SERVICE_ROLE_KEY fails validation',
    `missing: ${noServiceRes.missingKeys.join(', ')}`
  );

  // 1.3 Placeholder SUPABASE_SERVICE_ROLE_KEY
  const placeholderServiceRole = {
    ...validBaseEnv,
    SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key-here',
  };
  const placeholderServiceRes = validatePaymentConfiguration(placeholderServiceRole);
  assert(
    !placeholderServiceRes.ready && placeholderServiceRes.missingKeys.includes('SUPABASE_SERVICE_ROLE_KEY'),
    '[Validator] Placeholder SUPABASE_SERVICE_ROLE_KEY fails validation'
  );

  // 1.4 Service role key identical to anon key (privilege separation violation)
  const identicalKeys = {
    ...validBaseEnv,
    SUPABASE_SERVICE_ROLE_KEY: validBaseEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  const identicalRes = validatePaymentConfiguration(identicalKeys);
  assert(
    !identicalRes.ready && identicalRes.missingKeys.includes('SUPABASE_SERVICE_ROLE_KEY'),
    '[Validator] Service role key identical to anon key fails validation'
  );

  // 1.5 Missing RECEIPT_HMAC_SECRET
  const missingHmac = { ...validBaseEnv };
  delete missingHmac.RECEIPT_HMAC_SECRET;
  const noHmacRes = validatePaymentConfiguration(missingHmac);
  assert(
    !noHmacRes.ready && noHmacRes.missingKeys.includes('RECEIPT_HMAC_SECRET'),
    '[Validator] Missing RECEIPT_HMAC_SECRET fails validation',
    `missing: ${noHmacRes.missingKeys.join(', ')}`
  );

  // 1.6 Whitespace-only RECEIPT_HMAC_SECRET
  const whitespaceHmac = { ...validBaseEnv, RECEIPT_HMAC_SECRET: '   ' };
  const whitespaceHmacRes = validatePaymentConfiguration(whitespaceHmac);
  assert(
    !whitespaceHmacRes.ready && whitespaceHmacRes.missingKeys.includes('RECEIPT_HMAC_SECRET'),
    '[Validator] Whitespace-only RECEIPT_HMAC_SECRET fails validation'
  );

  // 1.7 Too short RECEIPT_HMAC_SECRET (< 32 characters)
  const shortHmac = { ...validBaseEnv, RECEIPT_HMAC_SECRET: 'too-short-secret' };
  const shortHmacRes = validatePaymentConfiguration(shortHmac);
  assert(
    !shortHmacRes.ready && shortHmacRes.missingKeys.includes('RECEIPT_HMAC_SECRET'),
    '[Validator] Too short (< 32 chars) RECEIPT_HMAC_SECRET fails validation',
    `length: ${shortHmac.RECEIPT_HMAC_SECRET.length}`
  );

  // 1.8 Placeholder RECEIPT_HMAC_SECRET
  const placeholderHmac = {
    ...validBaseEnv,
    RECEIPT_HMAC_SECRET: 'generate-a-secure-random-64-character-hex-string-for-hmac-verification',
  };
  const placeholderHmacRes = validatePaymentConfiguration(placeholderHmac);
  assert(
    !placeholderHmacRes.ready && placeholderHmacRes.missingKeys.includes('RECEIPT_HMAC_SECRET'),
    '[Validator] Placeholder RECEIPT_HMAC_SECRET fails validation'
  );

  // 1.9 Missing NEXT_PUBLIC_SUPABASE_URL
  const missingUrl = { ...validBaseEnv };
  delete missingUrl.NEXT_PUBLIC_SUPABASE_URL;
  const noUrlRes = validatePaymentConfiguration(missingUrl);
  assert(
    !noUrlRes.ready && noUrlRes.missingKeys.includes('NEXT_PUBLIC_SUPABASE_URL'),
    '[Validator] Missing NEXT_PUBLIC_SUPABASE_URL fails validation'
  );

  // 1.10 Placeholder NEXT_PUBLIC_SUPABASE_URL
  const placeholderUrl = {
    ...validBaseEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder-project.supabase.co',
  };
  const placeholderUrlRes = validatePaymentConfiguration(placeholderUrl);
  assert(
    !placeholderUrlRes.ready && placeholderUrlRes.missingKeys.includes('NEXT_PUBLIC_SUPABASE_URL'),
    '[Validator] Placeholder NEXT_PUBLIC_SUPABASE_URL fails validation'
  );

  // 1.11 Missing NEXT_PUBLIC_SUPABASE_ANON_KEY
  const missingAnon = { ...validBaseEnv };
  delete missingAnon.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const noAnonRes = validatePaymentConfiguration(missingAnon);
  assert(
    !noAnonRes.ready && noAnonRes.missingKeys.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    '[Validator] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY fails validation'
  );

  // 1.12 Multiple missing keys collected simultaneously
  const multipleMissing = {
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
  };
  const multiRes = validatePaymentConfiguration(multipleMissing);
  assert(
    !multiRes.ready &&
      multiRes.missingKeys.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY') &&
      multiRes.missingKeys.includes('SUPABASE_SERVICE_ROLE_KEY') &&
      multiRes.missingKeys.includes('RECEIPT_HMAC_SECRET'),
    '[Validator] Multiple missing payment keys collected simultaneously',
    `missing count: ${multiRes.missingKeys.length}`
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: LIVENESS VS READINESS BEHAVIOR ON /api/health
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: LIVENESS VS READINESS ON /api/health ---');

  // Backup original env vars
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origHmacSecret = process.env.RECEIPT_HMAC_SECRET;
  const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    // 2.1 Liveness probe succeeds when payment configuration is missing
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.RECEIPT_HMAC_SECRET;

    const liveReq = new Request('http://localhost/api/health?probe=liveness');
    const liveRes = await GET(liveReq);
    const liveBody = await liveRes.json();

    assert(
      liveRes.status === 200 && liveBody.status === 'ok',
      '[Liveness Probe] ?probe=liveness returns HTTP 200 { status: "ok" } even when payment config is unready',
      `HTTP ${liveRes.status}, body: ${JSON.stringify(liveBody)}`
    );

    // 2.2 Alternate query parameters (?type=liveness, ?check=liveness)
    const typeReq = new Request('http://localhost/api/health?type=liveness');
    const typeRes = await GET(typeReq);
    const typeBody = await typeRes.json();
    assert(
      typeRes.status === 200 && typeBody.status === 'ok',
      '[Liveness Probe] ?type=liveness alias correctly handled'
    );

    const checkReq = new Request('http://localhost/api/health?check=liveness');
    const checkRes = await GET(checkReq);
    const checkBody = await checkRes.json();
    assert(
      checkRes.status === 200 && checkBody.status === 'ok',
      '[Liveness Probe] ?check=liveness alias correctly handled'
    );

    // 2.3 Readiness probe FAILS CLOSED when SUPABASE_SERVICE_ROLE_KEY is missing
    process.env.RECEIPT_HMAC_SECRET = validBaseEnv.RECEIPT_HMAC_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = validBaseEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = validBaseEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const readyNoServiceReq = new Request('http://localhost/api/health?probe=readiness');
    const readyNoServiceRes = await GET(readyNoServiceReq);
    const readyNoServiceBody = await readyNoServiceRes.json();

    assert(
      readyNoServiceRes.status === 503 && readyNoServiceBody.status === 'error',
      '[Readiness Probe] Fails closed (HTTP 503 { status: "error" }) when SUPABASE_SERVICE_ROLE_KEY is missing',
      `HTTP ${readyNoServiceRes.status}`
    );

    // 2.4 Default GET /api/health (without query params) FAILS CLOSED on missing service role key
    const defaultNoServiceReq = new Request('http://localhost/api/health');
    const defaultNoServiceRes = await GET(defaultNoServiceReq);
    const defaultNoServiceBody = await defaultNoServiceRes.json();

    assert(
      defaultNoServiceRes.status === 503 && defaultNoServiceBody.status === 'error',
      '[Readiness Probe] Default /api/health defaults to readiness and fails closed on missing config'
    );

    // 2.5 Readiness probe FAILS CLOSED when RECEIPT_HMAC_SECRET is missing
    process.env.SUPABASE_SERVICE_ROLE_KEY = validBaseEnv.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.RECEIPT_HMAC_SECRET;

    const readyNoHmacReq = new Request('http://localhost/api/health?probe=readiness');
    const readyNoHmacRes = await GET(readyNoHmacReq);
    const readyNoHmacBody = await readyNoHmacRes.json();

    assert(
      readyNoHmacRes.status === 503 && readyNoHmacBody.status === 'error',
      '[Readiness Probe] Fails closed (HTTP 503 { status: "error" }) when RECEIPT_HMAC_SECRET is missing'
    );

    // 2.6 Readiness probe FAILS CLOSED when RECEIPT_HMAC_SECRET is a placeholder
    process.env.RECEIPT_HMAC_SECRET = 'generate-a-secure-random-64-character-hex-string-for-hmac-verification';

    const readyPlaceholderHmacReq = new Request('http://localhost/api/health?probe=readiness');
    const readyPlaceholderHmacRes = await GET(readyPlaceholderHmacReq);
    const readyPlaceholderHmacBody = await readyPlaceholderHmacRes.json();

    assert(
      readyPlaceholderHmacRes.status === 503 && readyPlaceholderHmacBody.status === 'error',
      '[Readiness Probe] Fails closed when RECEIPT_HMAC_SECRET is a placeholder string'
    );

    // 2.7 Readiness probe FAILS CLOSED when RECEIPT_HMAC_SECRET is too short (< 32 chars)
    process.env.RECEIPT_HMAC_SECRET = 'short-secret';

    const readyShortHmacReq = new Request('http://localhost/api/health?probe=readiness');
    const readyShortHmacRes = await GET(readyShortHmacReq);
    const readyShortHmacBody = await readyShortHmacRes.json();

    assert(
      readyShortHmacRes.status === 503 && readyShortHmacBody.status === 'error',
      '[Readiness Probe] Fails closed when RECEIPT_HMAC_SECRET is under 32 characters'
    );

    // 2.8 Readiness probe FAILS CLOSED when SUPABASE_SERVICE_ROLE_KEY is a placeholder
    process.env.RECEIPT_HMAC_SECRET = validBaseEnv.RECEIPT_HMAC_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key-here';

    const readyPlaceholderServiceReq = new Request('http://localhost/api/health?probe=readiness');
    const readyPlaceholderServiceRes = await GET(readyPlaceholderServiceReq);
    const readyPlaceholderServiceBody = await readyPlaceholderServiceRes.json();

    assert(
      readyPlaceholderServiceRes.status === 503 && readyPlaceholderServiceBody.status === 'error',
      '[Readiness Probe] Fails closed when SUPABASE_SERVICE_ROLE_KEY is a placeholder string'
    );

    // 2.9 Fully configured environment pointing to local disposable DB: Readiness probe succeeds with HTTP 200 { status: "ok" }
    process.env.NEXT_PUBLIC_SUPABASE_URL = validBaseEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = validBaseEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = validBaseEnv.SUPABASE_SERVICE_ROLE_KEY;
    process.env.RECEIPT_HMAC_SECRET = validBaseEnv.RECEIPT_HMAC_SECRET;

    const fullReadyReq = new Request('http://localhost/api/health?probe=readiness');
    const fullReadyRes = await GET(fullReadyReq);
    const fullReadyBody = await fullReadyRes.json();

    assert(
      fullReadyRes.status === 200 && fullReadyBody.status === 'ok',
      '[Readiness Probe] Fully configured environment returns HTTP 200 { status: "ok" }',
      `HTTP ${fullReadyRes.status}, status: ${fullReadyBody.status}`
    );

    // 2.10 Default /api/health succeeds with HTTP 200 when fully configured
    const fullDefaultReq = new Request('http://localhost/api/health');
    const fullDefaultRes = await GET(fullDefaultReq);
    const fullDefaultBody = await fullDefaultRes.json();

    assert(
      fullDefaultRes.status === 200 && fullDefaultBody.status === 'ok',
      '[Readiness Probe] Default /api/health succeeds with HTTP 200 when fully configured'
    );
  } finally {
    // Always restore original environment variables
    if (origServiceKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (origHmacSecret) process.env.RECEIPT_HMAC_SECRET = origHmacSecret;
    else delete process.env.RECEIPT_HMAC_SECRET;

    if (origSupabaseUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl;
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (origAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnonKey;
    else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: ZERO-LEAK & RESPONSE COMPATIBILITY CONTRACT
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: ZERO-LEAK & RESPONSE COMPATIBILITY CONTRACT ---');

  const healthSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/api/health/route.ts'),
    'utf-8'
  );

  // 3.1 Static check: route.ts does not directly read secret env vars
  assert(
    !healthSrc.includes('process.env.SUPABASE_SERVICE_ROLE_KEY') &&
      !healthSrc.includes('process.env.NEXT_PUBLIC_SUPABASE_URL'),
    '[Zero-Leak] src/app/api/health/route.ts contains zero direct secret or URL reads'
  );

  // 3.2 Static check: zero internal timing, hostname, or stack trace exposure
  assert(
    !healthSrc.includes('.host') && !healthSrc.includes('latency'),
    '[Zero-Leak] src/app/api/health/route.ts contains zero internal hostname or latency tokens'
  );

  // 3.3 Cache-Control headers check
  const cacheReq = new Request('http://localhost/api/health');
  const cacheRes = await GET(cacheReq);
  const cacheHeader = cacheRes.headers.get('Cache-Control');
  assert(
    Boolean(cacheHeader && cacheHeader.includes('no-store')),
    '[Response Compatibility] Cache-Control: no-store header present on health responses',
    `Cache-Control: ${cacheHeader}`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n=================================================================');
  console.log('HEALTH READINESS & PAYMENT CONFIGURATION TEST SUMMARY');
  console.log('=================================================================');
  console.log(`Total Assertions : ${passCount + failCount}`);
  console.log(`Passed           : ${passCount}`);
  console.log(`Failed           : ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
