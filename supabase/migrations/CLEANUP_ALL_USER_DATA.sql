-- ================================================================
-- SCRIPT DE LIMPEZA COMPLETA DE DADOS DE USUÁRIOS
-- EXECUTE NO SUPABASE SQL EDITOR
-- 
-- ATENÇÃO: Isso apagará TODOS os dados do banco!
-- Use apenas em ambiente de desenvolvimento/teste.
-- ================================================================

-- Desabilitar verificações de chave estrangeira temporariamente
SET session_replication_role = 'replica';

-- 1. Apagar transações
DELETE FROM transactions;

-- 2. Apagar transações recorrentes
DELETE FROM recurring_transactions;

-- 3. Apagar metas/goals
DELETE FROM goals;

-- 4. Apagar contribuições de metas
DELETE FROM goal_contributions;

-- 5. Apagar contas
DELETE FROM accounts;

-- 6. Apagar orçamentos
DELETE FROM budgets;

-- 7. Apagar categorias customizadas (mantém as padrão do sistema se existirem)
DELETE FROM categories WHERE user_id IS NOT NULL;

-- 8. Apagar análises de investimentos
DELETE FROM investment_analysis;

-- 9. Apagar investimentos
DELETE FROM investments;

-- 10. Apagar perfis (profiles)
DELETE FROM profiles;

-- 11. Apagar usuários da tabela auth.users (requer privilégios de admin)
-- NOTA: Isso precisa ser feito via Dashboard do Supabase em Authentication > Users
-- Ou via API Admin com service_role key

-- Reabilitar verificações de chave estrangeira
SET session_replication_role = 'origin';

-- Confirmar limpeza
SELECT 
    (SELECT COUNT(*) FROM transactions) as transactions,
    (SELECT COUNT(*) FROM profiles) as profiles,
    (SELECT COUNT(*) FROM accounts) as accounts,
    (SELECT COUNT(*) FROM goals) as goals;
