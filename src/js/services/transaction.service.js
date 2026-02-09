import { supabase, SupabaseService } from './supabase.service.js';
import { SyncService } from './sync.service.js';
import { StoreService } from './store.service.js';
import { Observable } from '../utils/observer.js';
import { MoneyHelper } from '../utils/money.js';

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
        const session = await SupabaseService.getSession();
        const user = session?.user;
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

        // Convert pro_labore_amount from reais to centavos for comparison
        // profile.pro_labore_amount is stored as reais (e.g., 3500.00)
        // tx.amount is stored as centavos (e.g., 350000)
        const proLaboreAmountCents = MoneyHelper.toCents(profile.pro_labore_amount);

        // 2. Check if transactions exist for this month
        // We look for a VERY specific pattern: matching amount, context, and description for this month
        const proLaboreTx = this.transactions.find(tx => {
            const txDate = new Date(tx.date);
            return txDate.getMonth() === month &&
                txDate.getFullYear() === year &&
                parseInt(tx.amount) === proLaboreAmountCents &&
                (
                    (tx.context === 'business' && tx.type === 'expense' && tx.description === 'Pró-Labore (Saída PJ)') ||
                    (tx.context === 'personal' && tx.type === 'income' && tx.description === 'Pró-Labore (Entrada PF)')
                );
        });

        if (proLaboreTx) return; // Already exists

        // 3. Create Transactions
        console.log('Generating Pró-Labore Transactions...');

        // Note: this.create() expects amount in REAIS (it converts to centavos internally)
        // So we pass the original pro_labore_amount

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
        const session = await SupabaseService.getSession();
        const user = session?.user;
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
                    amount: rule.amount, // Amount from DB is Cents
                    amountIsCents: true, // IMPORTANT: Tell create that this is already cents
                    type: rule.type,
                    date: new Date(currentYear, currentMonth, rule.day_of_month).toISOString(),
                    category_id: rule.category,
                    user_id: user.id,
                    context: 'personal', // Default or add context to recurring table? Assuming personal for now.
                    status: 'pending', // Generated transactions are pending? Or paid? Logic says "Upcoming" -> pending.
                    recurring_origin_id: rule.id
                });

                // Update last_generated
                await supabase
                    .from('recurring_transactions')
                    .update({ last_generated: new Date().toISOString() })
                    .eq('id', rule.id);
            }
        }
    },

    async fetchAll() {
        try {
            const session = await SupabaseService.getSession();
            const user = session?.user;
            if (!user) return;

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (error) throw error;

            if (data) {
                this.transactions = data;
                this.saveCache();
                this.notifyListeners();
            }
        } catch (error) {
            console.error('TransactionService fetchAll Error:', error);
            // We do not throw here to allow app to continue with cached/empty data
        }
    },

    saveCache() {
        StoreService.set(CACHE_KEY_TRANSACTIONS, this.transactions);
    },

    async getRecurringDefinitions() {
        const session = await SupabaseService.getSession();
        const user = session?.user;
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
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not logged in');

        // Standardize Amount to Cents (Integer)
        // Input `transaction.amount` might be "10.50" (Reais string), 10.50 (Reais float), or 1050 (Cents integer already?)
        // HINT: The UI usually sends "10.50" (raw value from unmaskToFloat).
        // WE WILL USE MoneyHelper.toCents() which assumes input is REAIS if it looks floating/string.
        let amountInCents = 0;
        if (transaction.amount !== undefined) {
            // Case: Logic might pass '1050' (cents) directly?
            // If we are unsure, we assume the Service Contract is: "Inputs are REAIS (float/string) unless specified".
            // However, recurring transactions pass `rule.amount` which is cents from DB.
            // Problem: `MoneyHelper.toCents(1050)` -> 105000 (Incorrect!)

            // FIX: We need a reliable way. 
            // 1. If logic calling `create` is internal (like recursing), it sends Cents.
            // 2. If logic is UI, it sends Reais.

            // To be safe: checks magnitude? No, risky.
            // Decision: `create` accepts REAIS by default (backward compat). 
            // Callers that have Cents must convert or we allow a flag.

            // Wait, manual fix: Recurring logic (lines 106+) gets `rule.amount` from DB (BIGINT/Cents).
            // It calls `this.create`. If `create` blindly multiplies by 100, we break it.
            // Strategy: Check if `rule.amount` is explicitly handled. 

            // UPDATED STRATEGY: `create` expects REAIS. 
            // Recurring/Internal callers MUST convert to Reais before calling OR we add `amountIsCents: true`.

            if (transaction.amountIsCents) {
                amountInCents = parseInt(transaction.amount);
            } else {
                amountInCents = MoneyHelper.toCents(transaction.amount);
            }
        }

        const newTx = {
            id: crypto.randomUUID(),
            type: transaction.type,
            description: transaction.description,
            amount: amountInCents, // Store as Cents
            date: transaction.date || new Date().toISOString(),
            category_id: transaction.categoryId || transaction.category_id || null, // Map camelCase to snake_case
            account_id: transaction.account_id || null,
            user_id: user.id,
            context: transaction.context || 'personal', // 'personal' or 'business'
            partner_id: transaction.partner_id || null,
            status: transaction.status || 'paid', // 'paid' or 'pending'
            payment_method: transaction.payment_method || 'money',
            classification: transaction.classification || null, // 'fixed_operational', etc.
            attachment_url: transaction.attachment_url || null,
            created_at: new Date().toISOString()
        };

        this.transactions.unshift(newTx);
        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('transactions', 'INSERT', newTx);
        return newTx;
    },

    async createInstallments(transaction) {
        const { installmentsCount, installmentDay } = transaction;
        const totalAmountCents = MoneyHelper.toCents(transaction.amount);

        const installmentCents = Math.floor(totalAmountCents / installmentsCount);
        const remainderCents = totalAmountCents % installmentsCount;

        const session = await SupabaseService.getSession();
        const user = session?.user;
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
            // Calculate Amount
            let currentAmountCents = installmentCents;
            if (i === 0) currentAmountCents += remainderCents;

            // Calculate Date
            let date;
            if (i === 0) {
                date = new Date(baseDate);
            } else {
                // Future months: Start from 1st to avoid overflow (e.g. Jan 31 -> Feb 28)
                const year = baseDate.getFullYear();
                const month = baseDate.getMonth();
                date = new Date(year, month + i, 1);

                // Determine target day (User preference OR original day)
                const targetDay = installmentDay || baseDate.getDate();

                // Clamp to last day of target month
                const lastDayOfMonth = new Date(year, month + i + 1, 0).getDate();
                date.setDate(Math.min(targetDay, lastDayOfMonth));
            }

            const newTx = {
                ...transaction,
                description: `${transaction.description} (${i + 1}/${installmentsCount})`,
                amount: currentAmountCents,
                amountIsCents: true,
                date: date.toISOString(),
                status: (i === 0 && transaction.status === 'paid') ? 'paid' : 'pending'
            };

            // Clean props
            delete newTx.installmentsCount;
            delete newTx.installmentDay;

            // Future installments are always pending
            if (i > 0) newTx.status = 'pending';

            promises.push(this.create(newTx));
        }

        await Promise.all(promises);
    },

    async createRecurring(transaction) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not logged in');

        // Prepare data for recurring_transactions table
        // Amount should be stored as CENTS (BigInt)
        const amountInCents = MoneyHelper.toCents(transaction.amount);

        const newRule = {
            user_id: user.id,
            description: transaction.description,
            amount: amountInCents,
            day_of_month: transaction.day_of_month || 1,
            type: transaction.type, // 'income' or 'expense'
            category: transaction.categoryId || transaction.category_id || null,
            active: true,
            context: transaction.context || 'personal',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('recurring_transactions')
            .insert([newRule])
            .select()
            .single();

        if (error) throw error;

        // Optionally trigger check immediately to generate for this month if applicable
        await this.checkRecurringTransactions();

        return data;
    },

    async update(id, updates) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index === -1) return;

        const dbUpdates = { ...updates };
        if (updates.amount !== undefined) {
            if (updates.amountIsCents) {
                dbUpdates.amount = parseInt(updates.amount);
            } else {
                dbUpdates.amount = MoneyHelper.toCents(updates.amount);
            }
        }
        // Map categoryId to category_id for Supabase
        if (updates.categoryId !== undefined) {
            dbUpdates.category_id = updates.categoryId;
            delete dbUpdates.categoryId;
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
            try {
                const { data, error } = await supabase
                    .from('categories')
                    .select('*')
                    .order('name');

                if (error) throw error;

                if (data) {
                    categories = data;
                    StoreService.set(CACHE_KEY_CATS, categories);
                } else {
                    categories = [];
                }
            } catch (error) {
                console.error('TransactionService getCategories Error:', error);
                return []; // Return empty array on error
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


