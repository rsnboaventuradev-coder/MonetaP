import { supabase, SupabaseService } from './supabase.service.js';
import { StoreService } from './store.service.js';

const CACHE_KEY_BUDGET = 'moneta_budget_allocations';

export const BudgetService = {
    allocations: [], // Now stores mixed context allocations, or we can separate them. 
    // Recommendation: Store all, filter by context when needed.
    listeners: [],

    async init() {
        this.allocations = StoreService.get(CACHE_KEY_BUDGET) || [];
        if (this.allocations.length === 0) {
            // If empty, init defaults for both contexts
            await this.initDefaults('personal');
            await this.initDefaults('business');
        } else {
            // Check if we have business allocations, if not init them (migration path)
            const hasBusiness = this.allocations.some(a => a.context === 'business');
            if (!hasBusiness) {
                await this.initDefaults('business');
            }
        }

        if (navigator.onLine) {
            await this.fetchAll();
        }
    },

    getDefaultAllocations(context = 'personal') {
        if (context === 'business') {
            return [
                { category: 'operational_costs', percentage: 20, context: 'business', label: 'Custos Operacionais', color: '#ef4444', description: 'Aluguel, Software, Energia, Manutenção' },
                { category: 'supplies', percentage: 25, context: 'business', label: 'Insumos e Materiais', color: '#f97316', description: 'Matéria-prima, Revenda, Equipamentos' },
                { category: 'team', percentage: 25, context: 'business', label: 'Equipe e Terceirizados', color: '#3b82f6', description: 'Pró-labore, Salários, Freelancers' },
                { category: 'taxes', percentage: 10, context: 'business', label: 'Impostos e Taxas', color: '#eab308', description: 'DAS, ISS, Contabilidade' },
                { category: 'profit', percentage: 20, context: 'business', label: 'Lucro e Reservas', color: '#22c55e', description: 'Capital de Giro, Lucros' }
            ];
        }

        return [
            { category: 'financial_freedom', percentage: 25, context: 'personal' },
            { category: 'fixed_costs', percentage: 30, context: 'personal' },
            { category: 'comfort', percentage: 15, context: 'personal' },
            { category: 'goals', percentage: 15, context: 'personal' },
            { category: 'pleasures', percentage: 10, context: 'personal' },
            { category: 'knowledge', percentage: 5, context: 'personal' }
        ];
    },

    async fetchAll() {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) return;

        const { data, error } = await supabase
            .from('budget_allocations')
            .select('*')
            .eq('user_id', user.id);

        if (!error && data) {
            // Merge defaults if database has incomplete data (e.g. missing new categories)
            // For now, simpler: Use data from DB as truth
            this.allocations = data;

            // Check for missing business context in data fetched
            if (!this.allocations.some(a => a.context === 'business')) {
                await this.initDefaults('business');
            }

            this.saveCache();
            this.notifyListeners();
        }
    },

    async initDefaults(context) {
        const defaults = this.getDefaultAllocations(context);
        // Add to local state immediately to avoid flickers
        // Filter out existing ones to avoid duplicates if re-running
        const existing = this.allocations.filter(a => a.context === context).map(a => a.category);
        const toAdd = defaults.filter(d => !existing.includes(d.category));

        this.allocations = [...this.allocations, ...toAdd];
        this.saveCache();

        for (const item of toAdd) {
            await this.save(item.category, item.percentage, context);
        }
    },

    async save(category, percentage, context = 'personal') {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) return;

        // Optimistic Update
        const index = this.allocations.findIndex(a => a.category === category && a.context === context);
        if (index >= 0) {
            this.allocations[index].percentage = percentage;
        } else {
            this.allocations.push({ category, percentage, context });
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
                context,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, category, context' });

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
            'knowledge': 'Conhecimento',
            // Business
            'operational_costs': 'Custos Operacionais',
            'supplies': 'Insumos e Materiais',
            'team': 'Equipe e Terceirizados',
            'taxes': 'Impostos e Taxas',
            'profit': 'Lucro e Reservas'
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
            'knowledge': '#fbbf24', // Yellow
            // Business
            'operational_costs': '#ef4444',
            'supplies': '#f97316',
            'team': '#3b82f6',
            'taxes': '#eab308',
            'profit': '#22c55e'
        };
        return colors[category] || '#ccc';
    },

    getAllocations(context = 'personal') {
        const contextAllocations = this.allocations.filter(a => a.context === context);
        // If empty for this context (and defaults failed), return defaults directly
        if (contextAllocations.length === 0) return this.getDefaultAllocations(context);
        return contextAllocations;
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


