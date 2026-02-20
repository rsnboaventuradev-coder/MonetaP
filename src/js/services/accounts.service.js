import { supabase, SupabaseService } from './supabase.service.js';
import { StoreService } from './store.service.js';
import { Money } from '../utils/money.js';

const CACHE_KEY_ACCOUNTS = 'moneta_accounts';

export const AccountsService = {
    accounts: [],
    listeners: [],

    async init() {
        this.accounts = StoreService.get(CACHE_KEY_ACCOUNTS) || [];
        if (navigator.onLine) {
            await this.fetchAll();
        }
    },

    async fetchAll() {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) return;

        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (!error && data) {
            this.accounts = data;
            this.saveCache();
            this.notifyListeners();
        }
    },

    async create(accountData) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('accounts')
            .insert({
                ...accountData,
                user_id: user.id,
                current_balance: accountData.initial_balance // Already in cents from CurrencyMask.unmask()
            })
            .select()
            .single();

        if (error) throw error;

        this.accounts.push(data);
        this.saveCache();
        this.notifyListeners();
        return data;
    },

    async update(id, updates) {
        const dbUpdates = { ...updates };

        // Values are already in cents from CurrencyMask.unmask()
        if (updates.current_balance !== undefined) {
            dbUpdates.current_balance = updates.current_balance;
        }
        if (updates.initial_balance !== undefined) {
            dbUpdates.initial_balance = updates.initial_balance;
        }

        const { data, error } = await supabase
            .from('accounts')
            .update({
                ...dbUpdates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        const index = this.accounts.findIndex(a => a.id === id);
        if (index !== -1) {
            this.accounts[index] = data;
            this.saveCache();
            this.notifyListeners();
        }
        return data;
    },

    async delete(id) {
        // Check if account has transactions
        const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', id);

        if (count > 0) {
            throw new Error('Não é possível excluir uma conta com transações vinculadas.');
        }

        const { error } = await supabase
            .from('accounts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        this.accounts = this.accounts.filter(a => a.id !== id);
        this.saveCache();
        this.notifyListeners();
    },

    async transfer(fromAccountId, toAccountId, amount, description, date) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not authenticated');

        // Create transfer record
        const { data: transfer, error: transferError } = await supabase
            .from('account_transfers')
            .insert({
                user_id: user.id,
                from_account_id: fromAccountId,
                to_account_id: toAccountId,
                amount,
                description,
                date: date || new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

        if (transferError) throw transferError;

        // Create two transactions (expense from source, income to destination)
        const TransactionService = (await import('./transaction.service.js')).TransactionService;

        // Transfers usually come as Reais from UI (e.g. 50.00)
        // TransactionService.create expects Reais by default (without amountIsCents flag)
        // IF 'amount' passed here is Reais, we just pass it along.
        // IF 'amount' is Cents, we must use flag.
        // Assuming Transfers come from UI -> Reais.

        await TransactionService.create({
            type: 'expense',
            amount: amount,
            description: `Transferência: ${description || 'Sem descrição'}`,
            date: date || new Date().toISOString().split('T')[0],
            account_id: fromAccountId,
            category: 'Transferência'
        });

        await TransactionService.create({
            type: 'income',
            amount: amount,
            description: `Transferência: ${description || 'Sem descrição'}`,
            date: date || new Date().toISOString().split('T')[0],
            account_id: toAccountId,
            category: 'Transferência'
        });

        await this.fetchAll(); // Refresh to get updated balances
        return transfer;
    },

    getTotalBalance() {
        return this.accounts
            .filter(a => a.include_in_total)
            .reduce((sum, account) => sum + (account.current_balance || 0), 0);
    },

    getAccountById(id) {
        return this.accounts.find(a => a.id === id);
    },

    getTypeLabel(type) {
        const labels = {
            'checking': 'Conta Corrente',
            'savings': 'Poupança',
            'wallet': 'Carteira Digital',
            'cash': 'Dinheiro',
            'investment': 'Investimentos',
            'credit': 'Cartão de Crédito'
        };
        return labels[type] || type;
    },

    getTypeIcon(type) {
        const icons = {
            'checking': '💳',
            'savings': '🏦',
            'wallet': '📱',
            'cash': '💵',
            'investment': '📈',
            'credit': '💎'
        };
        return icons[type] || '💰';
    },

    saveCache() {
        StoreService.set(CACHE_KEY_ACCOUNTS, this.accounts);
    },

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    getEmergencyFundStatus(monthlyCost, targetMonths = 6) {
        const emergencyAccounts = this.accounts.filter(a => a.is_emergency_fund && a.is_active);
        const currentAmount = emergencyAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

        // monthlyCost usually comes as Reais from Profile/Input
        const monthlyCostCents = Money.toCents(monthlyCost || 5000);
        const goalAmount = monthlyCostCents * targetMonths;
        const progress = goalAmount > 0 ? Math.min((currentAmount / goalAmount) * 100, 100) : 0;

        return {
            currentAmount,
            goalAmount,
            progress: Math.round(progress),
            accountsCount: emergencyAccounts.length,
            isComplete: progress >= 100
        };
    },

    getEmergencyFundAccounts() {
        return this.accounts.filter(a => a.is_emergency_fund && a.is_active);
    },

    notifyListeners() {
        this.listeners.forEach(l => l(this.accounts));
    }
};


