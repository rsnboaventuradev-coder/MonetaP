-- Add Onboarding Fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_financial_moment TEXT CHECK (current_financial_moment IN ('debt', 'breaking_even', 'saving', 'optimizing')),
ADD COLUMN IF NOT EXISTS main_financial_goal TEXT CHECK (main_financial_goal IN ('exit_debt', 'emergency_fund', 'investing', 'control')),
ADD COLUMN IF NOT EXISTS knowledge_level TEXT CHECK (knowledge_level IN ('beginner', 'intermediate', 'advanced'));
