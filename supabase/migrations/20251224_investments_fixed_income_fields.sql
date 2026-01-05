-- Migration: Add complete fixed income fields to investments table
-- Date: 2024-12-24

-- New fields for Fixed Income investments
ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS principal_amount BIGINT, -- Value applied in cents
ADD COLUMN IF NOT EXISTS application_date DATE, -- Date of the investment
ADD COLUMN IF NOT EXISTS liquidity TEXT, -- 'daily', 'maturity', 'd30'
ADD COLUMN IF NOT EXISTS entity_context TEXT DEFAULT 'personal'; -- 'personal' or 'business'

-- Add index for entity_context for filtering by PJ/PF
CREATE INDEX IF NOT EXISTS idx_investments_entity_context ON public.investments(entity_context);

-- Notify the schema cache to refresh
NOTIFY pgrst, 'reload schema';
