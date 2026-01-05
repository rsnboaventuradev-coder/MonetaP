-- ========================================
-- FIX: Remover constraint antiga que bloqueia categorias PJ
-- ========================================

-- 1. Remover a constraint antiga que só permite categorias PF
ALTER TABLE public.budget_allocations 
DROP CONSTRAINT IF EXISTS budget_allocations_category_check;

-- 2. Verificar se há outras constraints bloqueando
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.budget_allocations'::regclass
AND contype = 'c'; -- check constraints

-- 3. Confirmar estrutura atual
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'budget_allocations' 
ORDER BY ordinal_position;
