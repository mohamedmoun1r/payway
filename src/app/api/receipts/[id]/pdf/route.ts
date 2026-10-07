import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { getAuthorizedReceiptData } from '@/lib/data/receipt';
import { ReceiptPdfDocument, type ReceiptPdfData } from '@/lib/pdf/receipt-template';
import { generateQrDataUrl } from '@/lib/qr/generate-qr';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Receipt ID parameter is required' }, { status: 400 });
    }

    // 1. Enforce strict server-side authorization through auth.users -> profiles -> students -> receipts
    const result = await getAuthorizedReceiptData(id);

    if (result.error) {
      switch (result.error) {
        case 'UNAUTHENTICATED':
          return NextResponse.json(
            { error: 'Unauthorized: Active authenticated session required' },
            { status: 401 }
          );
        case 'FORBIDDEN':
          return NextResponse.json(
            { error: 'Forbidden: You do not have permission to view or download this receipt' },
            { status: 403 }
          );
        case 'INACTIVE_PROFILE':
        case 'STUDENT_RECORD_MISSING':
          return NextResponse.json(
            { error: 'Forbidden: Inactive account or missing student registration' },
            { status: 403 }
          );
        case 'NOT_FOUND':
        default:
          return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }
    }

    const { receipt, transaction, student, profile, semester, cashierEmployeeId } = result.data!;

    // 2. Generate In-Memory QR Code Data URL (Zero Cloud Storage, Zero Disk I/O)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${appUrl}/ar/verify/receipt/${receipt.verification_hash}`;
    const qrDataUrl = await generateQrDataUrl(verificationUrl);

    // 3. Assemble PDF Template Data
    const pdfData: ReceiptPdfData = {
      receiptNumber: receipt.receipt_number,
      transactionNumber: transaction.transaction_number,
      issuedAt: receipt.issued_at,
      amount: Number(receipt.total_amount),
      currency: receipt.currency || 'EGP',
      paymentMethod: transaction.payment_method,
      paymentDate: transaction.payment_date,
      paymentTime: transaction.payment_time,
      referenceNumber: transaction.reference_number,
      notes: transaction.notes,
      status: transaction.status,
      studentNameAr: profile.full_name_ar,
      studentNameEn: profile.full_name_en,
      studentNumber: student.student_number,
      academicProgram: student.academic_program,
      academicDepartment: student.academic_department,
      academicLevel: student.academic_level,
      semesterNameAr: semester.name_ar,
      semesterNameEn: semester.name_en,
      recordedByEmployeeId: cashierEmployeeId,
      qrDataUrl,
      verificationHash: receipt.verification_hash,
    };

    // 4. Render PDF Document into memory buffer
    const pdfElement = React.createElement(ReceiptPdfDocument, { data: pdfData });
    // @ts-expect-error - renderToBuffer typings compatibility with React 19 JSX
    const pdfBuffer = await renderToBuffer(pdfElement);

    // 5. Stream inline PDF directly to browser response
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CUFE-Receipt-${receipt.receipt_number}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (err) {
    console.error('[RECEIPT_PDF_GENERATION_EXCEPTION]', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating the receipt PDF' },
      { status: 500 }
    );
  }
}
