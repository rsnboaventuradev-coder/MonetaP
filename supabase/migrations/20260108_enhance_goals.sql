-- Add image_url to goals table
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Validation check for image_url (optional, but good practice)
-- ALTER TABLE public.goals ADD CONSTRAINT check_valid_url CHECK (image_url ~* '^https?://.*');
