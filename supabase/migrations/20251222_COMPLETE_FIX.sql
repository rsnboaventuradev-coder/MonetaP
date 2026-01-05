-- CORREÇÃO COMPLETA DA TABELA GOALS
-- Execute este script COMPLETO no Supabase SQL Editor

-- 1. Adicionar TODAS as colunas que podem estar faltando
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🎯',
ADD COLUMN IF NOT EXISTS budget_type TEXT CHECK (budget_type IN ('personal', 'business', 'savings')) DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS category_type TEXT CHECK (category_type IN ('revenue', 'expense')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_progressive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT NULL;

-- 2. Verificar todas as colunas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'goals'
ORDER BY ordinal_position;
