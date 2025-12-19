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
    }
};
