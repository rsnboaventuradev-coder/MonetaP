-- Migration: Create Credit Cards System
-- Date: 2024-12-24

-- Credit Cards table - tracks user credit cards with invoice
CREATE TABLE IF NOT EXISTS public.credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,           -- "Nubank", "Inter Gold", etc
    bank TEXT,                    -- Institution name
    last_digits TEXT,             -- Last 4 digits (optional)
    billing_day INTEGER NOT NULL CHECK (billing_day BETWEEN 1 AND 31),
    credit_limit BIGINT,          -- Optional, in cents
    current_invoice BIGINT DEFAULT 0, -- Accumulated total in cents
    context TEXT CHECK (context IN ('personal', 'business')) DEFAULT 'personal',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Card Purchases - individual purchases on each card
CREATE TABLE IF NOT EXISTS public.credit_card_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount BIGINT NOT NULL,       -- In cents
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    installments INTEGER DEFAULT 1,
    current_installment INTEGER DEFAULT 1,
    category UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    billing_month DATE,           -- Which billing cycle this purchase belongs to
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_purchases ENABLE ROW LEVEL SECURITY;

-- Credit Cards Policies
CREATE POLICY "Users can view own credit cards" ON public.credit_cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit cards" ON public.credit_cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit cards" ON public.credit_cards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credit cards" ON public.credit_cards
    FOR DELETE USING (auth.uid() = user_id);

-- Credit Card Purchases Policies
CREATE POLICY "Users can view own purchases" ON public.credit_card_purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON public.credit_card_purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchases" ON public.credit_card_purchases
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchases" ON public.credit_card_purchases
    FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_card_id ON public.credit_card_purchases(card_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_billing_month ON public.credit_card_purchases(billing_month);

-- Notify schema cache to refresh
NOTIFY pgrst, 'reload schema';
