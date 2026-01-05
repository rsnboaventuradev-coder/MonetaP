-- Migration: Add category_id and payment_method to transactions table
-- Date: 2024-12-24

-- Add category_id column to transactions table (references categories)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Add payment_method column to transactions table  
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'money';

-- Add account_id column if not exists (for account tracking)
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Create index for faster querying by category
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);

-- Create index for faster querying by account
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);

-- Notify the schema cache to refresh
NOTIFY pgrst, 'reload schema';
