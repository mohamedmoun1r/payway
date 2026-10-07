import { z } from 'zod';

export const PaymentMethodEnum = z.enum(['CASH', 'BANK_TRANSFER', 'POS', 'OTHER']);

export const manualPaymentSchema = z.object({
  studentId: z.string().min(1, 'Student ID cannot be empty'),
  semesterId: z.string().min(1, 'Semester ID cannot be empty'),
  amount: z
    .number()
    .positive('Payment amount must be greater than 0')
    .max(1000000, 'Payment amount exceeds maximum single transaction limit')
    .refine(
      (val) => {
        const parts = val.toString().split('.');
        return parts.length < 2 || parts[1].length <= 2;
      },
      { message: 'Amount cannot exceed 2 decimal places' }
    ),
  paymentMethod: PaymentMethodEnum,
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format')
    .refine(
      (val) => {
        const d = new Date(val);
        return !isNaN(d.getTime());
      },
      { message: 'Invalid payment date' }
    ),
  paymentTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Payment time must be in HH:MM or HH:MM:SS format'),
  referenceNumber: z
    .string()
    .max(100, 'Reference number cannot exceed 100 characters')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  idempotencyKey: z
    .string()
    .min(10, 'Idempotency key is too short')
    .max(100, 'Idempotency key cannot exceed 100 characters'),
});

export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

export const voidTransactionSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction UUID'),
  voidReason: z
    .string()
    .trim()
    .min(10, 'Void justification must be at least 10 characters long')
    .max(500, 'Void reason cannot exceed 500 characters'),
  confirmed: z.boolean().refine((val) => val === true, {
    message: 'Explicit confirmation is required to void this transaction',
  }),
});

export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
