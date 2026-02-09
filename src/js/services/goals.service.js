import { SupabaseService } from './supabase.service.js';

export const GoalsService = {
    goals: [],

    /**
     * Initialize service
     */
    async init() {
        try {
            this.goals = await this.getAll();

            // Self-Healing: Check if Emergency Fund is complete but Investments is locked
            setTimeout(() => this.checkEmergencyFundUnlock(), 2000);

            return this.goals;
        } catch (error) {
            console.error('Failed to initialize goals:', error);
            this.goals = []; // Fallback
            return [];
        }
    },

    /**
     * Self-healing: Unlock investments if Emergency Fund is complete
     */
    async checkEmergencyFundUnlock() {
        try {
            const emergencyGoal = this.goals.find(g =>
                (g.name.toLowerCase().includes('reserva') || g.type === 'security') &&
                g.status === 'completed'
            );

            if (emergencyGoal) {
                const { data: { user } } = await SupabaseService.client.auth.getUser();
                if (!user) return;

                const { data: profile } = await SupabaseService.client
                    .from('user_profiles')
                    .select('hidden_tabs')
                    .eq('user_id', user.id)
                    .single();

                if (profile && profile.hidden_tabs && profile.hidden_tabs.includes('investments')) {
                    console.log('🔄 Self-Healing: Unlocking Investments (Goal Found & Completed)');
                    const newHidden = profile.hidden_tabs.filter(t => t !== 'investments');

                    await SupabaseService.client
                        .from('user_profiles')
                        .update({ hidden_tabs: newHidden })
                        .eq('user_id', user.id);

                    // Force refresh if app is loaded
                    if (window.app) {
                        window.app.renderNavigation();
                    }
                }
            }
        } catch (err) {
            console.error('Self-healing check failed:', err);
        }
    },

    /**
     * Get all goals with smart calculation (monthly_contribution_needed)
     */
    async getAll() {
        try {
            // DIRECT DB FETCH (Skipping Edge Function to avoid 404s)
            const { data: goals, error } = await SupabaseService.client
                .from('goals')
                .select('*')
                .order('deadline', { ascending: true });

            if (error) throw error;

            // Client-side calculation of monthly_contribution_needed
            // Logic mirrored from existing Edge Function
            const goalsWithCalc = (goals || []).map(g => {
                let monthly_needed = 0;
                if (g.deadline && g.status === 'active' && g.target_amount > g.current_amount) {
                    const today = new Date();
                    const deadline = new Date(g.deadline);

                    // Simple month diff
                    const months = (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth());
                    const remaining = g.target_amount - g.current_amount;

                    if (months > 0) {
                        monthly_needed = remaining / months;
                    } else {
                        monthly_needed = remaining; // Due now/passed
                    }
                }
                return { ...g, monthly_contribution_needed: Math.round(monthly_needed) };
            });

            return goalsWithCalc;
        } catch (error) {
            console.error('Error fetching goals:', error);
            return [];
        }
    },

    /**
     * Create a new goal
     */
    async create(goalData) {
        try {
            const { data: { user } } = await SupabaseService.client.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await SupabaseService.client
                .from('goals')
                .insert([{ ...goalData, user_id: user.id }])
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

    // --- Helpers for System Goals ---
    calculateEmergencyFundTarget() {
        try {
            if (window.app?.InvestmentsModule?.userProfile) {
                const p = window.app.InvestmentsModule.userProfile;
                const months = p.emergency_fund_target_months || 6;
                const col = p.cost_of_living || 2000;
                return col * months * 100; // in cents
            }
        } catch (e) { console.warn('GoalsService: Could not calc target', e); }
        return 1200000; // default 12k
    },

    calculateTotalLiquidity() {
        try {
            if (window.app?.InvestmentsModule?.userProfile) {
                if (window.EvolutionService) {
                    return window.EvolutionService.calculateLiquidity(window.app.InvestmentsModule.userProfile) * 100;
                }
                return (window.app.InvestmentsModule.userProfile.total_liquidity || 0) * 100;
            }
        } catch (e) { }
        return 0;
    },

    /**
     * Create default emergency goal if confirmed by user via button
     */
    async createDefaultEmergencyGoal() {
        const target = this.calculateEmergencyFundTarget();
        const current = this.calculateTotalLiquidity();

        return await this.create({
            name: 'Reserva de Emergência',
            type: 'security',
            target_amount: target,
            current_amount: current, // Snapshot current liquidity
            status: 'active', // Will be active until validated
            deadline: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        });
    },

    /**
     * Safe Contribution (Conversa com Saldo/Transações)
     * @param {string} goalId 
     * @param {number} amount (in cents)
     * @param {string} description 
     */
    async contribute(goalId, amount, description) {
        try {
            // --- Intercept System Goal ---
            if (goalId === 'system_emergency_fund') {
                console.log('🛡️ Creating Real Emergency Fund Goal from System Goal...');
                const newGoal = await this.createDefaultEmergencyGoal();
                if (!newGoal) throw new Error('Failed to create system goal');
                goalId = newGoal.id; // Swap ID for the real one
            }

            // 1. Get Goal to verify ownership and status
            const { data: goal, error: goalError } = await SupabaseService.client
                .from('goals')
                .select('*')
                .eq('id', goalId)
                .single();

            if (goalError || !goal) throw new Error('Goal not found');
            if (goal.status !== 'active') throw new Error('Goal is not active');

            const { data: { user } } = await SupabaseService.client.auth.getUser();

            // 2. Fetch a valid Category
            const { data: category } = await SupabaseService.client
                .from('categories')
                .select('id')
                .eq('type', 'expense')
                .limit(1)
                .maybeSingle();

            // 3. Create Transaction
            const { error: txError } = await SupabaseService.client
                .from('transactions')
                .insert({
                    user_id: user.id,
                    amount: amount,
                    description: description || `Aporte: ${goal.name}`,
                    type: 'expense',
                    category_id: category?.id || null,
                    date: new Date().toISOString(),
                    is_paid: true
                });

            if (txError) throw txError;

            // 4. Update Goal
            const newAmount = goal.current_amount + amount;

            // Check if achieved (>= target)
            let newStatus = goal.status;
            if (newAmount >= goal.target_amount && goal.status === 'active') {
                newStatus = 'completed';
            }

            const { data, error } = await SupabaseService.client
                .from('goals')
                .update({
                    current_amount: newAmount,
                    status: newStatus
                })
                .eq('id', goalId)
                .select()
                .single();

            if (error) throw error;

            // 5. [HOOK] Check for Emergency Fund Completion to Unlock Investments
            if (newStatus === 'completed') {
                const isEmergencyFund = goal.name.toLowerCase().includes('reserva') || goal.type === 'security';
                if (isEmergencyFund) {
                    this.unlockInvestments(goal); // Delegate to unlock helper
                }
            }

            return data;

        } catch (error) {
            console.error('Contribution failed:', error);
            throw error;
        }
    },
    /**
     * Helper to unlock investments tab
     */
    async unlockInvestments(goal) {
        console.log('🎉 Emergency Fund Completed! Unlocking Investments...');
        try {
            const { data: { user } } = await SupabaseService.client.auth.getUser();
            if (!user) return;

            // 1. Fetch current profile
            const { data: profile } = await SupabaseService.client
                .from('user_profiles')
                .select('hidden_tabs')
                .eq('user_id', user.id)
                .single();

            if (profile && profile.hidden_tabs && profile.hidden_tabs.includes('investments')) {
                const newHidden = profile.hidden_tabs.filter(t => t !== 'investments');

                // 2. Update profile
                await SupabaseService.client
                    .from('user_profiles')
                    .update({ hidden_tabs: newHidden })
                    .eq('user_id', user.id);

                console.log('🔓 Investments unlocked!');

                // Notify UI to refresh navigation if possible
                if (window.app) {
                    setTimeout(() => window.app.renderNavigation(), 1000);
                }
            }
        } catch (err) {
            console.error('Error unlocking investments:', err);
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
