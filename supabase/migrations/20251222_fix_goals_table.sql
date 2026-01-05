-- Ensure goals table has all required columns
-- This is safe to run multiple times

-- Add columns if they don't exist (from goals_budget.sql migration)
ALTER TABLE public.goals 
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('security', 'career', 'lifestyle', 'financial_freedom')),
ADD COLUMN IF NOT EXISTS maintenance_cost BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_link TEXT;

-- Ensure other columns exist (in case table was created manually)
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS target_amount BIGINT,
ADD COLUMN IF NOT EXISTS current_amount BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS deadline DATE,
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure RLS is enabled
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Recreate policies (safe because of DROP IF EXISTS)
DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON public.goals;

CREATE POLICY "Users can view own goals" ON public.goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON public.goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON public.goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON public.goals
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_deadline ON public.goals(deadline);
