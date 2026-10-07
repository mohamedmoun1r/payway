import 'server-only';
import { createClient } from '@supabase/supabase-js';

export interface PublicVerificationResponse {
  authenticity_result: boolean;
  receipt_number: string;
  transaction_number: string;
  amount: number;
  payment_date: string;
  payment_status: string;
  issued_at: string;
}

/**
 * Publicly verifies a receipt by its cryptographic SHA-256 HMAC hash.
 * Completely unauthenticated and privacy-preserving.
 * Exposes EXACTLY 7 safe non-PII fields:
 * 1. receipt_number
 * 2. transaction_number
 * 3. amount
 * 4. payment_date
 * 5. payment_status
 * 6. authenticity_result
 * 7. issued_at
 */
export async function verifyReceiptByHash(
  verificationHash: string
): Promise<PublicVerificationResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      authenticity_result: false,
      receipt_number: '',
      transaction_number: '',
      amount: 0,
      payment_date: '',
      payment_status: 'UNVERIFIED',
      issued_at: '',
    };
  }

  // Use unauthenticated anon client to invoke public.verify_receipt_public
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await anonClient.rpc('verify_receipt_public', {
      p_verification_hash: verificationHash,
    });

    if (error || !data || data.length === 0) {
      return {
        authenticity_result: false,
        receipt_number: '',
        transaction_number: '',
        amount: 0,
        payment_date: '',
        payment_status: 'UNVERIFIED',
        issued_at: '',
      };
    }

    const row = data[0];

    // Strictly enforce the approved 7-field non-PII contract (Zero currency, zero student details)
    return {
      authenticity_result: true,
      receipt_number: String(row.receipt_number || ''),
      transaction_number: String(row.transaction_number || ''),
      amount: Number(row.amount || 0),
      payment_date: String(row.payment_date || ''),
      payment_status: String(row.payment_status || 'COMPLETED'),
      issued_at: String(row.issued_at || ''),
    };
  } catch (err) {
    console.error('[PUBLIC_VERIFICATION_EXCEPTION]', err);
    return {
      authenticity_result: false,
      receipt_number: '',
      transaction_number: '',
      amount: 0,
      payment_date: '',
      payment_status: 'UNVERIFIED',
      issued_at: '',
    };
  }
}
