/**
 * StoreService
 * Wraps localStorage to provide a simple key-value store with JSON parsing.
 * Future-proofed to potentially swap with IndexedDB if needed.
 */
export const StoreService = {
    /**
     * Get item from storage
     * @param {string} key 
     * @returns {any} parsed value or null
     */
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Error getting key ${key} from storage:`, error);
            return null;
        }
    },

    /**
     * Set item in storage
     * @param {string} key 
     * @param {any} value 
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error setting key ${key} in storage:`, error);
        }
    },

    /**
     * Remove item from storage
     * @param {string} key 
     */
    remove(key) {
        localStorage.removeItem(key);
    },

    /**
     * Clear all app-specific storage
     */
    clear() {
        localStorage.clear();
    }
};


