-- Add Fixed Income specific columns
ALTER TABLE investments 
ADD COLUMN IF NOT EXISTS maturity_date DATE,
ADD COLUMN IF NOT EXISTS issuer TEXT, -- Emissor (ex: Banco Inter, Tesouro Nacional)
ADD COLUMN IF NOT EXISTS indexer TEXT, -- 'CDI', 'IPCA', 'PRE'
ADD COLUMN IF NOT EXISTS rate NUMERIC; -- Taxa (ex: 110 para 110% do CDI, 6.5 para IPCA+6.5%)
