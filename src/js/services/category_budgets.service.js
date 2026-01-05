/**
 * Category Budget Service
 * Manages category spending limits and alerts
 */

import { supabase, SupabaseService } from './supabase.service.js';
import { StoreService } from './store.service.js';
import { TransactionService } from './transaction.service.js';

const CACHE_KEY = 'moneta_category_budgets';

export const CategoryBudgetService = {
    budgets: [], // { categoryId, categoryName, limit, period: 'monthly' }
    listeners: [],

    async init() {
        // Try to load from cache first
        const cached = await StoreService.get(CACHE_KEY);
        if (cached) {
            this.budgets = cached;
        }

        // Then sync with remote if available
        try {
            await this.fetchFromRemote();
        } catch (error) {
            console.warn('Could not sync category budgets from remote:', error);
        }
    },

    async fetchFromRemote() {
        const user = SupabaseService.currentUser;
        if (!user) return;

        const { data, error } = await supabase
            .from('category_budgets')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            // Table might not exist yet, that's okay
            if (!error.message.includes('does not exist')) {
                console.error('Error fetching category budgets:', error);
            }
            return;
        }

        if (data && data.length > 0) {
            this.budgets = data;
            await this.saveCache();
        }
    },

    async saveCache() {
        await StoreService.set(CACHE_KEY, this.budgets);
    },

    /**
     * Set a spending limit for a category
     * @param {string} categoryId - The category UUID
     * @param {string} categoryName - Human readable category name
     * @param {number} limit - Monthly limit in cents
     */
    async setLimit(categoryId, categoryName, limit) {
        const existing = this.budgets.find(b => b.categoryId === categoryId);

        if (existing) {
            existing.limit = limit;
            existing.categoryName = categoryName;
        } else {
            this.budgets.push({
                categoryId,
                categoryName,
                limit,
                period: 'monthly'
            });
        }

        await this.saveCache();
        this.notifyListeners();

        // Try to sync with remote
        try {
            const user = SupabaseService.currentUser;
            if (user) {
                await supabase.from('category_budgets').upsert({
                    user_id: user.id,
                    category_id: categoryId,
                    category_name: categoryName,
                    limit_amount: limit,
                    period: 'monthly',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,category_id' });
            }
        } catch (error) {
            console.warn('Could not sync category budget to remote:', error);
        }
    },

    /**
     * Remove a spending limit for a category
     */
    async removeLimit(categoryId) {
        this.budgets = this.budgets.filter(b => b.categoryId !== categoryId);
        await this.saveCache();
        this.notifyListeners();
    },

    /**
     * Get the spending limit for a category
     * @returns {Object|null} { categoryId, categoryName, limit, period }
     */
    getLimit(categoryId) {
        return this.budgets.find(b => b.categoryId === categoryId) || null;
    },

    /**
     * Get all category budgets
     */
    getAllLimits() {
        return [...this.budgets];
    },

    /**
     * Check the budget status for a category after a new expense
     * @param {string} categoryId - The category to check
     * @param {number} newAmount - The new expense amount in cents
     * @param {Date} date - The date of the transaction (to determine month)
     * @returns {Object} { exceeded, nearLimit, usagePercent, categoryName, limit, spent }
     */
    async checkBudget(categoryId, newAmount, date = new Date()) {
        const budget = this.getLimit(categoryId);

        if (!budget) {
            return { exceeded: false, nearLimit: false, usagePercent: 0, hasLimit: false };
        }

        // Get current spending for this category this month
        const month = date.getMonth();
        const year = date.getFullYear();

        const transactions = TransactionService.getByMonth(month, year);
        const categorySpending = transactions
            .filter(tx =>
                tx.type === 'expense' &&
                (tx.category_id === categoryId || tx.categoryId === categoryId)
            )
            .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount) || 0), 0);

        // Convert to cents if needed (amounts might be in reais)
        const spentCents = categorySpending > 1000 ? categorySpending : categorySpending * 100;
        const newAmountCents = newAmount > 1000 ? newAmount : newAmount * 100;
        const totalAfterNew = spentCents + newAmountCents;

        const usagePercent = Math.round((totalAfterNew / budget.limit) * 100);
        const exceeded = totalAfterNew > budget.limit;
        const nearLimit = usagePercent >= 80 && !exceeded;

        return {
            hasLimit: true,
            exceeded,
            nearLimit,
            usagePercent,
            categoryName: budget.categoryName,
            limit: budget.limit,
            spent: spentCents,
            newTotal: totalAfterNew
        };
    },

    /**
     * Get budget status for all categories with limits
     * @param {number} month - 0-indexed month
     * @param {number} year - Full year
     * @returns {Array} Array of budget status objects
     */
    async getBudgetStatusAll(month = new Date().getMonth(), year = new Date().getFullYear()) {
        const transactions = TransactionService.getByMonth(month, year);

        return this.budgets.map(budget => {
            const categorySpending = transactions
                .filter(tx =>
                    tx.type === 'expense' &&
                    (tx.category_id === budget.categoryId || tx.categoryId === budget.categoryId)
                )
                .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount) || 0), 0);

            const spentCents = categorySpending > 1000 ? categorySpending : categorySpending * 100;
            const usagePercent = budget.limit > 0 ? Math.round((spentCents / budget.limit) * 100) : 0;

            return {
                ...budget,
                spent: spentCents,
                usagePercent,
                exceeded: spentCents > budget.limit,
                remaining: budget.limit - spentCents
            };
        });
    },

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notifyListeners() {
        this.listeners.forEach(listener => listener(this.budgets));
    }
};
