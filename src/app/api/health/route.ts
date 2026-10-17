import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { isPaymentConfigurationReady } from '@/lib/config/payment-config';

export const dynamic = 'force-dynamic';

/**
 * Minimal and safe health check endpoint.
 *
 * Probes:
 * - Liveness probe: GET /api/health?probe=liveness (or ?type=liveness, ?check=liveness)
 *   Verifies server process responsiveness. Does not perform database or network calls.
 * - Readiness probe: GET /api/health?probe=readiness (or default GET /api/health)
 *   Verifies required payment configuration (SUPABASE_SERVICE_ROLE_KEY, RECEIPT_HMAC_SECRET, etc.)
 *   and database reachability. Fails closed (HTTP 503) if configuration is missing or invalid.
 *
 * Contract:
 * Returns only { "status": "ok" } or { "status": "error" } without disclosing
 * any database connection strings, hostnames, environment variables, latencies,
 * versions, or internal implementation details.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const probe = (
      url?.searchParams.get('probe') ||
      url?.searchParams.get('type') ||
      url?.searchParams.get('check') ||
      'readiness'
    ).toLowerCase();

    // 1. Liveness Probe: process is responsive; zero external network/database calls
    if (probe === 'liveness' || probe === 'live') {
      return NextResponse.json(
        { status: 'ok' },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 2. Readiness Probe: Fail closed if required payment configuration is missing or invalid
    if (!isPaymentConfigurationReady()) {
      return NextResponse.json(
        { status: 'error' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 3. Readiness Probe: Lightweight query on an indexed table without scanning rows
    const supabase = createClient();
    const { error } = await supabase.from('semesters').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'error' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      { status: 'ok' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { status: 'error' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
