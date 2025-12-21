-- Migration: Convert financial columns to Cents (Integer logic)
-- This migration multiplies existing values by 100 to switch from Float to Integer representation.

BEGIN;

-- 1. Transactions
UPDATE transactions 
SET amount = amount * 100 
WHERE amount IS NOT NULL;

-- 2. Investments
UPDATE investments 
SET 
    average_price = average_price * 100,
    current_price = current_price * 100
    -- Note: quantity remains as is (can be fractional for crypto)
WHERE 
    average_price IS NOT NULL OR 
    current_price IS NOT NULL;

-- 3. Goals
UPDATE goals 
SET 
    current_amount = current_amount * 100,
    target_amount = target_amount * 100,
    maintenance_cost = maintenance_cost * 100
WHERE 
    current_amount IS NOT NULL OR 
    target_amount IS NOT NULL OR
    maintenance_cost IS NOT NULL;

-- 4. Recurring Transactions
UPDATE recurring_transactions 
SET amount = amount * 100 
WHERE amount IS NOT NULL;

-- 5. Profiles (Pro-Labore, etc)
UPDATE profiles 
SET 
    pro_labore_amount = pro_labore_amount * 100,
    cost_of_living = cost_of_living * 100,
    emergency_fund_target = emergency_fund_target * 100
WHERE 
    pro_labore_amount IS NOT NULL OR
    cost_of_living IS NOT NULL OR
    emergency_fund_target IS NOT NULL;

COMMIT;
