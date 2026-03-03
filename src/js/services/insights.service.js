import { TransactionService } from './transaction.service.js';

export const InsightsService = {
    /**
     * Analyze recent transactions and generate actionable financial tips
     * @returns {Array} Array of insight objects { id, type, title, message, icon, color }
     */
    async generateTips() {
        const tips = [];

        // Ensure transactions are loaded
        if (TransactionService.transactions.length === 0) {
            await TransactionService.init();
        }

        const txs = TransactionService.transactions;
        if (txs.length === 0) {
            tips.push({
                id: 'no-data',
                type: 'info',
                title: 'Comece a usar o Moneta',
                message: 'Adicione suas primeiras transações para receber dicas personalizadas sobre suas finanças.',
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
                color: 'blue'
            });
            return tips;
        }

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Get this month's transactions
        const thisMonthTxs = txs.filter(tx => {
            const date = new Date(tx.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        // 1. Tip: High Spending in a Single Category
        const expensesByCategory = {};
        let totalExpenses = 0;

        thisMonthTxs.forEach(tx => {
            if (tx.type === 'expense') {
                const amount = parseInt(tx.amount || 0);
                totalExpenses += amount;
                const catName = tx.category_name || 'Outros';
                expensesByCategory[catName] = (expensesByCategory[catName] || 0) + amount;
            }
        });

        if (totalExpenses > 0) {
            // Find category with highest spend
            let maxCategory = null;
            let maxAmount = 0;

            for (const [cat, amount] of Object.entries(expensesByCategory)) {
                if (amount > maxAmount) {
                    maxAmount = amount;
                    maxCategory = cat;
                }
            }

            const percentage = ((maxAmount / totalExpenses) * 100).toFixed(0);

            if (percentage >= 30 && maxCategory !== 'Outros' && maxCategory !== 'Moradia') {
                tips.push({
                    id: 'high-category-spend',
                    type: 'warning',
                    title: 'Atenção aos Gastos',
                    message: `Você já gastou ${percentage}% das suas despesas deste mês com <strong>${maxCategory}</strong>. Considere reduzir esses gastos se possível.`,
                    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />',
                    color: 'brand-gold'
                });
            }
        }

        // 2. Tip: Positive Cashflow / Saving Opportunity
        const projectedBalanceCents = TransactionService.getProjectedBalance();
        const currentBalanceCents = TransactionService.getBalance();

        // If they have more than R$ 500 sitting and are projecting to end positive
        if (currentBalanceCents > 50000 && projectedBalanceCents > 0) {
            tips.push({
                id: 'invest-opportunity',
                type: 'success',
                title: 'Oportunidade de Investimento',
                message: `Seu saldo está positivo e a projeção pro fim do mês é boa! Que tal separar uma parte para suas <strong>Metas</strong> ou <strong>Investimentos</strong>?`,
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />',
                color: 'brand-green'
            });
        }

        // 3. Tip: Many pending transactions (Organization needed)
        const pendingCount = txs.filter(tx => tx.status === 'pending').length;
        if (pendingCount > 10) {
            tips.push({
                id: 'many-pending',
                type: 'info',
                title: 'Organize suas contas',
                message: `Você tem ${pendingCount} transações pendentes. Mantenha os status atualizados para ter uma projeção de saldo mais precisa.`,
                icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />',
                color: 'brand-primary'
            });
        }

        return tips.slice(0, 2); // Return at most 2 tips so as not to overwhelm the UI
    }
};
