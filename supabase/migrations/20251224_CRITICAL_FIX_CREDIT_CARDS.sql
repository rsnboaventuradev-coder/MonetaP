-- CRITICAL FIX FOR CREDIT CARDS
-- Run this ENTIRE file in the Supabase SQL Editor

-- 1. Drop tables if they exist (to ensure fresh structure)
DROP TABLE IF EXISTS public.credit_card_purchases CASCADE;
DROP TABLE IF EXISTS public.credit_cards CASCADE;

-- 2. Create Credit Cards Table
CREATE TABLE public.credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bank TEXT,
    last_digits TEXT,
    billing_day INTEGER NOT NULL CHECK (billing_day BETWEEN 1 AND 31),
    credit_limit BIGINT,
    current_invoice BIGINT DEFAULT 0,
    context TEXT DEFAULT 'personal',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Purchases Table
CREATE TABLE public.credit_card_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount BIGINT NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    installments INTEGER DEFAULT 1,
    current_installment INTEGER DEFAULT 1,
    category UUID,
    billing_month DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_purchases ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies
CREATE POLICY "Users can manage their own cards" 
ON public.credit_cards 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own purchases" 
ON public.credit_card_purchases 
FOR ALL 
USING (auth.uid() = user_id);

-- 6. Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
