ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS risk_profile TEXT,
ADD COLUMN IF NOT EXISTS emergency_fund_target_months INTEGER DEFAULT 6;

-- Optional: Add check constraint for risk_profile if desired
-- ALTER TABLE public.profiles ADD CONSTRAINT check_risk_profile CHECK (risk_profile IN ('low', 'medium', 'high'));
