-- Add context column to budget_allocations table
ALTER TABLE public.budget_allocations
ADD COLUMN IF NOT EXISTS context TEXT CHECK (context IN ('personal', 'business')) DEFAULT 'personal';

-- Update existing records to default to 'personal'
UPDATE public.budget_allocations SET context = 'personal' WHERE context IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_budget_allocations_context ON public.budget_allocations(context);

-- Drop old unique constraint if it exists (user_id + category)
ALTER TABLE public.budget_allocations DROP CONSTRAINT IF EXISTS budget_allocations_user_id_category_key;

-- Add new unique constraint (user_id + category + context)
ALTER TABLE public.budget_allocations 
ADD CONSTRAINT budget_allocations_user_id_category_context_key UNIQUE (user_id, category, context);

-- Insert default PJ allocations
-- This will be handled by the application code on init, but we define the schema here.
