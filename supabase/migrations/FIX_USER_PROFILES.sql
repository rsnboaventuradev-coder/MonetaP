-- ========================================
-- FIX: Popular user_profiles e garantir hidden_tabs
-- ========================================

-- 1. Verificar se user_profiles existe para o usuário atual
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Pegar o ID do usuário atual
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NOT NULL THEN
        -- Inserir ou atualizar user_profiles
        INSERT INTO public.user_profiles (user_id, hidden_tabs)
        VALUES (current_user_id, '[]'::jsonb)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            hidden_tabs = COALESCE(user_profiles.hidden_tabs, '[]'::jsonb);
            
        RAISE NOTICE 'User profile criado/atualizado para user_id: %', current_user_id;
    ELSE
        RAISE NOTICE 'Nenhum usuário autenticado encontrado';
    END IF;
END $$;

-- 2. Verificar resultado
SELECT 
    user_id,
    hidden_tabs,
    created_at
FROM public.user_profiles
WHERE user_id = auth.uid();
