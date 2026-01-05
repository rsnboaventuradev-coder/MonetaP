-- Verificar se a coluna hidden_tabs existe
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'hidden_tabs';

-- Se não existir, adicionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'hidden_tabs'
    ) THEN
        ALTER TABLE public.user_profiles
        ADD COLUMN hidden_tabs JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Verificar dados atuais
SELECT user_id, hidden_tabs 
FROM public.user_profiles 
LIMIT 5;
