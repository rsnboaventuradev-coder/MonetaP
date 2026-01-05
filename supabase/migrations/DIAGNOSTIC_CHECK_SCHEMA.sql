-- DIAGNÓSTICO: Verificar schema atual da tabela goals
-- Execute no Supabase SQL Editor para ver o que realmente existe

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'goals'
ORDER BY ordinal_position;

-- Verificar constraints
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'goals'
ORDER BY tc.constraint_type, kcu.column_name;
