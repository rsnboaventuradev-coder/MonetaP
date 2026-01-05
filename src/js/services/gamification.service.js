import { TransactionService } from './transaction.service.js';
import { InvestmentsService } from './investments.service.js';
import { GoalsService } from './goals.service.js';

export const GamificationService = {
    badges: [
        {
            id: 'first_investment',
            name: 'Investidor Iniciante',
            description: 'Fez o primeiro investimento.',
            icon: '🌱',
            condition: async () => {
                const investments = InvestmentsService.investments || [];
                return investments.length > 0;
            }
        },
        {
            id: 'saver_month',
            name: 'Poupador do Mês',
            description: 'Poupou mais de 20% da renda este mês.',
            icon: '🐷',
            condition: async () => {
                const date = new Date();
                const year = date.getFullYear();
                const month = date.getMonth();

                // We need financial statement from TransactionService
                // Note: TransactionService needs to be initialized/ready
                const summary = TransactionService.getFinancialStatement(month, year);
                if (summary.revenue <= 0) return false;

                const savings = summary.revenue - summary.expenses;
                const rate = (savings / summary.revenue) * 100;
                return rate >= 20;
            }
        },
        {
            id: 'goal_reached',
            name: 'Conquistador de Metas',
            description: 'Concluiu pelo menos uma meta.',
            icon: '🏆',
            condition: async () => {
                const goals = GoalsService.goals || [];
                return goals.some(g => g.current_amount >= g.target_amount || g.status === 'completed');
            }
        },
        {
            id: 'organized',
            name: 'Organizado',
            description: 'Categorizou todas as transações do mês.',
            icon: '📋',
            condition: async () => {
                const txs = TransactionService.transactions || [];
                // Check last 10 transactions for empty categories?
                if (txs.length === 0) return false;
                return txs.slice(0, 10).every(t => t.category && t.category !== 'uncategorized');
            }
        }
    ],

    async getEarnedBadges() {
        const earned = [];
        for (const badge of this.badges) {
            try {
                const isUnlocked = await badge.condition();
                if (isUnlocked) {
                    earned.push(badge);
                }
            } catch (e) {
                console.warn(`Error checking badge ${badge.id}:`, e);
            }
        }
        return earned;
    }
};


