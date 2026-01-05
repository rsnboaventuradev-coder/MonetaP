-- CORREÇÃO RÁPIDA: Execute apenas isto no Supabase SQL Editor
-- Adiciona a coluna 'icon' que está faltando

ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '🎯';

-- Verificar se foi adicionada
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'goals' AND column_name = 'icon';
