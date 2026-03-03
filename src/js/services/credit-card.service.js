import { SupabaseService } from './supabase.service.js';
import { Observable } from '../utils/observer.js';
import { Money } from '../utils/money.js';

const supabase = SupabaseService.client;

export const CreditCardService = {
    store: new Observable([]),

    get cards() {
        return this.store.value;
    },

    set cards(val) {
        this.store.value = val;
    },

    subscribe(listener) {
        return this.store.subscribe(listener);
    },

    notifyListeners() {
        this.store.notify();
    },

    async init() {
        const session = await SupabaseService.getSession();
        if (!session) return;
        await this.fetchCards();
    },

    async fetchCards() {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) return;

        const { data, error } = await supabase
            .from('credit_cards')
            .select('*')
            .eq('user_id', user.id)
            .eq('active', true)
            .order('name', { ascending: true });

        if (!error && data) {
            this.cards = data;
            this.notifyListeners();
        }
    },

    async createCard(cardData) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not authenticated');

        const dbData = {
            user_id: user.id,
            name: cardData.name,
            bank: cardData.bank || null,
            last_digits: cardData.last_digits || null,
            billing_day: parseInt(cardData.billing_day),
            credit_limit: Money.toCents(cardData.credit_limit),
            context: cardData.context || 'personal',
            current_invoice: 0,
            active: true
        };

        const { data, error } = await supabase
            .from('credit_cards')
            .insert([dbData])
            .select()
            .single();

        if (error) throw error;

        this.cards.unshift(data);
        this.notifyListeners();
        return data;
    },

    async updateCard(id, updates) {
        const dbUpdates = { ...updates };

        if (updates.credit_limit !== undefined) {
            dbUpdates.credit_limit = Money.toCents(updates.credit_limit);
        }

        dbUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('credit_cards')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        const index = this.cards.findIndex(c => c.id === id);
        if (index !== -1) {
            this.cards[index] = data;
            this.notifyListeners();
        }
        return data;
    },

    async deleteCard(id) {
        const { error } = await supabase
            .from('credit_cards')
            .update({ active: false })
            .eq('id', id);

        if (error) throw error;

        this.cards = this.cards.filter(c => c.id !== id);
        this.notifyListeners();
    },

    // --- Purchases ---

    async addPurchase(cardId, purchaseData) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) throw new Error('User not authenticated');

        const totalAmountCents = Money.toCents(purchaseData.amount);
        const installmentsCount = parseInt(purchaseData.installments) || 1;

        // Calculate amount per installment
        const installmentCents = Math.floor(totalAmountCents / installmentsCount);
        const remainderCents = totalAmountCents % installmentsCount;

        const purchaseDate = new Date(purchaseData.purchase_date || new Date());
        const card = this.cards.find(c => c.id === cardId);

        if (!card) throw new Error('Card not found');

        const purchasesToInsert = [];

        for (let i = 0; i < installmentsCount; i++) {
            let currentAmount = installmentCents;
            // Add remainder to the first installment
            if (i === 0) currentAmount += remainderCents;

            // Calculate billing month for this specific installment
            let billingMonth = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);

            // Initial offset based on billing day
            if (purchaseDate.getDate() > card.billing_day) {
                billingMonth.setMonth(billingMonth.getMonth() + 1);
            }

            // Add offset for the ongoing installments
            billingMonth.setMonth(billingMonth.getMonth() + i);

            // Give a contextual description if it's parceled
            let description = purchaseData.description;
            if (installmentsCount > 1) {
                description = `${description} (${i + 1}/${installmentsCount})`;
            }

            purchasesToInsert.push({
                card_id: cardId,
                user_id: user.id,
                description: description,
                amount: currentAmount,
                purchase_date: purchaseData.purchase_date || new Date().toISOString().split('T')[0],
                installments: installmentsCount,
                current_installment: i + 1,
                category: purchaseData.category || null,
                billing_month: billingMonth.toISOString().split('T')[0]
            });
        }

        const { data, error } = await supabase
            .from('credit_card_purchases')
            .insert(purchasesToInsert) // Now pushing an array
            .select();

        if (error) throw error;

        // Update card's current invoice
        await this.updateCardInvoice(cardId);

        return data;
    },

    async updateCardInvoice(cardId) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) return;

        // Get current billing month
        const today = new Date();
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        // Calculate current billing period
        let billingStart = new Date(today.getFullYear(), today.getMonth(), 1);
        if (today.getDate() <= card.billing_day) {
            // We're still in last month's billing cycle
            billingStart.setMonth(billingStart.getMonth());
        } else {
            billingStart.setMonth(billingStart.getMonth() + 1);
        }

        // Sum all purchases for current billing period
        const { data: purchases, error } = await supabase
            .from('credit_card_purchases')
            .select('amount')
            .eq('card_id', cardId)
            .gte('billing_month', billingStart.toISOString().split('T')[0]);

        if (error) {
            console.error('Error fetching purchases:', error);
            return;
        }

        const totalInvoice = purchases.reduce((acc, p) => acc + Number(p.amount), 0);

        // Update card
        await supabase
            .from('credit_cards')
            .update({ current_invoice: totalInvoice })
            .eq('id', cardId);

        // Update local state
        const index = this.cards.findIndex(c => c.id === cardId);
        if (index !== -1) {
            this.cards[index].current_invoice = totalInvoice;
            this.notifyListeners();
        }
    },

    async getCardPurchases(cardId, billingMonth = null) {
        const session = await SupabaseService.getSession();
        const user = session?.user;
        if (!user) return [];

        let query = supabase
            .from('credit_card_purchases')
            .select('*')
            .eq('card_id', cardId)
            .eq('user_id', user.id)
            .order('purchase_date', { ascending: false });

        if (billingMonth) {
            query = query.eq('billing_month', billingMonth);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching purchases:', error);
            return [];
        }

        return data;
    },

    async payInvoice(cardId, createTransaction = true) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card || card.current_invoice <= 0) return;

        // Reset invoice to 0
        await supabase
            .from('credit_cards')
            .update({ current_invoice: 0 })
            .eq('id', cardId);

        // Update local state
        const index = this.cards.findIndex(c => c.id === cardId);
        if (index !== -1) {
            this.cards[index].current_invoice = 0;
            this.notifyListeners();
        }

        return card.current_invoice; // Return amount paid for creating transaction
    },

    // Helpers
    getTotalInvoices() {
        return this.cards.reduce((acc, card) => acc + (card.current_invoice || 0), 0);
    }
};
