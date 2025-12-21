import { supabase, SupabaseService } from './supabase.service.js';
import { SyncService } from './sync.service.js';
import { StoreService } from './store.service.js';
import { Observable } from '../utils/observer.js';

const CACHE_KEY_TRANSACTIONS = 'moneta_transactions_cache';

export const TransactionService = {
    store: new Observable([]),

    get transactions() {
        return this.store.value;
    },

    set transactions(val) {
        this.store.value = val;
    },

    async init() {
        const cached = StoreService.get(CACHE_KEY_TRANSACTIONS);
        this.store.value = Array.isArray(cached) ? cached : [];

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

    async getRecurringDefinitions() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('recurring_transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('active', true)
            .order('day_of_month', { ascending: true });

        if (error) {
            console.error('Error fetching recurring:', error);
            return [];
        }
        return data;
    },

    async getRecurringTotal() {
        const rules = await this.getRecurringDefinitions();
        return rules.reduce((acc, rule) => acc + Number(rule.amount), 0);
    },

    subscribe(listener) {
        return this.store.subscribe(listener);
    },

    notifyListeners() {
        this.store.notify();
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

        // Convert Amount to Cents (Integer)
        // Check if amount is float string "10.50" or number 10.50
        let amountInCents = 0;
        if (transaction.amount !== undefined) {
            // If we suspect input is "10.50" (Float) -> 1050
            amountInCents = Math.round(parseFloat(transaction.amount) * 100);
        }

        const newTx = {
            id: crypto.randomUUID(),
            ...transaction,
            amount: amountInCents, // Store as Cents
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

    async createInstallments(data) {
        const { installmentsCount, ...transaction } = data;
        const totalAmount = parseFloat(transaction.amount); // float
        const installmentValue = totalAmount / installmentsCount;

        // Handle cents rounding manually to avoid "losing" cents
        // Example: 100 / 3 = 33.333... -> 33.33 * 3 = 99.99 (miss 1 cent)
        // Better: work with CENTS.
        const totalCents = Math.round(totalAmount * 100);
        const installmentCents = Math.floor(totalCents / installmentsCount);
        const remainderCents = totalCents % installmentsCount;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        const baseDate = new Date(transaction.date);
        // Note: transaction.date is "YYYY-MM-DD" string or Date object?
        // Wallet module sends "YYYY-MM-DD" from input.
        // baseDate will be in UTC or Local? "2025-12-21" -> UTC midnight usually if new Date("2025-12-21").
        // We just need to increment months.

        // We will create N promises to run in parallel or sequential?
        // Sequential is safer for order, parallel is faster.
        // Since we add to array `unshift`, sequential might keep order better (reverse loop?)
        // Let's just create them.

        const promises = [];

        for (let i = 0; i < installmentsCount; i++) {
            // Calculate Amount for this installment
            // Add remainder to the first installment (or last). Usually first is better for immediate payment.
            let currentAmountCents = installmentCents;
            if (i === 0) {
                currentAmountCents += remainderCents;
            }

            // Calculate Date
            const date = new Date(baseDate);
            date.setMonth(baseDate.getMonth() + i);

            // Handle edge case: Jan 31 + 1 month -> Feb 28/29 (Javascript handles this automatically by rolling over to Mar usually? No, setMonth tries to stay on day but rolls over if not exist)
            // e.g. 31 Jan -> setMonth(1) -> 31 Feb (Does not exist) -> 3 March.
            // Usually for credit card installments, if I buy on 31st, next bill is 28th? Or stays on billing cycle?
            // For simplicity, JS default behavior is acceptable or we can stick to "Day 1" if we wanted to be strict, but keeping purchase day is better.
            // Let's trust JS `setMonth` behaviors for now as standard "Next Month" logic.

            const currentAmountFloat = currentAmountCents / 100;

            const newTx = {
                ...transaction,
                description: `${transaction.description} (${i + 1}/${installmentsCount})`,
                amount: currentAmountFloat, // create() handles conversion to cents again, so create() expects FLOAT.
                date: date.toISOString(),
                status: (i === 0 && transaction.status === 'paid') ? 'paid' : 'pending' // Only first is paid? Or all? Usually installments are "Future" so pending. User can change. 
                // If I pay with Credit Card, effectively I "spent" it, but the bill comes later.
                // If I put "paid", it deducts from balance immediately.
                // Installments usually imply FUTURE payments.
                // Let's set first as 'paid' if the user said so (default 'paid'), others as 'pending'?
                // Or if it IS a credit card purchase, maybe it's "paid" regarding the store, but simple expense tracking...
                // Let's keep the status passed by user (usually 'paid') for ALL if user marked as paid?
                // No, future installments are by definition NOT paid yet (cash flow wise).
                // Let's set i=0 as passed status, i>0 as 'pending' (scheduled).
            };

            // Force pending for future
            if (i > 0) newTx.status = 'pending';

            promises.push(this.create(newTx));
        }

        await Promise.all(promises);
    },

    async update(id, updates) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index === -1) return;

        const dbUpdates = { ...updates };
        if (updates.amount !== undefined) {
            dbUpdates.amount = Math.round(parseFloat(updates.amount) * 100);
        }

        const updatedTx = { ...this.transactions[index], ...dbUpdates, updated_at: new Date().toISOString() };
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
            // Amount is now CENTS in DB/State
            const amount = parseInt(tx.amount || 0);
            return tx.type === 'income' ? acc + amount : acc - amount;
        }, 0);
    },

    /**
     * Get transactions with filtering logic (used by WalletModule)
     */
    async getTransactions(filters = {}) {
        let transactions = this.transactions;

        // Ensure we have data (if called before init finished)
        if (transactions.length === 0 && navigator.onLine) {
            await this.fetchAll();
            transactions = this.transactions;
        }

        const { startDate, endDate, type, limit } = filters;

        if (startDate) {
            const start = new Date(startDate);
            transactions = transactions.filter(t => new Date(t.date) >= start);
        }

        if (endDate) {
            const end = new Date(endDate);
            transactions = transactions.filter(t => new Date(t.date) <= end);
        }

        if (type) {
            transactions = transactions.filter(t => t.type === type);
        }

        // Pagination/Limit
        if (limit) {
            transactions = transactions.slice(0, limit);
        }

        return transactions;
    },

    /**
     * Get categories (fetched from DB or cache)
     */
    async getCategories() {
        const CACHE_KEY_CATS = 'moneta_categories_cache';
        let categories = StoreService.get(CACHE_KEY_CATS);

        if (!categories || categories.length === 0) {
            const { data } = await supabase
                .from('categories')
                .select('*')
                .order('name');

            if (data) {
                categories = data;
                StoreService.set(CACHE_KEY_CATS, categories);
            } else {
                categories = [];
            }
        }
        return categories;
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
            // Amount is CENTS
            const val = parseInt(tx.amount || 0);
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
