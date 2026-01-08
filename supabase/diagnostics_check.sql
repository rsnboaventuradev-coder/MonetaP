-- ============================================================================
-- SCRIPT DE DIAGNÓSTICO DE INTEGRIDADE - MONETAP (V2)
-- ============================================================================
-- Este script NÃO altera dados. Ele apenas verifica a estrutura e consistência.
-- Execute no Editor SQL do Supabase e analise os resultados (JSON).

BEGIN;

-- 1. Verificação de Estrutura de Tabelas Críticas
WITH table_checks AS (
    SELECT
        table_name,
        array_agg(column_name::text) as columns_found
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name IN ('transactions', 'accounts', 'credit_cards', 'recurring_transactions', 'investments', 'goals')
    GROUP BY table_name
)
SELECT
    json_build_object(
        'section', 'structure_check',
        'tables_found', (SELECT count(*) FROM table_checks),
        'details', (SELECT json_agg(row_to_json(table_checks)) FROM table_checks)
    ) as report;

-- 2. Verificação de Consistência de Tipos Monetários (Busca por colunas que deveriam ser inteiros/centavos)
-- Esperamos que 'amount', 'balance', 'limit_amount' sejam integer ou bigint.
SELECT
    json_build_object(
        'section', 'currency_type_check',
        'details', json_agg(
            json_build_object(
                'table', table_name,
                'column', column_name,
                'type', data_type
            )
        )
    ) as report
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('amount', 'balance', 'current_balance', 'initial_balance', 'limit_amount', 'target_amount')
AND data_type NOT IN ('integer', 'bigint');

-- 3. Verificação de Integridade de Dados (Orfãos e Inconsistências Lógicas)
WITH transaction_orphans AS (
    SELECT count(*) as count FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.account_id IS NOT NULL AND a.id IS NULL
),
category_orphans AS (
    SELECT count(*) as count FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.category_id IS NOT NULL AND c.id IS NULL
),
negative_credit_limits AS (
    SELECT count(*) as count FROM credit_cards WHERE limit_amount < 0
)
SELECT
    json_build_object(
        'section', 'data_integrity',
        'transactions_without_valid_account', (SELECT count FROM transaction_orphans),
        'transactions_without_valid_category', (SELECT count FROM category_orphans),
        'credit_cards_with_negative_limit', (SELECT count FROM negative_credit_limits)
    ) as report;

ROLLBACK; -- Garante que nada seja salvo, apenas consultado.
