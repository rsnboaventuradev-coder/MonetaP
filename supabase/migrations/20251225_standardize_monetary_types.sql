-- MIGRATION: 20251225_standardize_monetary_types.sql
-- PURPOSE: Standardize all monetary columns to BIGINT (Centavos).
-- UPDATED: Added column existence checks to prevent "column does not exist" errors.
-- UPDATED: Included 'contas' table based on diagnostic reports.

BEGIN;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. Transactions Standard (transactions)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount') THEN
        ALTER TABLE public.transactions 
        ALTER COLUMN amount TYPE BIGINT 
        USING (
            CASE 
                WHEN amount % 1 != 0 THEN (amount * 100)::BIGINT
                ELSE amount::BIGINT
            END
        );
    END IF;

    -- 2. Recurring Transactions
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recurring_transactions' AND column_name = 'amount') THEN
        ALTER TABLE public.recurring_transactions 
        ALTER COLUMN amount TYPE BIGINT 
        USING (
            CASE 
                WHEN amount % 1 != 0 THEN (amount * 100)::BIGINT
                ELSE amount::BIGINT
            END
        );
    END IF;

    -- 3. Accounts Table (English)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'balance') THEN
        ALTER TABLE public.accounts 
        ALTER COLUMN balance TYPE BIGINT 
        USING (
            CASE WHEN balance % 1 != 0 THEN (balance * 100)::BIGINT ELSE balance::BIGINT END
        );
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'initial_balance') THEN
        ALTER TABLE public.accounts 
        ALTER COLUMN initial_balance TYPE BIGINT 
        USING (
            CASE WHEN initial_balance % 1 != 0 THEN (initial_balance * 100)::BIGINT ELSE initial_balance::BIGINT END
        );
    END IF;

    -- 4. Contas Table (Portuguese - found in diagnostics)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contas' AND column_name = 'balance') THEN
        ALTER TABLE public.contas 
        ALTER COLUMN balance TYPE BIGINT 
        USING (
            CASE WHEN balance % 1 != 0 THEN (balance * 100)::BIGINT ELSE balance::BIGINT END
        );
    END IF;

    -- 5. Goals (English)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'target_amount') THEN
        ALTER TABLE public.goals 
        ALTER COLUMN target_amount TYPE BIGINT 
        USING (
            CASE WHEN target_amount % 1 != 0 THEN (target_amount * 100)::BIGINT ELSE target_amount::BIGINT END
        );
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'current_amount') THEN
        ALTER TABLE public.goals 
        ALTER COLUMN current_amount TYPE BIGINT 
        USING (
            CASE WHEN current_amount % 1 != 0 THEN (current_amount * 100)::BIGINT ELSE current_amount::BIGINT END
        );
    END IF;
    
    -- 6. Metas (Portuguese - found in diagnostics)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'metas' AND column_name = 'target_amount') THEN
        ALTER TABLE public.metas 
        ALTER COLUMN target_amount TYPE BIGINT 
        USING (
            CASE WHEN target_amount % 1 != 0 THEN (target_amount * 100)::BIGINT ELSE target_amount::BIGINT END
        );
    END IF;

END $$;

COMMIT;
