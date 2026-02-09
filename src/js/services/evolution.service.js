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

        // 1a. Explicit Goal Check (Priority)
        // 1a. Explicit Goal Check (Priority)
        const completedEmergencyGoal = GoalsService.goals.find(g =>
            (g.name.toLowerCase().includes('reserva') || g.type === 'security') &&
            (g.status === 'completed' || (g.current_amount >= g.target_amount && g.target_amount > 0))
        );

        if (completedEmergencyGoal) {
            console.log('✅ Evolution: Found Completed Emergency Goal override.', completedEmergencyGoal);
            // User explicitly completed the goal, even if calculated liquidity varies
            return this.STAGES.ACCUMULATION;
        }

        // 1b. Fallback: Calculated Liquidity Check
        const liquidityAmount = this.calculateLiquidity(profile);
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
            const liquidity = this.calculateLiquidity(profile);
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

    calculateLiquidity(profile) {
        // 1. Start with Profile Initial Balance (from Raio-X)
        let total = profile?.current_balance || 0;

        // 2. Add Accounts Balance (TODO: Fetch from accounts service if implemented properly)
        // const accountsBalance = AccountsService.getTotalBalance() / 100; 
        // total += accountsBalance;

        // 3. Add Investments with Liquidity
        const investmentsLiquidity = InvestmentsService.investments
            .filter(i => i.type === 'treasure' || i.type === 'fixed_income') // Approximating
            .reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);

        // Convert investments (cents) to units if mixed? No, service usually uses cents. 
        // Let's assume current_balance is in plain form (float) from DB based on previous files, 
        // but wait, DB mostly uses cents or float?
        // onboarding/index.ts takes body.current_balance. Usually UI sends float.
        // InvestmentsService uses cents.
        // Let's standardize on Reais (float) for this logic for now, dividing investments by 100.

        total += (investmentsLiquidity / 100);

        return total;
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


