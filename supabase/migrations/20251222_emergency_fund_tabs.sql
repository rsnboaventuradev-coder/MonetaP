-- ========================================
-- EMERGENCY FUND + TAB VISIBILITY
-- ========================================

-- 1. Adicionar campo is_emergency_fund em accounts
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS is_emergency_fund BOOLEAN DEFAULT false;

-- 2. Adicionar campos em user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS emergency_fund_months INTEGER DEFAULT 6;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS hidden_tabs JSONB DEFAULT '[]'::jsonb;

-- 3. Verificação
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'accounts' AND column_name = 'is_emergency_fund'
UNION ALL
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name IN ('emergency_fund_months', 'hidden_tabs');
