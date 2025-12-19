import { supabase } from './supabase.service.js';
import { StoreService } from './store.service.js';
import { SyncService } from './sync.service.js';

const CACHE_KEY_PARTNERS = 'moneta_partners_cache';

export const PartnersService = {
    partners: [],
    listeners: [],

    async init() {
        this.partners = StoreService.get(CACHE_KEY_PARTNERS) || [];
        if (!Array.isArray(this.partners)) this.partners = [];

        if (navigator.onLine) {
            await this.fetchAll();
        }
    },

    async fetchAll() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('partners')
            .select('*')
            .eq('user_id', user.id)
            .order('name', { ascending: true });

        if (!error && data) {
            this.partners = data;
            this.saveCache();
            this.notifyListeners();
        }
    },

    saveCache() {
        StoreService.set(CACHE_KEY_PARTNERS, this.partners);
    },

    subscribe(listener) {
        this.listeners.push(listener);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notifyListeners() {
        this.listeners.forEach(l => l(this.partners));
    },

    async create(partnerData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        const newPartner = {
            id: crypto.randomUUID(),
            user_id: user.id,
            name: partnerData.name,
            color: partnerData.color || '#10B981', // Default green
            created_at: new Date().toISOString()
        };

        this.partners.push(newPartner);
        this.partners.sort((a, b) => a.name.localeCompare(b.name));
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('partners', 'INSERT', newPartner);
        return newPartner;
    },

    async update(id, updates) {
        const index = this.partners.findIndex(p => p.id === id);
        if (index === -1) return;

        const updatedPartner = { ...this.partners[index], ...updates };
        this.partners[index] = updatedPartner;
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('partners', 'UPDATE', updatedPartner);
    },

    async delete(id) {
        this.partners = this.partners.filter(p => p.id !== id);
        this.saveCache();
        this.notifyListeners();

        SyncService.addToQueue('partners', 'DELETE', { id });
    },

    getById(id) {
        return this.partners.find(p => p.id === id);
    }
};
