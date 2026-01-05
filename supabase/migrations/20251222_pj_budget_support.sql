-- Add PJ Budget support to goals table
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS budget_type TEXT CHECK (budget_type IN ('personal', 'business', 'savings')) DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS category_type TEXT CHECK (category_type IN ('revenue', 'expense')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_progressive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_goals_budget_type ON public.goals(budget_type);
CREATE INDEX IF NOT EXISTS idx_goals_category_type ON public.goals(category_type);

-- Insert PJ Budget Templates (Revenue)
INSERT INTO public.goals (
    user_id,
    title,
    target_amount,
    current_amount,
    budget_type,
    category_type,
    subcategory,
    is_progressive,
    type,
    icon,
    priority
) VALUES
-- This is a template, will be created per user on first access
-- For now, we'll handle this via the application layer
-- Keeping this migration for schema only

COMMENT ON COLUMN public.goals.budget_type IS 'Type of budget: personal (PF), business (PJ), or savings';
COMMENT ON COLUMN public.goals.category_type IS 'For budget goals: revenue or expense';
COMMENT ON COLUMN public.goals.is_progressive IS 'If true, allows gradual monthly filling (e.g., service revenue accumulation)';
COMMENT ON COLUMN public.goals.subcategory IS 'Subcategory for business budgets (e.g., fixed_costs, taxes, personnel)';
