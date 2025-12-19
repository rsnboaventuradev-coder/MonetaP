-- Add new columns to goals table
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('security', 'career', 'lifestyle', 'financial_freedom')),
ADD COLUMN IF NOT EXISTS maintenance_cost DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_link TEXT;

-- Create budget_allocations table
CREATE TABLE IF NOT EXISTS public.budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('financial_freedom', 'fixed_costs', 'comfort', 'goals', 'pleasures', 'knowledge')),
    percentage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category)
);

-- Enable RLS for budget_allocations
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

-- Policies for budget_allocations
CREATE POLICY "Users can view own budget allocations" ON public.budget_allocations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget allocations" ON public.budget_allocations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget allocations" ON public.budget_allocations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget allocations" ON public.budget_allocations
    FOR DELETE USING (auth.uid() = user_id);
