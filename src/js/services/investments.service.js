import { SupabaseService } from './supabase.service.js';
import { SyncService } from './sync.service.js';

export const InvestmentsService = {
    investments: [],

    async init() {
        const { data: { session } } = await SupabaseService.client.auth.getSession();
        if (!session) return;

        await this.fetchInvestments();

        // Subscribe to changes
        SupabaseService.client
            .channel('investments-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () => {
                this.fetchInvestments(true); // Force refresh
            })
            .subscribe();
    },

    async fetchInvestments(force = false) {
        try {
            const { data, error } = await SupabaseService.client
                .from('investments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.investments = data || [];

            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('investments-updated'));
            return this.investments;
        } catch (error) {
            console.error('Error fetching investments:', error);
            return [];
        }
    },

    async create(investment) {
        // Get current user safely
        const { data: { user }, error: authError } = await SupabaseService.client.auth.getUser();
        if (authError || !user) throw new Error('User not authenticated');

        // Optimistic Update can be added here if needed, keeping it simple for now
        const { data, error } = await SupabaseService.client
            .from('investments')
            .insert([{
                ...investment,
                user_id: user.id
            }])
            .select()
            .single();

        if (error) {
            // If offline, add to Sync Queue (Implementation dependent on SyncService limits)
            if (!navigator.onLine) {
                SyncService.addToQueue('create_investment', investment);
                this.investments.unshift({ ...investment, id: 'temp-' + Date.now() });
                window.dispatchEvent(new CustomEvent('investments-updated'));
                return;
            }
            throw error;
        }

        this.investments.unshift(data);
        window.dispatchEvent(new CustomEvent('investments-updated'));
        return data;
    },

    async update(id, updates) {
        const { data, error } = await SupabaseService.client
            .from('investments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        const index = this.investments.findIndex(i => i.id === id);
        if (index !== -1) {
            this.investments[index] = data;
            window.dispatchEvent(new CustomEvent('investments-updated'));
        }
        return data;
    },

    async delete(id) {
        const { error } = await SupabaseService.client
            .from('investments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        this.investments = this.investments.filter(i => i.id !== id);
        window.dispatchEvent(new CustomEvent('investments-updated'));
    },

    // --- Helpers & Financial Logic ---

    calculateTotalEquity() {
        return this.investments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
    },

    calculateTotalInvested() {
        return this.investments.reduce((acc, curr) => acc + (curr.quantity * curr.average_price), 0);
    },

    getProfitLoss() {
        const current = this.calculateTotalEquity();
        const invested = this.calculateTotalInvested();
        return current - invested;
    },

    calculateProjectedMonthlyIncome() {
        let monthlyIncome = 0;
        // Constants for Estimation (Annual)
        const RATES = { 'CDI': 12.15, 'SELIC': 12.25, 'IPCA': 4.50 };

        this.investments.forEach(asset => {
            const totalValue = asset.quantity * (asset.current_price || 0);

            if (asset.type === 'fii' && asset.dividend_yield) {
                // Assuming DY input is Annual %. 
                monthlyIncome += (totalValue * (asset.dividend_yield / 100)) / 12;
            }
            else if (asset.type === 'stock' && asset.dividend_yield) {
                monthlyIncome += (totalValue * (asset.dividend_yield / 100)) / 12;
            }
            else if (['fixed_income', 'treasure'].includes(asset.type)) {
                let estimatedAnnualRate = 0;
                const rateVal = asset.rate || 0;
                if (asset.indexer === 'PRE') {
                    estimatedAnnualRate = rateVal;
                } else if (asset.indexer) {
                    const baseRate = RATES[asset.indexer] || 10;
                    estimatedAnnualRate = (rateVal / 100) * baseRate;
                    if (asset.indexer === 'IPCA') estimatedAnnualRate += baseRate;
                } else {
                    estimatedAnnualRate = 10;
                }
                monthlyIncome += (totalValue * (estimatedAnnualRate / 100)) / 12;
            }
        });
        return monthlyIncome;
    },

    // --- Advanced Indices ---

    calculateARCA() {
        const arca = { a: 0, r: 0, c: 0, alt: 0 };
        const totalEquity = this.calculateTotalEquity();

        if (totalEquity > 0) {
            this.investments.forEach(inv => {
                const val = inv.quantity * inv.current_price;
                if (inv.type === 'stock') arca.a += val;
                else if (inv.type === 'fii') arca.r += val;
                else if (['fixed_income', 'treasure'].includes(inv.type)) arca.c += val;
                else if (inv.type === 'crypto') arca.alt += val;
            });
        }

        return {
            values: arca,
            percentages: {
                a: totalEquity > 0 ? (arca.a / totalEquity) * 100 : 0,
                r: totalEquity > 0 ? (arca.r / totalEquity) * 100 : 0,
                c: totalEquity > 0 ? (arca.c / totalEquity) * 100 : 0,
                alt: totalEquity > 0 ? (arca.alt / totalEquity) * 100 : 0
            }
        };
    },

    calculateGIF(avgCostOfLiving) {
        if (!avgCostOfLiving || avgCostOfLiving <= 0) return 0;
        const projectedIncome = this.calculateProjectedMonthlyIncome();
        return (projectedIncome / avgCostOfLiving) * 100;
    },

    calculatePNIF(avgCostOfLiving) {
        if (!avgCostOfLiving || avgCostOfLiving <= 0) return { target: 0, progress: 0 };
        const pnifTotal = avgCostOfLiving * 300; // Rule of 300 (4% Withdrawal)
        const totalEquity = this.calculateTotalEquity();
        return {
            target: pnifTotal,
            progress: pnifTotal > 0 ? (totalEquity / pnifTotal) * 100 : 0
        };
    },

    calculateEvolutionProjection() {
        const currentEquity = this.calculateTotalEquity();
        const dataMy = [currentEquity];
        const dataCDI = [currentEquity];
        const dataIbov = [currentEquity];

        const rateMy = 1.008; // 0.8% am
        const rateCDI = 1.009; // 0.9% am
        const rateIbov = 1.011; // 1.1% am

        for (let i = 1; i <= 12; i++) {
            dataMy.push(dataMy[i - 1] * rateMy);
            dataCDI.push(dataCDI[i - 1] * rateCDI);
            dataIbov.push(dataIbov[i - 1] * rateIbov);
        }

        return { labels: ['Hoje', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], dataMy, dataCDI, dataIbov };
    }
};
