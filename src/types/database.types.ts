export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER';
export type TransactionStatus = 'COMPLETED' | 'VOIDED';
export type DueStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type SemesterSeason = 'FALL' | 'SPRING' | 'SUMMER';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          national_id: string | null;
          full_name_ar: string;
          full_name_en: string;
          email: string;
          phone: string | null;
          is_demo: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          national_id?: string | null;
          full_name_ar: string;
          full_name_en: string;
          email: string;
          phone?: string | null;
          is_demo?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          national_id?: string | null;
          full_name_ar?: string;
          full_name_en?: string;
          email?: string;
          phone?: string | null;
          is_demo?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          student_number: string;
          academic_program: string;
          academic_department: string;
          academic_level: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          student_number: string;
          academic_program: string;
          academic_department: string;
          academic_level?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_number?: string;
          academic_program?: string;
          academic_department?: string;
          academic_level?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admins: {
        Row: {
          id: string;
          employee_id: string;
          office_department: string;
          can_void_payments: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          employee_id: string;
          office_department?: string;
          can_void_payments?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          office_department?: string;
          can_void_payments?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      semesters: {
        Row: {
          id: string;
          code: string;
          name_ar: string;
          name_en: string;
          academic_year: string;
          season: SemesterSeason;
          start_date: string;
          end_date: string;
          is_current: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name_ar: string;
          name_en: string;
          academic_year: string;
          season: SemesterSeason;
          start_date: string;
          end_date: string;
          is_current?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name_ar?: string;
          name_en?: string;
          academic_year?: string;
          season?: SemesterSeason;
          start_date?: string;
          end_date?: string;
          is_current?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      student_dues: {
        Row: {
          id: string;
          student_id: string;
          semester_id: string;
          title_ar: string;
          title_en: string;
          original_amount: number;
          discount_amount: number;
          paid_amount: number;
          status: DueStatus;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          semester_id: string;
          title_ar?: string;
          title_en?: string;
          original_amount: number;
          discount_amount?: number;
          paid_amount?: number;
          status?: DueStatus;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          semester_id?: string;
          title_ar?: string;
          title_en?: string;
          original_amount?: number;
          discount_amount?: number;
          paid_amount?: number;
          status?: DueStatus;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          transaction_number: string;
          student_id: string;
          semester_id: string;
          student_due_id: string;
          amount: number;
          currency: string;
          payment_method: PaymentMethod;
          payment_date: string;
          payment_time: string;
          recorded_at: string;
          reference_number: string | null;
          notes: string | null;
          status: TransactionStatus;
          idempotency_key: string | null;
          recorded_by: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_number: string;
          student_id: string;
          semester_id: string;
          student_due_id: string;
          amount: number;
          currency?: string;
          payment_method: PaymentMethod;
          payment_date?: string;
          payment_time?: string;
          recorded_at?: string;
          reference_number?: string | null;
          notes?: string | null;
          status?: TransactionStatus;
          idempotency_key?: string | null;
          recorded_by: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          transaction_number?: string;
          student_id?: string;
          semester_id?: string;
          student_due_id?: string;
          amount?: number;
          currency?: string;
          payment_method?: PaymentMethod;
          payment_date?: string;
          payment_time?: string;
          recorded_at?: string;
          reference_number?: string | null;
          notes?: string | null;
          status?: TransactionStatus;
          idempotency_key?: string | null;
          recorded_by?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          receipt_number: string;
          transaction_id: string;
          student_id: string;
          issued_at: string;
          total_amount: number;
          currency: string;
          verification_hash: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          receipt_number: string;
          transaction_id: string;
          student_id: string;
          issued_at?: string;
          total_amount: number;
          currency?: string;
          verification_hash: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          receipt_number?: string;
          transaction_id?: string;
          student_id?: string;
          issued_at?: string;
          total_amount?: number;
          currency?: string;
          verification_hash?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          actor_role: UserRole | null;
          action: string;
          entity_name: string;
          entity_id: string;
          before_state: Json | null;
          after_state: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          actor_role?: UserRole | null;
          action: string;
          entity_name: string;
          entity_id: string;
          before_state?: Json | null;
          after_state?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          actor_role?: UserRole | null;
          action?: string;
          entity_name?: string;
          entity_id?: string;
          before_state?: Json | null;
          after_state?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      record_manual_payment_atomic: {
        Args: {
          p_student_id: string;
          p_semester_id: string;
          p_amount: number;
          p_payment_method: PaymentMethod;
          p_payment_date: string;
          p_payment_time: string;
          p_reference_number: string | null;
          p_notes: string | null;
          p_admin_id: string;
          p_idempotency_key: string;
          p_verification_hash: string;
        };
        Returns: {
          transaction_id: string;
          receipt_id: string;
          transaction_number: string;
          receipt_number: string;
        }[];
      };
      void_transaction_atomic: {
        Args: {
          p_transaction_id: string;
          p_void_reason: string;
          p_admin_id: string;
        };
        Returns: {
          transaction_id: string;
          restored_balance: number;
        }[];
      };
      verify_receipt_public: {
        Args: {
          p_verification_hash: string;
        };
        Returns: {
          is_valid: boolean;
          receipt_number: string;
          transaction_number: string;
          amount: number;
          currency: string;
          payment_date: string;
          payment_status: TransactionStatus;
          issued_at: string;
        }[];
      };
    };
    Views: Record<string, never>;
    Enums: {
      user_role: UserRole;
      payment_method: PaymentMethod;
      transaction_status: TransactionStatus;
      due_status: DueStatus;
      semester_season: SemesterSeason;
    };
    CompositeTypes: Record<string, never>;
  };
}
