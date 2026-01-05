-- ========================================
-- EXECUTE ESTE SCRIPT COMPLETO NO SUPABASE
-- Inclui: Accounts + Emergency Fund + Tab Visibility
-- ========================================

-- 1. Garantir que a tabela accounts existe (sem constraints problemáticas)
DROP TABLE IF EXISTS public.accounts CASCADE;

CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    institution TEXT,
    initial_balance BIGINT DEFAULT 0,
    current_balance BIGINT DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT '💳',
    is_active BOOLEAN DEFAULT true,
    include_in_total BOOLEAN DEFAULT true,
    is_emergency_fund BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX idx_accounts_user ON public.accounts(user_id);
CREATE INDEX idx_accounts_active ON public.accounts(user_id, is_active);
CREATE INDEX idx_accounts_emergency ON public.accounts(user_id, is_emergency_fund) WHERE is_emergency_fund = true;

-- 3. Adicionar account_id em transactions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE public.transactions
        ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
        
        CREATE INDEX idx_transactions_account ON public.transactions(account_id);
    END IF;
END $$;

-- 4. RLS Policies para accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
CREATE POLICY "Users can view own accounts" 
ON public.accounts FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
CREATE POLICY "Users can insert own accounts" 
ON public.accounts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
CREATE POLICY "Users can update own accounts" 
ON public.accounts FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can delete own accounts" 
ON public.accounts FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Adicionar campos em user_profiles (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'emergency_fund_months'
    ) THEN
        ALTER TABLE public.user_profiles
        ADD COLUMN emergency_fund_months INTEGER DEFAULT 6;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'hidden_tabs'
    ) THEN
        ALTER TABLE public.user_profiles
        ADD COLUMN hidden_tabs JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 6. Verificação Final
SELECT 'accounts' as table_name, column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'accounts'
ORDER BY ordinal_position;
