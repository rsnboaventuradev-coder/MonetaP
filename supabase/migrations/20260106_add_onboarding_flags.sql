-- Add step_accounts_completed track to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS step_accounts_completed BOOLEAN DEFAULT FALSE;
