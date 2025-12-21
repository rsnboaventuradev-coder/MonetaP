import { TransactionService } from './transaction.service.js';
import { BudgetService } from './budget.service.js';

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
    }
};