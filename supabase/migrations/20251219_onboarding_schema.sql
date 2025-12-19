-- Add Onboarding and Evolution fields to profiles table

DO $$
BEGIN
    -- Knowledge Level
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'knowledge_level') THEN
        ALTER TABLE profiles ADD COLUMN knowledge_level TEXT CHECK (knowledge_level IN ('beginner', 'intermediate', 'advanced'));
    END IF;

    -- Emergency Fund Target (Months)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'emergency_fund_target_months') THEN
        ALTER TABLE profiles ADD COLUMN emergency_fund_target_months INTEGER DEFAULT 6;
    END IF;

    -- Has Emergency Fund (Self-declared)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'has_emergency_fund') THEN
        ALTER TABLE profiles ADD COLUMN has_emergency_fund BOOLEAN DEFAULT FALSE;
    END IF;

    -- Expense Control Method
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'expense_control_method') THEN
        ALTER TABLE profiles ADD COLUMN expense_control_method TEXT CHECK (expense_control_method IN ('strict', 'loose', 'none'));
    END IF;

    -- Onboarding Completed Flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;

    -- Evolution Stage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'evolution_stage') THEN
        ALTER TABLE profiles ADD COLUMN evolution_stage TEXT DEFAULT 'security' CHECK (evolution_stage IN ('security', 'accumulation', 'freedom'));
    END IF;

END $$;
