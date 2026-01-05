-- SCRIPT CONSOLIDADO: Aplicar no Supabase SQL Editor
-- Execute este script completo no seu dashboard Supabase

-- 1. Garantir que a tabela goals existe com todas as colunas base
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_amount BIGINT NOT NULL,
    current_amount BIGINT DEFAULT 0,
    deadline DATE,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    type TEXT CHECK (type IN ('security', 'career', 'lifestyle', 'financial_freedom')) DEFAULT 'lifestyle',
    maintenance_cost BIGINT DEFAULT 0,
    investment_link TEXT,
    icon TEXT DEFAULT '🎯',
    status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna icon se não existir (para tabelas já criadas)
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🎯';

-- 2. Adicionar colunas PJ Budget (se não existirem)
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS budget_type TEXT CHECK (budget_type IN ('personal', 'business', 'savings')) DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS category_type TEXT CHECK (category_type IN ('revenue', 'expense')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_progressive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT NULL;

-- 3. Habilitar RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON public.goals;

-- 5. Criar políticas RLS
CREATE POLICY "Users can view own goals" ON public.goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON public.goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON public.goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON public.goals
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_deadline ON public.goals(deadline);
CREATE INDEX IF NOT EXISTS idx_goals_budget_type ON public.goals(budget_type);
CREATE INDEX IF NOT EXISTS idx_goals_category_type ON public.goals(category_type);

-- 7. Adicionar comentários
COMMENT ON COLUMN public.goals.budget_type IS 'Type of budget: personal (PF), business (PJ), or savings';
COMMENT ON COLUMN public.goals.category_type IS 'For budget goals: revenue or expense';
COMMENT ON COLUMN public.goals.is_progressive IS 'If true, allows gradual monthly filling';
COMMENT ON COLUMN public.goals.subcategory IS 'Subcategory for business budgets';

-- Verificação: Listar todas as colunas da tabela goals
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'goals'
ORDER BY ordinal_position;
