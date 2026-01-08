-- OPTIMIZE PRODUCTION (V1.0)

-- 1. Create Indexes for Common Filters
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

CREATE INDEX IF NOT EXISTS idx_goals_deadline ON goals(deadline);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- 2. Verify RLS (Ensuring they are enabled)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_purchases ENABLE ROW LEVEL SECURITY;

-- 3. Add comment
COMMENT ON DATABASE postgres IS 'Moneta Database - V1.0 Production Optimized';
