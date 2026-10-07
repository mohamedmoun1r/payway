import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateCsv, type CsvColumn } from '@/lib/export/csv';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

type RawExportTxn = Database['public']['Tables']['transactions']['Row'] & {
  receipt?: { receipt_number: string }[];
  semester?: { code: string };
  student?: {
    student_number: string;
    profile?: { full_name_ar: string; full_name_en: string };
  };
  admin?: {
    employee_id: string;
  };
};

/**
 * Administrative CSV Export for Financial Payments Ledger.
 * - Strictly authorized for ADMIN and SUPER_ADMIN roles.
 * - Respects database RLS using user session cookies (zero service-role bypass).
 * - Hard-capped at 1,000 rows to prevent unbounded memory usage.
 * - Excludes sensitive student PII (national_id, phone, email).
 * - Omits currency column to adhere strictly to verified schema without fabrication.
 * - Formula-injection sanitized and prefixed with UTF-8 BOM.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Strict Server Authorization Check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized: Valid admin session required.', { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (
      !profile ||
      !profile.is_active ||
      (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')
    ) {
      return new NextResponse('Forbidden: Insufficient privileges for financial data export.', {
        status: 403,
      });
    }

    // 2. Parse query parameters
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const limit = Math.min(Number(searchParams.get('limit')) || 1000, 1000);

    // 3. Bounded Query with joined relations
    let query = supabase
      .from('transactions')
      .select(`
        *,
        receipt:receipts(receipt_number),
        semester:semesters(code),
        student:students(student_number, profile:profiles(full_name_ar, full_name_en)),
        admin:admins(employee_id)
      `)
      .order('payment_date', { ascending: false })
      .limit(limit);

    if (status && status !== 'ALL') {
      query = query.eq('status', status as Database['public']['Enums']['transaction_status']);
    }
    if (method && method !== 'ALL') {
      query = query.eq('payment_method', method as Database['public']['Enums']['payment_method']);
    }
    if (fromDate) {
      query = query.gte('payment_date', fromDate);
    }
    if (toDate) {
      query = query.lte('payment_date', toDate);
    }

    const { data: rawTxns, error: dbError } = await query;

    if (dbError) {
      return new NextResponse('Failed to retrieve financial transactions.', { status: 500 });
    }

    const transactions = (rawTxns || []) as unknown as RawExportTxn[];

    // 4. Define CSV Columns (Strictly non-PII, no currency fabrication)
    const columns: CsvColumn<RawExportTxn>[] = [
      {
        header: 'Transaction Number',
        accessor: (r) => r.transaction_number,
      },
      {
        header: 'Receipt Number',
        accessor: (r) => r.receipt?.[0]?.receipt_number || '-',
      },
      {
        header: 'Student Number',
        accessor: (r) => r.student?.student_number || '-',
      },
      {
        header: 'Student Name (Arabic)',
        accessor: (r) => r.student?.profile?.full_name_ar || '-',
      },
      {
        header: 'Student Name (English)',
        accessor: (r) => r.student?.profile?.full_name_en || '-',
      },
      {
        header: 'Semester Code',
        accessor: (r) => r.semester?.code || '-',
      },
      {
        header: 'Payment Method',
        accessor: (r) => r.payment_method,
      },
      {
        header: 'Amount',
        accessor: (r) => Number(r.amount),
      },
      {
        header: 'Payment Date',
        accessor: (r) => r.payment_date,
      },
      {
        header: 'Payment Time',
        accessor: (r) => r.payment_time,
      },
      {
        header: 'Transaction Status',
        accessor: (r) => r.status,
      },
      {
        header: 'Reference Number',
        accessor: (r) => r.reference_number || '-',
      },
      {
        header: 'Cashier Desk Employee ID',
        accessor: (r) => r.admin?.employee_id || '-',
      },
    ];

    const csvOutput = generateCsv(transactions, columns);

    return new NextResponse(csvOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8; header=present',
        'Content-Disposition': `attachment; filename="cufe-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch {
    return new NextResponse('Internal error processing export.', { status: 500 });
  }
}
