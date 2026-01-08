-- Add progress tracking for Gamified Onboarding
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_progress TEXT DEFAULT 'identity';

-- Add identity type (PF or PJ)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('PF', 'PJ'));

-- Add Financial Snapshot fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS current_balance NUMERIC DEFAULT 0;

-- Remove legacy dependents column if it exists
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS dependents;

-- Remove legacy dependent_count column if it exists (common variation)
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS dependent_count;

-- Ensure we have a place to store snapshot data individually if not covered by columns
-- The request implies updating "steps" individually.
-- "identity" -> updates type (PF/PJ)
-- "snapshot" -> updates financial numbers
-- These columns likely already exist (monthly_income, cost_of_living, etc.), verified in previous files.
