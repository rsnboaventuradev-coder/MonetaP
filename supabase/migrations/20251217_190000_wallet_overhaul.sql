-- Create partners table
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#10B981',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for partners
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own partners" ON public.partners
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own partners" ON public.partners
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own partners" ON public.partners
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own partners" ON public.partners
    FOR DELETE USING (auth.uid() = user_id);

-- Add new columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS context TEXT CHECK (context IN ('personal', 'business')) DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('paid', 'pending')) DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS classification TEXT CHECK (classification IN ('fixed_operational', 'production_variable', 'outsourced')),
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Create index for faster querying by context and partner
CREATE INDEX IF NOT EXISTS idx_transactions_context ON public.transactions(context);
CREATE INDEX IF NOT EXISTS idx_transactions_partner_id ON public.transactions(partner_id);
