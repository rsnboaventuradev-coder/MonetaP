import { TransactionService } from './transaction.service.js';
import { BudgetService } from './budget.service.js';
import { SupabaseService } from './supabase.service.js';

/**
 * Serviço de Análise Financeira.
 * Realiza cálculos de saúde financeira e conformidade de orçamento.
 * Opera exclusivamente com centavos (inteiros).
 */
export const AnalysisService = {
    /**
     * Gera um resumo da saúde financeira do mês.
     */
    async getFinancialHealth(month, year) {
        try {
            const summary = await TransactionService.getSummary(month, year);

            // Taxa de poupança calculada com inteiros
            // (Receitas - Despesas) / Receitas
            const savings = summary.totalIncomes - summary.totalExpenses;
            const savingsRate = summary.totalIncomes > 0
                ? (savings / summary.totalIncomes) * 100
                : 0;

            return {
                ...summary,
                savingsInCents: savings,
                savingsRate: parseFloat(savingsRate.toFixed(2)),
                status: this._determineStatus(savingsRate)
            };
        } catch (error) {
            console.error('Erro na análise de saúde financeira:', error.message);
            throw error;
        }
    },

    /**
     * Analisa o cumprimento dos orçamentos por categoria.
     */
    async getBudgetAnalysis(month, year) {
        try {
            const budgets = await BudgetService.getBudgetsWithProgress(month, year);

            const totalPlanned = budgets.reduce((acc, b) => acc + b.amount, 0);
            const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);

            return {
                categories: budgets,
                totalPlanned, // em centavos
                totalSpent,   // em centavos
                globalPercentage: totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0
            };
        } catch (error) {
            console.error('Erro na análise de orçamento:', error.message);
            throw error;
        }
    },

    /**
     * Determina o status financeiro com base na taxa de poupança.
     * @private
     */
    _determineStatus(rate) {
        if (rate >= 20) return { label: 'Excelente', color: 'text-green-500' };
        if (rate >= 10) return { label: 'Bom', color: 'text-blue-500' };
        if (rate > 0) return { label: 'Atenção', color: 'text-yellow-500' };
        return { label: 'Crítico', color: 'text-red-500' };
    },

    /**
     * Recupera a análise qualitativa (Diagrama do Cerrado) de um ativo específico.
     * @param {string} investmentId UUID do investimento
     * @returns {Promise<Object>} Dados da análise ou null se não houver
     */
    async getAnalysis(investmentId) {
        try {
            const { data: { session } } = await SupabaseService.client.auth.getSession();
            if (!session) return null;

            const { data, error } = await SupabaseService.client
                .from('asset_analysis')
                .select('*')
                .eq('investment_id', investmentId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
                console.error('Erro ao recuparar análise do ativo:', error.message);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Exception no getAnalysis:', error);
            throw error;
        }
    },

    /**
     * Salva (Insere ou Atualiza) a análise qualitativa de um ativo.
     * @param {string} investmentId UUID do ativo
     * @param {Object} scores Objeto com os 10 critérios
     */
    async saveAnalysis(investmentId, scores) {
        try {
            const { data: { session } } = await SupabaseService.client.auth.getSession();
            if (!session) throw new Error('Usuário não autenticado.');

            // Verifica se a análise já existe para fazer Upsert/Update seguro (dependendo da PK/Unique)
            const { data: existing } = await SupabaseService.client
                .from('asset_analysis')
                .select('id')
                .eq('investment_id', investmentId)
                .single();

            const payload = {
                user_id: session.user.id,
                investment_id: investmentId,
                profitability: scores.profitability,
                perenniality: scores.perenniality,
                management: scores.management,
                debt: scores.debt,
                moat: scores.moat,
                roe: scores.roe,
                cash_flow: scores.cash_flow,
                dividends: scores.dividends,
                governance: scores.governance,
                valuation: scores.valuation,
                updated_at: new Date().toISOString()
            };

            let result;
            if (existing && existing.id) {
                // Update
                result = await SupabaseService.client
                    .from('asset_analysis')
                    .update(payload)
                    .eq('id', existing.id);
            } else {
                // Insert
                result = await SupabaseService.client
                    .from('asset_analysis')
                    .insert([payload]);
            }

            if (result.error) throw result.error;
            return true;
        } catch (error) {
            console.error('Erro ao salvar análise do ativo:', error.message);
            throw error;
        }
    }
};

