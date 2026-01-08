-- DANGEROUS: TRUNCATE ALL DATA (KEEP STRUCTURE)
-- Usage: Run this in Supabase SQL Editor to reset the environment for V1.0 launch.

BEGIN;

    -- 1. Truncate User Content Tables (Cascade to children)
    TRUNCATE TABLE 
        transactions, 
        goals, 
        credit_cards, 
        accounts, 
        partners
    CASCADE;

    -- 2. Reset Profiles (Optional: If we want to force re-onboarding)
    -- We will keep the profile but reset the flags to force "Onboarding" flow again?
    -- Or just delete usage data.
    
    -- Let's just reset the "onboarding_completed" flag so users see the new flow if they exist.
    UPDATE profiles 
    SET 
        onboarding_completed = false,
        onboarding_step = 'identity',
        onboarding_data = '{}'::jsonb;

    -- 3. Categories (System) - DO NOT DELETE
    -- We assume categories are system-managed or seeded. 
    -- If users created custom categories, we might want to delete only those.
    -- DELETE FROM categories WHERE is_system = false; 

    -- For now, let's keep all categories to avoid breaking things.

COMMIT;
