-- ========================================
-- FIX: Remover constraint antiga e recriar tabela accounts
-- ========================================

-- 1. Dropar tabela existente (se houver dados, eles serão perdidos)
DROP TABLE IF EXISTS public.accounts CASCADE;

-- 2. Recriar tabela SEM constraint no type
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX idx_accounts_user ON public.accounts(user_id);
CREATE INDEX idx_accounts_active ON public.accounts(user_id, is_active);

-- 4. Adicionar account_id em transactions (se não existir)
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

-- 5. RLS Policies
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

-- 6. Verificação final
SELECT 
    table_name,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'accounts'
ORDER BY ordinal_position;
