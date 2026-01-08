import { supabase } from './supabase.service.js';
import { StoreService } from './store.service.js';

const CACHE_KEY_CATEGORIES = 'moneta_categories_cache';
const CACHE_KEY_ACCOUNTS = 'moneta_accounts_cache';
const CACHE_KEY_CARDS = 'moneta_cards_cache';

export const SettingsService = {
    categories: [],
    accounts: [],
    cards: [],
    listeners: [],

    async init() {
        // Load from cache or initialize
        this.categories = StoreService.get(CACHE_KEY_CATEGORIES) || [];
        this.accounts = StoreService.get(CACHE_KEY_ACCOUNTS) || [];
        this.cards = StoreService.get(CACHE_KEY_CARDS) || [];

        if (navigator.onLine) {
            await Promise.all([
                this.fetchCategories(),
                this.fetchAccounts(),
                this.fetchCards()
            ]);
        }
    },

    // --- CATEGORIES ---
    async fetchCategories(type = null) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let query = supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (!error && data) {
            this.categories = data;
            StoreService.set(CACHE_KEY_CATEGORIES, this.categories);
            this.notifyListeners();
        }
    },

    async createCategory(category) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        // Validation for new 'type' field
        if (!category.type || !['INCOME', 'EXPENSE'].includes(category.type)) {
            throw new Error("Category 'type' is required and must be 'INCOME' or 'EXPENSE'.");
        }

        const payload = { ...category, user_id: user.id };
        const { data, error } = await supabase.from('categories').insert(payload).select().single();
        if (error) throw error;

        this.categories.push(data);
        StoreService.set(CACHE_KEY_CATEGORIES, this.categories);
        this.notifyListeners();
        return data;
    },

    async deleteCategory(id) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;

        this.categories = this.categories.filter(c => c.id !== id);
        StoreService.set(CACHE_KEY_CATEGORIES, this.categories);
        this.notifyListeners();
    },

    // --- ACCOUNTS ---
    async fetchAccounts() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        if (!error && data) {
            this.accounts = data;
            StoreService.set(CACHE_KEY_ACCOUNTS, this.accounts);
            this.notifyListeners();
        }
    },

    async createAccount(account) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        const payload = { ...account, user_id: user.id };
        const { data, error } = await supabase.from('accounts').insert(payload).select().single();
        if (error) throw error;

        this.accounts.push(data);
        StoreService.set(CACHE_KEY_ACCOUNTS, this.accounts);
        this.notifyListeners();
        return data;
    },

    async deleteAccount(id) {
        const { error } = await supabase.from('accounts').delete().eq('id', id);
        if (error) throw error;

        this.accounts = this.accounts.filter(a => a.id !== id);
        StoreService.set(CACHE_KEY_ACCOUNTS, this.accounts);
        this.notifyListeners();
    },

    // --- CARDS ---
    async fetchCards() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
            .from('credit_cards')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        if (!error && data) {
            this.cards = data;
            StoreService.set(CACHE_KEY_CARDS, this.cards);
            this.notifyListeners();
        }
    },

    async createCard(card) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        const payload = { ...card, user_id: user.id };
        const { data, error } = await supabase.from('credit_cards').insert(payload).select().single();
        if (error) throw error;

        this.cards.push(data);
        StoreService.set(CACHE_KEY_CARDS, this.cards);
        this.notifyListeners();
        return data;
    },

    async deleteCard(id) {
        const { error } = await supabase.from('credit_cards').delete().eq('id', id);
        if (error) throw error;

        this.cards = this.cards.filter(c => c.id !== id);
        StoreService.set(CACHE_KEY_CARDS, this.cards);
        this.notifyListeners();
    },

    // --- PROFILE ALIAS ---
    async updateProfile(updates) {
        console.log('🔧 SettingsService.updateProfile chamado com:', updates);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        console.log('👤 User ID:', user.id);
        console.log('📤 Fazendo upsert na tabela profiles...');

        const { data, error } = await supabase
            .from('profiles')
            .upsert({ id: user.id, ...updates })
            .select();

        console.log('📥 Resposta do Supabase:', { data, error });

        if (error) {
            console.error('❌ Erro no upsert:', error);
            throw error;
        }

        console.log('✅ updateProfile concluído com sucesso!');
        return true;
    },

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notifyListeners() {
        this.listeners.forEach(l => l(this));
    }
};


