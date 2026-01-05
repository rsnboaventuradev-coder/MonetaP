-- FIX: Clean duplicate rows in user_profiles table
-- This script keeps only the most recent row for each user and deletes duplicates

-- First, let's see how many duplicates exist
SELECT user_id, COUNT(*) as row_count
FROM public.user_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Delete all but the most recent row for each user
DELETE FROM public.user_profiles
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM public.user_profiles
    GROUP BY user_id
);

-- Verify cleanup
SELECT user_id, COUNT(*) as row_count
FROM public.user_profiles
GROUP BY user_id;

-- Add unique constraint on user_id to prevent future duplicates (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_user_id_key'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;
