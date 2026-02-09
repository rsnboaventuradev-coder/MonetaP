-- Migration: Add Required Categories for all users
DO $$
DECLARE
    user_record RECORD;
    category_name text;
    cat_icon text;
BEGIN
    -- Loop through all users in profiles to ensure they get the categories
    -- Assuming public.profiles contains all active users corresponding to auth.users
    FOR user_record IN SELECT id FROM profiles LOOP
        
        -- 1. Custos Fixos
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Custos Fixos' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Custos Fixos', 'EXPENSE', 'personal', 'lock', true);
        END IF;

        -- 2. Liberdade Financeira
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Liberdade Financeira' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Liberdade Financeira', 'EXPENSE', 'personal', 'trending-up', true);
        END IF;

        -- 3. Metas
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Metas' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Metas', 'EXPENSE', 'personal', 'target', true);
        END IF;

        -- 4. Conforto
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Conforto' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Conforto', 'EXPENSE', 'personal', 'coffee', true);
        END IF;

        -- 5. Prazeres
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Prazeres' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Prazeres', 'EXPENSE', 'personal', 'smile', true);
        END IF;

        -- 6. Conhecimento
        IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id = user_record.id AND name = 'Conhecimento' AND type = 'EXPENSE') THEN
            INSERT INTO categories (user_id, name, type, context, icon, is_system)
            VALUES (user_record.id, 'Conhecimento', 'EXPENSE', 'personal', 'book', true);
        END IF;

    END LOOP;
END $$;
