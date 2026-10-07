import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTreasuryClosingMetrics } from '@/lib/data/reports';
import { sanitizeCsvCell } from '@/lib/export/csv';

export const dynamic = 'force-dynamic';

/**
 * Administrative CSV Export for Treasury Daily Closing Statement.
 * - Authorized strictly for ADMIN and SUPER_ADMIN roles.
 * - Respects database RLS (zero service-role bypass).
 * - Distinguishes COMPLETED from VOIDED transactions.
 * - Shows Cash Drawer, POS Settlement Slips, Bank Transfers, and Void Adjustments.
 * - Omit any fabricated currency fields.
 * - Sanitizes cells against formula injection and encodes with UTF-8 BOM.
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
      return new NextResponse('Forbidden: Insufficient privileges for reconciliation export.', {
        status: 403,
      });
    }

    // 2. Parse query parameters
    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date') || undefined;
    const fromDate = searchParams.get('from') || undefined;
    const toDate = searchParams.get('to') || undefined;
    const semesterId = searchParams.get('semesterId') || undefined;

    // 3. Fetch reconciled metrics
    const metrics = await getTreasuryClosingMetrics({
      date,
      fromDate,
      toDate,
      semesterId,
    });

    // 4. Build Structured Multi-Section CSV with BOM
    const BOM = '\uFEFF';
    const lines: string[] = [];

    // Section 1: Executive Closing Summary
    lines.push([sanitizeCsvCell('=== CAIRO UNIVERSITY FACULTY OF ENGINEERING - TREASURY CLOSING STATEMENT ===')].join(','));
    lines.push([sanitizeCsvCell('Report Date'), sanitizeCsvCell(date || 'All Dates')].join(','));
    lines.push([sanitizeCsvCell('Exported At'), sanitizeCsvCell(new Date().toISOString())].join(','));
    lines.push('');

    lines.push([sanitizeCsvCell('METRIC'), sanitizeCsvCell('VALUE')].join(','));
    lines.push([sanitizeCsvCell('Total Transactions Count'), sanitizeCsvCell(metrics.totalTransactionsCount)].join(','));
    lines.push([sanitizeCsvCell('Completed Transactions Count'), sanitizeCsvCell(metrics.completedCount)].join(','));
    lines.push([sanitizeCsvCell('Voided Transactions Count'), sanitizeCsvCell(metrics.voidedCount)].join(','));
    lines.push([sanitizeCsvCell('Gross Completed Collections (Total)'), sanitizeCsvCell(metrics.grossCompletedAmount)].join(','));
    lines.push([sanitizeCsvCell('Physical Cash in Drawer (CASH)'), sanitizeCsvCell(metrics.methodBreakdown.cashAmount)].join(','));
    lines.push([sanitizeCsvCell('POS Card Settlement Slips (POS)'), sanitizeCsvCell(metrics.methodBreakdown.posAmount)].join(','));
    lines.push([sanitizeCsvCell('Bank Deposit Vouchers (BANK_TRANSFER)'), sanitizeCsvCell(metrics.methodBreakdown.bankTransferAmount)].join(','));
    lines.push([sanitizeCsvCell('Voided Reversals Adjustment Amount'), sanitizeCsvCell(metrics.voidedAdjustmentsAmount)].join(','));
    lines.push([sanitizeCsvCell('Net Reconciled Treasury Position'), sanitizeCsvCell(metrics.netReconciledAmount)].join(','));
    lines.push('');

    // Section 2: Cashier Desk Breakdown
    lines.push([sanitizeCsvCell('=== CASHIER DESK BREAKDOWN ===')].join(','));
    lines.push([
      sanitizeCsvCell('Cashier Employee ID'),
      sanitizeCsvCell('Cashier Name (Arabic)'),
      sanitizeCsvCell('Cashier Name (English)'),
      sanitizeCsvCell('Completed Count'),
      sanitizeCsvCell('Completed Amount'),
      sanitizeCsvCell('Cash Collected'),
      sanitizeCsvCell('POS Collected'),
      sanitizeCsvCell('Bank Transfer Collected'),
      sanitizeCsvCell('Voided Count'),
      sanitizeCsvCell('Voided Amount'),
    ].join(','));

    metrics.cashierBreakdown.forEach((c) => {
      lines.push([
        sanitizeCsvCell(c.employeeId),
        sanitizeCsvCell(c.cashierNameAr),
        sanitizeCsvCell(c.cashierNameEn),
        sanitizeCsvCell(c.completedCount),
        sanitizeCsvCell(c.completedAmount),
        sanitizeCsvCell(c.cashAmount),
        sanitizeCsvCell(c.posAmount),
        sanitizeCsvCell(c.bankTransferAmount),
        sanitizeCsvCell(c.voidedCount),
        sanitizeCsvCell(c.voidedAmount),
      ].join(','));
    });
    lines.push('');

    // Section 3: Voided Reversals Audit Details
    lines.push([sanitizeCsvCell('=== VOIDED ADJUSTMENTS & CANCELLATIONS AUDIT ===')].join(','));
    lines.push([
      sanitizeCsvCell('Transaction Number'),
      sanitizeCsvCell('Student Number'),
      sanitizeCsvCell('Payment Method'),
      sanitizeCsvCell('Reversed Amount'),
      sanitizeCsvCell('Payment Date'),
      sanitizeCsvCell('Void Reason'),
      sanitizeCsvCell('Voided At'),
    ].join(','));

    metrics.voidedTransactions.forEach((v) => {
      lines.push([
        sanitizeCsvCell(v.transactionNumber),
        sanitizeCsvCell(v.studentNumber),
        sanitizeCsvCell(v.paymentMethod),
        sanitizeCsvCell(v.amount),
        sanitizeCsvCell(v.paymentDate),
        sanitizeCsvCell(v.voidReason || '-'),
        sanitizeCsvCell(v.voidedAt || '-'),
      ].join(','));
    });

    const csvContent = BOM + lines.join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8; header=present',
        'Content-Disposition': `attachment; filename="cufe-treasury-closing-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch {
    return new NextResponse('Internal error processing reconciliation export.', { status: 500 });
  }
}
