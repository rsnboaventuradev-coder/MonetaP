-- Migration: Add Required Business (PJ) Categories for all users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Loop through all users in profiles to ensure they get the categories
    FOR user_record IN SELECT id FROM profiles LOOP
        
        -- 1. Equipe e Terceirizados
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Equipe e Terceirizados' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Equipe e Terceirizados', 'EXPENSE', 'business', 'users', true);
        END IF;

        -- 2. Insumos e Materiais
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Insumos e Materiais' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Insumos e Materiais', 'EXPENSE', 'business', 'box', true);
        END IF;

        -- 3. Lucro e Reservas
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Lucro e Reservas' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Lucro e Reservas', 'EXPENSE', 'business', 'pie-chart', true);
        END IF;

        -- 4. Custos Operacionais
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Custos Operacionais' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Custos Operacionais', 'EXPENSE', 'business', 'settings', true);
        END IF;

        -- 5. Impostos e Taxas
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Impostos e Taxas' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Impostos e Taxas', 'EXPENSE', 'business', 'file-text', true);
        END IF;

    END LOOP;
END $$;
