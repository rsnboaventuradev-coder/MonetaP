-- Create recurring_transactions table
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount BIGINT NOT NULL, -- Storing in Cents now
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    category UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    context TEXT CHECK (context IN ('personal', 'business')) DEFAULT 'personal',
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    active BOOLEAN DEFAULT TRUE,
    last_generated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own recurring transactions" ON public.recurring_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring transactions" ON public.recurring_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring transactions" ON public.recurring_transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring transactions" ON public.recurring_transactions
    FOR DELETE USING (auth.uid() = user_id);
