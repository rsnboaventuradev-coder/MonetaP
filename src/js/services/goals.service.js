import { supabase, SupabaseService } from './supabase.service.js';
import { SyncService } from './sync.service.js';
import { StoreService } from './store.service.js';

const CACHE_KEY_GOALS = 'moneta_goals_cache';

export const GoalsService = {
    goals: [],
    listeners: [],

    async init() {
        this.goals = StoreService.get(CACHE_KEY_GOALS) || [];
        // Ensure it's an array
        if (!Array.isArray(this.goals)) this.goals = [];
        if (navigator.onLine) {
            await this.fetchAll();
        }
    },

    async fetchAll() {
        try {
            const session = await SupabaseService.getSession();
            const user = session?.user;
            if (!user) return;

            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                this.goals = data;
                this.saveCache();
                this.notifyListeners();
            }
        } catch (error) {
            console.error('GoalsService fetchAll Error:', error);
        }
    },

    /**
     * Create PJ Budget Template with all categories
     */
    async createPJBudgetTemplate() {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not logged in');

        const template = [
            // Revenues
            { name: 'Prestação de Serviços', target_amount: 15000, budget_type: 'business', category_type: 'revenue', subcategory: 'services', is_progressive: true, icon: '💼', priority: 'high' },
            { name: 'Venda de Produtos', target_amount: 5000, budget_type: 'business', category_type: 'revenue', subcategory: 'products', is_progressive: true, icon: '📦', priority: 'medium' },
            { name: 'Rendimentos de Aplicações PJ', target_amount: 500, budget_type: 'business', category_type: 'revenue', subcategory: 'investments', is_progressive: true, icon: '📈', priority: 'low' },

            // Fixed Costs
            { name: 'Software (SaaS)', target_amount: 500, budget_type: 'business', category_type: 'expense', subcategory: 'fixed_costs', is_progressive: false, icon: '💻', priority: 'high' },
            { name: 'Contador', target_amount: 400, budget_type: 'business', category_type: 'expense', subcategory: 'fixed_costs', is_progressive: false, icon: '📊', priority: 'high' },
            { name: 'Aluguel de Escritório', target_amount: 2000, budget_type: 'business', category_type: 'expense', subcategory: 'fixed_costs', is_progressive: false, icon: '🏢', priority: 'high' },
            { name: 'Internet/Telefone', target_amount: 300, budget_type: 'business', category_type: 'expense', subcategory: 'fixed_costs', is_progressive: false, icon: '📡', priority: 'medium' },

            // Taxes
            { name: 'DAS (Simples Nacional)', target_amount: 1200, budget_type: 'business', category_type: 'expense', subcategory: 'taxes', is_progressive: false, icon: '🏛️', priority: 'high' },
            { name: 'ISS', target_amount: 300, budget_type: 'business', category_type: 'expense', subcategory: 'taxes', is_progressive: false, icon: '📋', priority: 'medium' },
            { name: 'Taxas Bancárias', target_amount: 100, budget_type: 'business', category_type: 'expense', subcategory: 'taxes', is_progressive: false, icon: '🏦', priority: 'low' },
            { name: 'Certificado Digital', target_amount: 25, budget_type: 'business', category_type: 'expense', subcategory: 'taxes', is_progressive: false, icon: '🔐', priority: 'low' },

            // Personnel
            { name: 'Pró-labore', target_amount: 5000, budget_type: 'business', category_type: 'expense', subcategory: 'personnel', is_progressive: false, icon: '👤', priority: 'high' },
            { name: 'Benefícios', target_amount: 800, budget_type: 'business', category_type: 'expense', subcategory: 'personnel', is_progressive: false, icon: '🎁', priority: 'medium' },
            { name: 'Freelancers', target_amount: 2000, budget_type: 'business', category_type: 'expense', subcategory: 'personnel', is_progressive: true, icon: '👥', priority: 'medium' }
        ];

        const promises = template.map(item => this.create({
            ...item,
            current_amount: 0,
            type: 'financial_freedom' // Using existing type for now
        }));

        await Promise.all(promises);
        await this.fetchAll();

        return template.length;
    },

    saveCache() {
        StoreService.set(CACHE_KEY_GOALS, this.goals);
    },

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notifyListeners() {
        this.listeners.forEach(l => l(this.goals));
    },

    async create(goal) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not logged in');

        const newGoal = {
            id: crypto.randomUUID(),
            ...goal,
            name: goal.name || goal.title, // Support both name and title
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Remove title if it exists (use name instead)
        delete newGoal.title;

        this.goals.unshift(newGoal);
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('goals', 'INSERT', newGoal);
        return newGoal;
    },

    async update(id, updates) {
        const index = this.goals.findIndex(g => g.id === id);
        if (index === -1) return;

        const updatedGoal = { ...this.goals[index], ...updates };
        this.goals[index] = updatedGoal;

        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('goals', 'UPDATE', updatedGoal);
    },

    async delete(id) {
        this.goals = this.goals.filter(g => g.id !== id);
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('goals', 'DELETE', { id });
    },

    async addContribution(goalId, amount) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) throw new Error('Goal not found');

        const newAmount = parseFloat(goal.current_amount || 0) + parseFloat(amount);

        await this.update(goalId, {
            current_amount: newAmount
        });
    },

    /**
     * Get PJ Budget goals grouped by category
     */
    getPJBudget() {
        const pjGoals = this.goals.filter(g => g.budget_type === 'business');

        return {
            revenues: pjGoals.filter(g => g.category_type === 'revenue'),
            expenses: {
                fixed_costs: pjGoals.filter(g => g.category_type === 'expense' && g.subcategory === 'fixed_costs'),
                taxes: pjGoals.filter(g => g.category_type === 'expense' && g.subcategory === 'taxes'),
                personnel: pjGoals.filter(g => g.category_type === 'expense' && g.subcategory === 'personnel')
            }
        };
    },

    /**
     * Calculate PJ DRE (Demonstrativo de Resultados)
     */
    calculatePJDRE() {
        const budget = this.getPJBudget();

        const totalRevenue = budget.revenues.reduce((acc, g) => acc + parseFloat(g.current_amount || 0), 0);
        const totalExpenses = [
            ...budget.expenses.fixed_costs,
            ...budget.expenses.taxes,
            ...budget.expenses.personnel
        ].reduce((acc, g) => acc + parseFloat(g.current_amount || 0), 0);

        const profit = totalRevenue - totalExpenses;
        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

        return {
            revenue: totalRevenue,
            expenses: totalExpenses,
            profit: profit,
            margin: margin,
            fixedCostsPercentage: totalRevenue > 0 ? (budget.expenses.fixed_costs.reduce((acc, g) => acc + parseFloat(g.current_amount || 0), 0) / totalRevenue) * 100 : 0,
            taxesPercentage: totalRevenue > 0 ? (budget.expenses.taxes.reduce((acc, g) => acc + parseFloat(g.current_amount || 0), 0) / totalRevenue) * 100 : 0,
            personnelPercentage: totalRevenue > 0 ? (budget.expenses.personnel.reduce((acc, g) => acc + parseFloat(g.current_amount || 0), 0) / totalRevenue) * 100 : 0
        };
    }
};


