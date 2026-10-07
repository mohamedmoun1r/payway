import 'server-only';
import crypto from 'crypto';

export interface ReceiptHashPayload {
  studentId: string;
  semesterId: string;
  amount: number | string;
  paymentDate: string;
  idempotencyKey: string;
}

/**
 * Computes a deterministic 64-character hex SHA-256 HMAC verification hash
 * for a manual payment receipt using the server-side RECEIPT_HMAC_SECRET.
 *
 * This secret NEVER touches PostgreSQL RPC parameters or the client bundle.
 */
export function generateReceiptVerificationHash(payload: ReceiptHashPayload): string {
  // Use server secret; fallback provided for local pre-production demo testing
  const secret =
    process.env.RECEIPT_HMAC_SECRET ||
    'cufe-pilot-default-hmac-secret-64-character-token-verification-key-2024';

  const serialized = `${payload.studentId}:${payload.semesterId}:${Number(payload.amount).toFixed(2)}:${payload.paymentDate}:${payload.idempotencyKey}`;

  return crypto.createHmac('sha256', secret).update(serialized).digest('hex');
}
