import { supabase } from './supabase.service.js';
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', user.id)
            .order('deadline', { ascending: true });

        if (!error && data) {
            this.goals = data;
            this.saveCache();
            this.notifyListeners();
        }
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        const newGoal = {
            id: crypto.randomUUID(),
            ...goal,
            user_id: user.id,
            current_amount: parseFloat(goal.current_amount || 0),
            target_amount: parseFloat(goal.target_amount),
            priority: goal.priority || 'medium',
            type: goal.type || 'lifestyle',
            maintenance_cost: parseFloat(goal.maintenance_cost || 0),
            investment_link: goal.investment_link || '',
            created_at: new Date().toISOString()
        };

        this.goals.push(newGoal);
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

    async addContribution(id, amount) {
        const goal = this.goals.find(g => g.id === id);
        if (!goal) return;

        const newAmount = (goal.current_amount || 0) + parseFloat(amount);
        await this.update(id, { current_amount: newAmount });
    }
};
