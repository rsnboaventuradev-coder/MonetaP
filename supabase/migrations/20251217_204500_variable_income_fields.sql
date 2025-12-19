-- Add Variable Income specific columns
ALTER TABLE investments 
ADD COLUMN IF NOT EXISTS sector TEXT, -- Setor (ex: Bancário, Logística, Tecnologia)
ADD COLUMN IF NOT EXISTS dividend_yield NUMERIC, -- DY Anual Estimado (%)
ADD COLUMN IF NOT EXISTS p_vp NUMERIC; -- Preço sobre Valor Patrimonial (Indicador de Preço)
