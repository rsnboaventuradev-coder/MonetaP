import { supabase } from './supabase.service.js';
import { SyncService } from './sync.service.js';
import { StoreService } from './store.service.js';

const CACHE_KEY_TRANSACTIONS = 'moneta_transactions_cache';

export const TransactionService = {
    transactions: [],
    listeners: [],

    async init() {
        this.transactions = StoreService.get(CACHE_KEY_TRANSACTIONS) || [];
        if (!Array.isArray(this.transactions)) this.transactions = [];

        // Sync with Supabase (Optimistic UI first)
        if (navigator.onLine) {
            await this.fetchAll();
            await this.checkProLaboreAutomation();
            await this.checkRecurringTransactions();
        }
    },

    async checkProLaboreAutomation() {
        // 1. Fetch Profile Settings
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('pro_labore_amount,pro_labore_day')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile || !profile.pro_labore_amount || profile.pro_labore_amount <= 0) return;

        const today = new Date();
        const currentDay = today.getDate();

        // Only run if today is on or after the pro-labore day
        if (currentDay < (profile.pro_labore_day || 5)) return;

        const month = today.getMonth();
        const year = today.getFullYear();

        // 2. Check if transactions exist for this month
        // We look for a VERY specific pattern: matching amount, context, and description for this month
        const proLaboreTx = this.transactions.find(tx => {
            const txDate = new Date(tx.date);
            return txDate.getMonth() === month &&
                txDate.getFullYear() === year &&
                tx.amount == profile.pro_labore_amount &&
                (
                    (tx.context === 'business' && tx.type === 'expense' && tx.description === 'Pró-Labore (Saída PJ)') ||
                    (tx.context === 'personal' && tx.type === 'income' && tx.description === 'Pró-Labore (Entrada PF)')
                );
        });

        if (proLaboreTx) return; // Already exists

        // 3. Create Transactions
        console.log('Generating Pró-Labore Transactions...');

        // Out Business
        const outTx = {
            amount: profile.pro_labore_amount,
            description: 'Pró-Labore (Saída PJ)',
            type: 'expense',
            date: today.toISOString(),
            context: 'business',
            status: 'paid',
            category: 'pro-labore'
        };

        // In Personal
        const inTx = {
            amount: profile.pro_labore_amount,
            description: 'Pró-Labore (Entrada PF)',
            type: 'income',
            date: today.toISOString(),
            context: 'personal',
            status: 'paid',
            category: 'salary'
        };

        await this.create(outTx);
        await this.create(inTx);
    },

    async checkRecurringTransactions() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: rules } = await supabase
            .from('recurring_transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('active', true);

        if (!rules || rules.length === 0) return;

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        for (const rule of rules) {
            // Check if day matches or has passed
            if (currentDay < rule.day_of_month) continue;

            let shouldGenerate = false;

            if (!rule.last_generated) {
                shouldGenerate = true;
            } else {
                const lastGen = new Date(rule.last_generated);
                // Check if generated in previous months
                if (lastGen.getMonth() !== currentMonth || lastGen.getFullYear() !== currentYear) {
                    shouldGenerate = true;
                }
            }

            if (shouldGenerate) {
                // Determine Date: use today, or try to respect the day_of_month if passed?
                // Usually we generate 'today' with the due date.

                await this.create({
                    description: rule.description,
                    amount: rule.amount,
                    type: rule.type,
                    category: rule.category,
                    context: rule.context,
                    date: today.toISOString(),
                    status: 'pending'
                });

                await supabase
                    .from('recurring_transactions')
                    .update({ last_generated: today.toISOString() })
                    .eq('id', rule.id);
            }
        }
    },

    async fetchAll() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (!error && data) {
            this.transactions = data;
            this.saveCache();
            this.notifyListeners();
        }
    },

    saveCache() {
        StoreService.set(CACHE_KEY_TRANSACTIONS, this.transactions);
    },

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notifyListeners() {
        this.listeners.forEach(l => l(this.transactions));
    },

    /**
     * Get transactions filtered by specific month and year
     * @param {number} month 0-11
     * @param {number} year Full year like 2025
     * @param {string} context 'personal' | 'business' (optional)
     */
    getByMonth(month, year, context = null) {
        return this.transactions.filter(tx => {
            const date = new Date(tx.date);
            const matchesDate = date.getMonth() === month && date.getFullYear() === year;
            const matchesContext = context ? (tx.context === context) : true;
            return matchesDate && matchesContext;
        });
    },

    async create(transaction) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        const newTx = {
            id: crypto.randomUUID(),
            ...transaction,
            user_id: user.id,
            context: transaction.context || 'personal', // 'personal' or 'business'
            partner_id: transaction.partner_id || null,
            status: transaction.status || 'paid', // 'paid' or 'pending'
            classification: transaction.classification || null, // 'fixed_operational', etc.
            attachment_url: transaction.attachment_url || null,
            date: transaction.date || new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        this.transactions.unshift(newTx);
        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('transactions', 'INSERT', newTx);
        return newTx;
    },

    async update(id, updates) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index === -1) return;

        const updatedTx = { ...this.transactions[index], ...updates, updated_at: new Date().toISOString() };
        this.transactions[index] = updatedTx;
        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('transactions', 'UPDATE', updatedTx);
    },

    async delete(id) {
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('transactions', 'DELETE', { id });
    },

    getBalance() {
        return this.transactions.reduce((acc, tx) => {
            const amount = parseFloat(tx.amount);
            return tx.type === 'income' ? acc + amount : acc - amount;
        }, 0);
    },

    getRecent(limit = 5) {
        if (!this.transactions) return [];
        return this.transactions.slice(0, limit);
    },

    /**
     * Returns DRE-like statement for a specific month
     */
    getFinancialStatement(month, year, context = null) {
        const txs = this.getByMonth(month, year, context);
        let income = 0;
        let expense = 0;

        txs.forEach(tx => {
            const val = parseFloat(tx.amount);
            if (tx.type === 'income') income += val;
            else expense += Math.abs(val);
        });

        return {
            income,
            expense,
            profit: income - expense
        };
    },

    /**
     * Returns projected cashflow for the next 7 days
     */
    getNext7DaysFlow(context = null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const next7Days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            next7Days.push(d);
        }

        const flow = next7Days.map(date => {
            const dayStr = date.toISOString().split('T')[0];
            // Filter transactions matching this date exactly
            const dailyTxs = this.transactions.filter(tx => {
                const txDate = new Date(tx.date).toISOString().split('T')[0];
                const matchesContext = context ? (tx.context === context) : true;
                // For "flow", we might consider pending transactions or future ones?
                // Assuming 'date' is due date or effective date.
                return txDate === dayStr && matchesContext;
            });

            const income = dailyTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + parseFloat(t.amount), 0);
            const expense = dailyTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(parseFloat(t.amount)), 0);

            return {
                date: date,
                dayName: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
                income,
                expense,
                net: income - expense
            };
        });

        const totalReceivable = flow.reduce((acc, day) => acc + day.income, 0);
        const totalPayable = flow.reduce((acc, day) => acc + day.expense, 0);

        return { flow, totalReceivable, totalPayable };
    }
};
