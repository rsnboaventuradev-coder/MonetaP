import { supabase } from './supabase.service.js';
import { TransactionService } from './transaction.service.js';
import { GoalsService } from './goals.service.js';
import { InvestmentsService } from './investments.service.js';

export const EvolutionService = {
    STAGES: {
        SECURITY: 'security', // Foco: Reserva de Emergência
        ACCUMULATION: 'accumulation', // Foco: Construção de Patrimônio (ARCA)
        FREEDOM: 'freedom' // Foco: Viver de Renda / Otimização
    },

    /**
     * Calculates the current user stage based on financial data
     * @param {object} profile User profile with onboarding data
     * @returns {string} Calculated Stage
     */
    calculateStage(profile) {
        if (!profile) return this.STAGES.SECURITY;

        // 1. Check Security Stage
        // User needs to have completed their Emergency Fund goal OR have enough liquidity
        const liquidityAmount = this.calculateLiquidity();
        const costOfLiving = this.calculateAvgCostOfLiving();
        const monthsSecured = costOfLiving > 0 ? liquidityAmount / costOfLiving : 0;

        const targetMonths = profile.emergency_fund_target_months || 6;
        const hasEmergencyFund = monthsSecured >= targetMonths;

        if (!hasEmergencyFund) return this.STAGES.SECURITY;

        // 2. Check Accumulation Stage
        // Arbitrary threshold: If they have > 500k invested or > 50x cost of living, maybe Freedom?
        // For simplicity, let's treat Freedom as a manually set goal or very high net worth.
        // Let's stick to Security -> Accumulation transition for now.

        return this.STAGES.ACCUMULATION;
    },

    /**
     * Get suggestions based on current stage and data
     */
    getSuggestions(profile, stage) {
        const suggestions = [];

        if (stage === this.STAGES.SECURITY) {
            const liquidity = this.calculateLiquidity();
            const costOfLiving = this.calculateAvgCostOfLiving();
            const target = (costOfLiving * (profile.emergency_fund_target_months || 6));
            const missing = target - liquidity;

            suggestions.push({
                title: 'Reserva de Emergência',
                desc: `Você tem ${monthsSecured(liquidity, costOfLiving).toFixed(1)} meses garantidos. A meta é ${(profile.emergency_fund_target_months || 6)}.`,
                action: 'Definir Meta de Reserva',
                route: 'goals'
            });

            if (missing > 0) {
                suggestions.push({
                    title: 'Foco Total em Poupar',
                    desc: 'Corte gastos supérfluos até atingir sua segurança.',
                    type: 'alert'
                });
            }
        }

        if (stage === this.STAGES.ACCUMULATION) {
            const equity = InvestmentsService.calculateTotalEquity();
            if (equity === 0) {
                suggestions.push({
                    title: 'Comece a Investir',
                    desc: 'Sua reserva está ok. Hora de multiplicar.',
                    action: 'Ver Investimentos',
                    route: 'investments'
                });
            } else {
                suggestions.push({
                    title: 'Diversifique (ARCA)',
                    desc: 'Mantenha o equilíbrio entre Real Estate, Caixa, Ações e Intern.',
                    action: 'Ver Alocação',
                    route: 'investments'
                });
            }
        }

        return suggestions;
    },

    calculateLiquidity() {
        // Sum of 'fixed_income' with 'liquidity' tag or manual check (simplified for now: accounts balance + investments marked as liquidity)
        // For now, let's use Total Net Worth from Accounts + 'treasure' type investments (approximating liquidity)
        const accountsBalance = 0; // TODO: Fetch from accounts service if implemented
        const investmentsLiquidity = InvestmentsService.investments
            .filter(i => i.type === 'treasure' || i.type === 'fixed_income') // Approximating
            .reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);

        return investmentsLiquidity;
    },

    calculateAvgCostOfLiving() {
        const transactions = TransactionService.transactions;
        if (!transactions || transactions.length === 0) return 2000; // Default fallback

        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);

        const recentExpenses = transactions.filter(t =>
            (t.type === 'expense' || t.amount < 0) &&
            new Date(t.date) >= threeMonthsAgo
        );

        if (recentExpenses.length === 0) return 2000;

        const total = recentExpenses.reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
        return total / 3;
    }
};

function monthsSecured(liquidity, cost) {
    if (cost === 0) return 0;
    return liquidity / cost;
}


