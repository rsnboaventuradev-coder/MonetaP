-- Function to reset a test user's data for onboarding testing
CREATE OR REPLACE FUNCTION reset_test_user(target_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Find User ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', target_email;
    END IF;

    -- 2. Reset Profile Flags
    UPDATE public.profiles
    SET 
        onboarding_completed = FALSE,
        onboarding_progress = 'identity',
        step_accounts_completed = FALSE
    WHERE id = target_user_id;

    -- 3. Clear Financial Profiles
    DELETE FROM public.financial_profiles WHERE user_id = target_user_id;

    -- 4. Clear Categories (Cascade should handle sub-data if any, but explicit is safer for test logic)
    -- Only delete custom categories created by this user, assuming system categories might be shared or handled differently.
    -- If all categories are user-specific:
    DELETE FROM public.categories WHERE user_id = target_user_id;

    -- Optional: Clear transactions to ensure charts are empty? 
    -- User request implied "Apagar quaisquer categorias criadas", transactions usually depend on categories.
    -- If we delete categories, transactions might cascade delete or error. 
    -- Let's explicitly delete transactions first to be clean.
    DELETE FROM public.transactions WHERE user_id = target_user_id;
    
    -- Clear Accounts/Goals/Cards which are part of Refinement?
    -- "The reset must... Apagar quaisquer categorias criadas"
    -- It didn't explicitly say delete accounts, but valid testing usually implies fresh slate.
    -- I'll stick to the explicit user request list to avoid over-deletion, 
    -- BUT deleting categories might violate foreign keys in transactions.
    -- So clearing transactions is necessary side-effect or prerequisite.

END;
$$;
