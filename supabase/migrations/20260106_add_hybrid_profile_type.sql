-- Remove the old constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_type_check;

-- Add the new constraint allowing 'Hybrid'
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_type_check
CHECK (type IN ('PF', 'PJ', 'Hybrid'));
