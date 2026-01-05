-- Migration: Add is_emergency_fund column to investments table
-- Date: 2024-12-24

-- Allow marking fixed income investments as part of emergency fund
ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS is_emergency_fund BOOLEAN DEFAULT FALSE;

-- Add index for efficient filtering of emergency fund investments
CREATE INDEX IF NOT EXISTS idx_investments_emergency_fund ON public.investments(is_emergency_fund) WHERE is_emergency_fund = true;

-- Notify the schema cache to refresh
NOTIFY pgrst, 'reload schema';
