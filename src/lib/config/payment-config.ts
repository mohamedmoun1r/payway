import 'server-only';

export interface PaymentConfigValidationResult {
  ready: boolean;
  missingKeys: string[];
}

const PLACEHOLDER_PATTERNS = [
  'placeholder',
  'your-project-id',
  'your-anon-key',
  'your-service-role-key',
  'generate-a-secure-random',
  'example.com',
];

/**
 * Validates the required payment configuration environment variables.
 *
 * Requirements based on actual code usage:
 * 1. NEXT_PUBLIC_SUPABASE_URL: Required for Supabase client connection (createClient and createAdminClient).
 * 2. NEXT_PUBLIC_SUPABASE_ANON_KEY: Required for user sessions and database queries.
 * 3. SUPABASE_SERVICE_ROLE_KEY: Strictly required for createAdminClient() to invoke
 *    public.record_manual_payment_atomic (Migration 5 revoked public/authenticated execution).
 * 4. RECEIPT_HMAC_SECRET: Strictly required for generateReceiptVerificationHash() to sign
 *    payment receipts using HMAC-SHA256. Must be non-empty and meet minimum length (>= 32 chars).
 *
 * Security: NEVER returns or logs the secret values themselves.
 */
export function validatePaymentConfiguration(
  env: Record<string, string | undefined> = process.env
): PaymentConfigValidationResult {
  const missingKeys: string[] = [];

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url || !url.startsWith('http') || isPlaceholder(url)) {
    missingKeys.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey || isPlaceholder(anonKey)) {
    missingKeys.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey || isPlaceholder(serviceRoleKey) || serviceRoleKey === anonKey) {
    missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  const hmacSecret = env.RECEIPT_HMAC_SECRET?.trim();
  if (!hmacSecret || isPlaceholder(hmacSecret) || hmacSecret.length < 32) {
    missingKeys.push('RECEIPT_HMAC_SECRET');
  }

  return {
    ready: missingKeys.length === 0,
    missingKeys,
  };
}

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Returns true if all payment configuration environment variables are present and valid.
 * Fails closed if any variable is missing, empty, or a placeholder.
 */
export function isPaymentConfigurationReady(
  env: Record<string, string | undefined> = process.env
): boolean {
  return validatePaymentConfiguration(env).ready;
}
