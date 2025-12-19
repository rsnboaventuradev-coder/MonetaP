import { StoreService } from './store.service.js';
import { supabase } from './supabase.service.js';

const SYNC_QUEUE_KEY = 'moneta_sync_queue';

export const SyncService = {
    queue: [],

    init() {
        this.queue = StoreService.get(SYNC_QUEUE_KEY) || [];
        window.addEventListener('online', () => this.processQueue());
        // Try to process immediately if online
        if (navigator.onLine) {
            this.processQueue();
        }
    },

    /**
     * Add operation to sync queue
     * @param {string} table 
     * @param {'INSERT' | 'UPDATE' | 'DELETE'} type 
     * @param {object} payload 
     */
    addToQueue(table, type, payload) {
        const operation = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            table,
            type,
            payload,
            retryCount: 0
        };

        this.queue.push(operation);
        this.saveQueue();

        // Try to process immediately if online
        if (navigator.onLine) {
            this.processQueue();
        }
    },

    saveQueue() {
        StoreService.set(SYNC_QUEUE_KEY, this.queue);
    },

    async processQueue() {
        if (this.queue.length === 0) return;
        if (!navigator.onLine) return;

        console.log('Processing sync queue:', this.queue.length, 'operations');

        const remainingQueue = [];

        for (const op of this.queue) {
            try {
                await this.executeOperation(op);
            } catch (error) {
                console.error('Sync operation failed:', error);
                op.retryCount++;
                // If failed less than 3 times, keep in queue
                if (op.retryCount < 3) {
                    remainingQueue.push(op);
                }
            }
        }

        this.queue = remainingQueue;
        this.saveQueue();
    },

    async executeOperation(op) {
        const { table, type, payload } = op;

        let query = supabase.from(table);

        switch (type) {
            case 'INSERT':
                const { error: insertError } = await query.insert(payload);
                if (insertError) throw insertError;
                break;
            case 'UPDATE':
                const { error: updateError } = await query.update(payload).eq('id', payload.id);
                if (updateError) throw updateError;
                break;
            case 'DELETE':
                const { error: deleteError } = await query.delete().eq('id', payload.id);
                if (deleteError) throw deleteError;
                break;
        }
    }
};
