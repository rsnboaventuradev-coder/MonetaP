-- ========================================
-- EXECUTE ESTE SCRIPT NO SUPABASE AGORA
-- ========================================

-- 1. Adicionar coluna context
ALTER TABLE public.budget_allocations
ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'personal';

-- 2. Atualizar registros existentes
UPDATE public.budget_allocations 
SET context = 'personal' 
WHERE context IS NULL;

-- 3. Adicionar constraint de validação
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'budget_allocations_context_check'
    ) THEN
        ALTER TABLE public.budget_allocations 
        ADD CONSTRAINT budget_allocations_context_check 
        CHECK (context IN ('personal', 'business'));
    END IF;
END $$;

-- 4. Criar índice
CREATE INDEX IF NOT EXISTS idx_budget_allocations_context 
ON public.budget_allocations(context);

-- 5. Remover constraint antiga (se existir)
ALTER TABLE public.budget_allocations 
DROP CONSTRAINT IF EXISTS budget_allocations_user_id_category_key;

-- 6. Adicionar nova constraint única
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'budget_allocations_user_id_category_context_key'
    ) THEN
        ALTER TABLE public.budget_allocations 
        ADD CONSTRAINT budget_allocations_user_id_category_context_key 
        UNIQUE (user_id, category, context);
    END IF;
END $$;

-- Verificar resultado
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'budget_allocations' 
ORDER BY ordinal_position;
