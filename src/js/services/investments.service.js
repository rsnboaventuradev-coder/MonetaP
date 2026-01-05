import { SupabaseService } from './supabase.service.js';
import { SyncService } from './sync.service.js';
import { Observable } from '../utils/observer.js';

export const InvestmentsService = {
    store: new Observable([]),

    get investments() {
        return this.store.value;
    },

    set investments(val) {
        this.store.value = val;
    },

    getTotalValue() {
        return this.store.value.reduce((acc, inv) => {
            const price = inv.current_price || 0;
            const qtd = inv.quantity || 0;
            // storing as integer cents, so need to divide by 100 for display, 
            // but let's keep it consistent. If stored as 1050 (10.50), then (1050 * qtd) / 100 = value.
            return acc + ((price * qtd) / 100);
        }, 0);
    },

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
        // Load from Store/Cache?
        // this.investments = StoreService.get('investments_cache') || []; 
        if (navigator.onLine) {
            await this.fetchAll();
        }
    },

    subscribe(listener) {
        return this.store.subscribe(listener);
    },

    notifyListeners() {
        this.store.notify();
    },

    async fetchAll() {
        const { data: { session } } = await SupabaseService.client.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data, error } = await SupabaseService.client
            .from('investments')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            this.investments = data;
            this.notifyListeners();
        }
    },

    async create(investment) {
        // Get current user safely
        const { data: { session }, error: authError } = await SupabaseService.client.auth.getSession();
        const user = session?.user;
        if (authError || !user) throw new Error('User not authenticated');

        // Prepare data: Map only valid DB columns to avoid "column not found" errors
        const dbData = {
            user_id: user.id,
            name: investment.name,
            ticker: investment.ticker,
            type: investment.type,
            quantity: investment.quantity !== undefined ? parseFloat(investment.quantity) || 0 : 0,
            sector: investment.sector || null,
            // Fixed income / Treasure specific
            issuer: investment.issuer || null,
            indexer: investment.indexer || null,
            rate: investment.rate !== undefined ? parseFloat(investment.rate) || null : null,
            maturity_date: investment.maturity_date || null,
            // NEW: Fixed income complete fields
            principal_amount: investment.principal_amount !== undefined ? Math.round(parseFloat(investment.principal_amount) * 100) : null,
            application_date: investment.application_date || null,
            liquidity: investment.liquidity || null,
            entity_context: investment.entity_context || 'personal',
            is_emergency_fund: investment.is_emergency_fund === true || investment.is_emergency_fund === 'on',
            // Stock / FII specific  
            dividend_yield: investment.dividend_yield !== undefined ? parseFloat(investment.dividend_yield) || null : null,
            p_vp: investment.p_vp !== undefined ? parseFloat(investment.p_vp) || null : null,
        };

        // Convert monetary values to Cents (Integer)
        if (investment.average_price !== undefined) {
            dbData.average_price = Math.round(parseFloat(investment.average_price) * 100);
        } else {
            dbData.average_price = 0;
        }
        if (investment.current_price !== undefined) {
            dbData.current_price = Math.round(parseFloat(investment.current_price) * 100);
        } else {
            dbData.current_price = 0;
        }

        const { data, error } = await SupabaseService.client
            .from('investments')
            .insert([dbData])
            .select()
            .single();

        if (error) {
            if (!navigator.onLine) {
                SyncService.addToQueue('create_investment', dbData);
                this.investments.unshift({ ...dbData, id: 'temp-' + Date.now() });
                this.notifyListeners();
                return;
            }
            throw error;
        }

        this.investments.unshift(data);
        this.notifyListeners();
        return data;
    },

    async update(id, updates) {
        // Prepare data: Convert monetary values to Cents
        const dbUpdates = { ...updates };

        if (updates.average_price !== undefined) {
            dbUpdates.average_price = Math.round(updates.average_price * 100);
        }
        if (updates.current_price !== undefined) {
            dbUpdates.current_price = Math.round(updates.current_price * 100);
        }

        const { data, error } = await SupabaseService.client
            .from('investments')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        const index = this.investments.findIndex(i => i.id === id);
        if (index !== -1) {
            this.investments[index] = data;
            this.notifyListeners();
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
        this.notifyListeners();
    },

    // --- Helpers & Financial Logic (Operating in CENTS) ---

    // Returns Total Equity in CENTS
    calculateTotalEquity() {
        return this.investments.reduce((acc, curr) => {
            const priceInCents = curr.current_price || 0;
            // Quantity typically float. Result -> Cents.
            return acc + (curr.quantity * priceInCents);
        }, 0);
    },

    // Returns Total Invested in CENTS
    calculateTotalInvested() {
        return this.investments.reduce((acc, curr) => {
            const avgPriceInCents = curr.average_price || 0;
            return acc + (curr.quantity * avgPriceInCents);
        }, 0);
    },

    // Returns Profit/Loss in CENTS
    getProfitLoss() {
        const current = this.calculateTotalEquity(); // Cents
        const invested = this.calculateTotalInvested(); // Cents
        return current - invested;
    },

    // Returns Estimated Monthly Income in CENTS
    calculateProjectedMonthlyIncome() {
        let monthlyIncome = 0; // Cents
        // Constants for Estimation (Annual %)
        const RATES = { 'CDI': 12.15, 'SELIC': 12.25, 'IPCA': 4.50 };

        this.investments.forEach(asset => {
            const priceInCents = asset.current_price || 0;
            const totalValueCents = asset.quantity * priceInCents; // Cents

            if (asset.type === 'fii' && asset.dividend_yield) {
                // DY is Annual %. e.g. 10 means 10%
                monthlyIncome += (totalValueCents * (asset.dividend_yield / 100)) / 12;
            }
            else if (asset.type === 'stock' && asset.dividend_yield) {
                monthlyIncome += (totalValueCents * (asset.dividend_yield / 100)) / 12;
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
                monthlyIncome += (totalValueCents * (estimatedAnnualRate / 100)) / 12;
            }
        });
        return Math.round(monthlyIncome); // Return integer cents
    },

    // --- Advanced Indices ---

    calculateARCA() {
        // Values in CENTS
        const arca = { a: 0, r: 0, c: 0, alt: 0 };
        const totalEquity = this.calculateTotalEquity(); // Cents

        if (totalEquity > 0) {
            this.investments.forEach(inv => {
                const priceInCents = inv.current_price || 0;
                const val = inv.quantity * priceInCents; // Cents

                if (inv.type === 'stock') arca.a += val;
                else if (inv.type === 'fii') arca.r += val;
                else if (['fixed_income', 'treasure'].includes(inv.type)) arca.c += val;
                else if (inv.type === 'crypto') arca.alt += val;
            });
        }

        return {
            values: arca, // Cents
            percentages: {
                a: totalEquity > 0 ? (arca.a / totalEquity) * 100 : 0,
                r: totalEquity > 0 ? (arca.r / totalEquity) * 100 : 0,
                c: totalEquity > 0 ? (arca.c / totalEquity) * 100 : 0,
                alt: totalEquity > 0 ? (arca.alt / totalEquity) * 100 : 0
            }
        };
    },

    calculateGIF(avgCostOfLivingCents) {
        if (!avgCostOfLivingCents || avgCostOfLivingCents <= 0) return 0;
        const projectedIncomeCents = this.calculateProjectedMonthlyIncome();
        // (IncomeCents / CostCents) * 100 -> Ratio matches
        return (projectedIncomeCents / avgCostOfLivingCents) * 100;
    },

    calculatePNIF(avgCostOfLivingCents) {
        if (!avgCostOfLivingCents || avgCostOfLivingCents <= 0) return { target: 0, progress: 0 };
        const pnifTotalCents = avgCostOfLivingCents * 300; // Rule of 300
        const totalEquityCents = this.calculateTotalEquity();
        return {
            target: pnifTotalCents,
            progress: pnifTotalCents > 0 ? (totalEquityCents / pnifTotalCents) * 100 : 0
        };
    },

    calculateEvolutionProjection() {
        const currentEquity = this.calculateTotalEquity() / 100; // Use Float for projection loop clarity
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

        // Return Data in Real (Float) for Chart consumption, or Cents?
        // Charts usually expect float values. Keeping as Float for View Layer.
        return { labels: ['Hoje', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], dataMy, dataCDI, dataIbov };
    }
};


