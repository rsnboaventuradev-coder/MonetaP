-- Create asset_analysis table
CREATE TABLE IF NOT EXISTS asset_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    investment_id UUID REFERENCES investments(id) ON DELETE CASCADE NOT NULL,
    
    -- 10 Cerrado Criteria (0-5)
    profitability INTEGER CHECK (profitability BETWEEN 0 AND 5),
    perenniality INTEGER CHECK (perenniality BETWEEN 0 AND 5),
    management INTEGER CHECK (management BETWEEN 0 AND 5),
    debt INTEGER CHECK (debt BETWEEN 0 AND 5),
    moat INTEGER CHECK (moat BETWEEN 0 AND 5),
    roe INTEGER CHECK (roe BETWEEN 0 AND 5),
    cash_flow INTEGER CHECK (cash_flow BETWEEN 0 AND 5),
    dividends INTEGER CHECK (dividends BETWEEN 0 AND 5),
    governance INTEGER CHECK (governance BETWEEN 0 AND 5),
    valuation INTEGER CHECK (valuation BETWEEN 0 AND 5),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, investment_id)
);

-- Enable RLS
ALTER TABLE asset_analysis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own asset analysis" ON asset_analysis
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own asset analysis" ON asset_analysis
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own asset analysis" ON asset_analysis
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own asset analysis" ON asset_analysis
    FOR DELETE USING (auth.uid() = user_id);
