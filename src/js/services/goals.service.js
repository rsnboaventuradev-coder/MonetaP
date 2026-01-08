import { SupabaseService } from './supabase.service.js';

export const GoalsService = {
    goals: [],

    /**
     * Initialize service
     */
    async init() {
        try {
            this.goals = await this.getAll();
            return this.goals;
        } catch (error) {
            console.error('Failed to initialize goals:', error);
            this.goals = []; // Fallback
            return [];
        }
    },

    /**
     * Get all goals with smart calculation (monthly_contribution_needed)
     */
    async getAll() {
        try {
            const { data, error } = await SupabaseService.client.functions.invoke('goals', {
                method: 'GET'
            });

            if (error) {
                console.warn('Edge Function returned error, trying fallback to direct DB query:', error);
                throw error; // Trigger catch to use fallback logic if implemented in init, or let UI handle empty.
                // Actually, for robustness, if Edge Function fails, maybe we should just fetch from DB directly without "smart fields"?
                // Let's implement a fallback here to fetch from DB so UI doesn't break completely.
            }
            return data || [];
        } catch (error) {
            console.error('Error fetching goals via Edge Function:', error);
            // Fallback: Fetch basic goals from DB
            try {
                const { data: dbData, error: dbError } = await SupabaseService.client
                    .from('goals')
                    .select('*');
                if (dbError) throw dbError;
                return dbData || [];
            } catch (fallbackError) {
                console.error('Fallback DB fetch failed:', fallbackError);
                return [];
            }
        }
    },

    /**
     * Create a new goal
     */
    async create(goalData) {
        try {
            const { data, error } = await SupabaseService.client
                .from('goals')
                .insert([goalData])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating goal:', error);
            throw error;
        }
    },

    /**
     * Update a goal
     */
    async update(id, updates) {
        try {
            const { data, error } = await SupabaseService.client
                .from('goals')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating goal:', error);
            throw error;
        }
    },

    /**
     * Safe Contribution (Conversa com Saldo/Transações)
     * @param {string} goalId 
     * @param {number} amount (in cents)
     * @param {string} description 
     */
    async contribute(goalId, amount, description) {
        try {
            const { data, error } = await SupabaseService.client.functions.invoke('goals?action=contribute', {
                method: 'POST',
                body: { goal_id: goalId, amount, description }
            });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error contributing to goal:', error);
            throw error;
        }
    },

    /**
     * Delete a goal
     */
    async delete(id) {
        try {
            const { error } = await SupabaseService.client
                .from('goals')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting goal:', error);
            throw error;
        }
    },

    /**
     * Subscribe to changes
     */
    subscribe(callback) {
        const channel = SupabaseService.client
            .channel('public:goals')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, callback)
            .subscribe();

        // Return a cleanup function as expected by the Dashboard
        return () => {
            SupabaseService.client.removeChannel(channel);
        };
    },

    /**
     * PJ Budget Stubs (required by App/Dashboard)
     */
    getPJBudget() {
        return {
            revenues: [],
            expenses: { fixed_costs: [], taxes: [], personnel: [] }
        };
    },

    calculatePJDRE() {
        return { expenses: 0, profit: 0, margin: 0 };
    },

    async createPJBudgetTemplate() {
        return 0; // Stub
    }
};
