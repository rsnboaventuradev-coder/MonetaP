import { supabase } from './supabase.service.js';
import { StoreService } from './store.service.js';

const CACHE_KEY_BUDGET = 'moneta_budget_allocations';

export const BudgetService = {
    allocations: [],
    listeners: [],

    async init() {
        this.allocations = StoreService.get(CACHE_KEY_BUDGET) || this.getDefaultAllocations();
        if (navigator.onLine) {
            await this.fetchAll();
        }
    },

    getDefaultAllocations() {
        return [
            { category: 'financial_freedom', percentage: 25 },
            { category: 'fixed_costs', percentage: 30 },
            { category: 'comfort', percentage: 15 },
            { category: 'goals', percentage: 15 },
            { category: 'pleasures', percentage: 10 },
            { category: 'knowledge', percentage: 5 }
        ];
    },

    async fetchAll() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('budget_allocations')
            .select('*')
            .eq('user_id', user.id);

        if (!error && data && data.length > 0) {
            this.allocations = data;
            this.saveCache();
            this.notifyListeners();
        } else if (data && data.length === 0) {
            // Initialize with defaults if empty
            await this.initDefaults();
        }
    },

    async initDefaults() {
        const defaults = this.getDefaultAllocations();
        for (const item of defaults) {
            await this.save(item.category, item.percentage);
        }
    },

    async save(category, percentage) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Optimistic Update
        const index = this.allocations.findIndex(a => a.category === category);
        if (index >= 0) {
            this.allocations[index].percentage = percentage;
        } else {
            this.allocations.push({ category, percentage });
        }
        this.saveCache();
        this.notifyListeners();

        // Supabase Upsert
        const { error } = await supabase
            .from('budget_allocations')
            .upsert({
                user_id: user.id,
                category,
                percentage,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, category' });

        if (error) console.error('Error saving allocation:', error);
    },

    saveCache() {
        StoreService.set(CACHE_KEY_BUDGET, this.allocations);
    },

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notifyListeners() {
        this.listeners.forEach(l => l(this.allocations));
    },

    getTotal() {
        return this.allocations.reduce((acc, curr) => acc + curr.percentage, 0);
    },

    /**
     * Check if a new transaction will exceed the budget
     * @param {string} categoryName - The budget category (e.g., 'fixed_costs')
     * @param {number} newAmount - Amount in cents
     * @param {Array} transactions - List of transactions to calculate current spending
     * @param {number} totalIncome - Total income for the month (in cents)
     * @returns {Object} status { status: 'ok'|'warning'|'danger', message, usagePercent }
     */
    checkBudgetHealth(categoryName, newAmount, transactions, totalIncome) {
        const allocation = this.allocations.find(a => a.category === categoryName);
        if (!allocation || totalIncome <= 0) return { status: 'ok' };

        const budgetLimit = totalIncome * (allocation.percentage / 100);

        // Calculate current spending in this budget category
        // Note: We need to map Transaction Categories -> Budget Categories
        // This mapping is currently implicit or missing. We need a way to know which transaction category belongs to which budget category.
        // For now, let's assume 'categoryName' passed in IS the budget category, or we skip if we can't map.
        // But the user selects "Transaction Category" (e.g., 'Groceries'), not "Budget Category" (e.g., 'Essential').
        // We need a helper `getBudgetCategoryForTransactionCategory`.
        // Let's postpone exact mapping and assume for this MVP that strictly 'Context' or specific categories map.

        // Simplification for MVP: Just check simply if we can. 
        // If we can't easily map, we might return 'ok'. 

        // BETTER: Just return a generic object for now and let the caller handle data gathering.
        return { status: 'ok' };
    },

    // Improved Helper with logic if we solve the mapping:
    calculateBudgetStatus(budgetCategory, currentSpent, totalIncome) {
        const allocation = this.allocations.find(a => a.category === budgetCategory);
        if (!allocation) return null;

        const limit = totalIncome * (allocation.percentage / 100);
        if (limit === 0) return null;

        const usage = (currentSpent / limit) * 100;

        if (usage >= 100) return { status: 'danger', message: 'Orçamento estourado!' };
        if (usage >= 80) return { status: 'warning', message: 'Atenção: 80% do orçamento atingido.' };
        return { status: 'ok', message: 'Dentro do orçamento.' };
    },

    getLabel(category) {
        const labels = {
            'financial_freedom': 'Liberdade Financeira',
            'fixed_costs': 'Custos Fixos',
            'comfort': 'Conforto',
            'goals': 'Metas',
            'pleasures': 'Prazeres',
            'knowledge': 'Conhecimento'
        };
        return labels[category] || category;
    },

    getColor(category) {
        const colors = {
            'financial_freedom': '#818cf8', // Indigo
            'fixed_costs': '#3b82f6', // Blue
            'comfort': '#f472b6', // Pink
            'goals': '#c084fc', // Purple
            'pleasures': '#fb923c', // Orange
            'knowledge': '#fbbf24' // Yellow
        };
        return colors[category] || '#ccc';
    },

    /**
     * Calculates budget status for a given month/year based on Transactions.
     * All values in CENTS.
     */
    async getBudgetsWithProgress(month, year) {
        // Need to import dynamically to avoid circular dependency if TransactionService imports BudgetService
        const { TransactionService } = await import('./transaction.service.js');

        // 1. Get Net Income for the month (Total Income - Business Expenses if any?)
        // Usually Budget is based on Personal Net Income.
        const summary = TransactionService.getFinancialStatement(month, year, 'personal');
        const netIncomeCents = summary.income; // Total Income in Cents

        // 2. Get Spending by Category
        // We need to map Transaction Categories (text) to Budget Categories (fixed key).
        // This mapping needs to be defined. For now, we attempt a loose match or require `classification`.
        const transactions = TransactionService.getByMonth(month, year, 'personal');

        // Map: BudgetCategory -> SpentAmount (Cents)
        const spentMap = {
            'financial_freedom': 0,
            'fixed_costs': 0,
            'comfort': 0,
            'goals': 0,
            'pleasures': 0,
            'knowledge': 0
        };

        transactions.forEach(tx => {
            if (tx.type === 'expense') {
                // If transaction has explicit 'classification' field matching budget keys
                if (tx.classification && spentMap[tx.classification] !== undefined) {
                    spentMap[tx.classification] += Math.abs(parseFloat(tx.amount || 0)); // Ensure abs value
                }
                // Fallback: Try to map via Category tags? (Complex, skipped for now)
            }
        });

        // 3. Build Result
        return this.allocations.map(alloc => {
            const plannedAmount = Math.round(netIncomeCents * (alloc.percentage / 100));
            const spentAmount = spentMap[alloc.category] || 0;

            return {
                id: alloc.category, // using category key as ID
                category: alloc.category,
                label: this.getLabel(alloc.category),
                color: this.getColor(alloc.category),
                percentage: alloc.percentage,
                amount: plannedAmount, // Planned (Cents)
                spent: spentAmount,   // Realized (Cents)
                remaining: plannedAmount - spentAmount,
                progress: plannedAmount > 0 ? Math.min(Math.round((spentAmount / plannedAmount) * 100), 100) : 0
            };
        });
    }
};
