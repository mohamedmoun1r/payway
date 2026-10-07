import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Minimal and safe health check endpoint.
 * Returns only { "status": "ok" } or { "status": "error" } without disclosing
 * any database connection strings, hostnames, environment variables, latencies,
 * versions, or internal implementation details.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Lightweight query on an indexed table without scanning rows
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
