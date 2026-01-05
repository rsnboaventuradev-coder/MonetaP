/**
 * Sync Status Indicator
 * Shows a visual indicator when data is being synced to Supabase
 */

export class SyncIndicator {
    constructor() {
        this.element = null;
        this.syncQueue = [];
        this.isSyncing = false;
        this.init();
    }

    init() {
        // Create indicator element
        this.element = document.createElement('div');
        this.element.id = 'sync-indicator';
        this.element.className = 'fixed bottom-24 right-6 z-50 transition-all duration-300 transform translate-y-20 opacity-0';
        this.element.innerHTML = `
            <div class="bg-brand-surface border border-brand-border rounded-full px-4 py-2 shadow-lg backdrop-blur-md flex items-center gap-2">
                <div class="sync-spinner w-4 h-4 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin"></div>
                <span class="text-xs font-bold text-brand-text-primary">Sincronizando...</span>
            </div>
        `;
        document.body.appendChild(this.element);
    }

    show() {
        if (this.element) {
            this.element.classList.remove('translate-y-20', 'opacity-0');
            this.element.classList.add('translate-y-0', 'opacity-100');
        }
    }

    hide() {
        if (this.element) {
            this.element.classList.remove('translate-y-0', 'opacity-100');
            this.element.classList.add('translate-y-20', 'opacity-0');
        }
    }

    showSuccess() {
        if (!this.element) return;

        this.element.innerHTML = `
            <div class="bg-brand-green/20 border border-brand-green/30 rounded-full px-4 py-2 shadow-lg backdrop-blur-md flex items-center gap-2">
                <svg class="w-4 h-4 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-xs font-bold text-brand-green">Salvo!</span>
            </div>
        `;

        this.show();

        setTimeout(() => {
            this.hide();
            // Reset to syncing state after hiding
            setTimeout(() => {
                this.element.innerHTML = `
                    <div class="bg-brand-surface border border-brand-border rounded-full px-4 py-2 shadow-lg backdrop-blur-md flex items-center gap-2">
                        <div class="sync-spinner w-4 h-4 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin"></div>
                        <span class="text-xs font-bold text-brand-text-primary">Sincronizando...</span>
                    </div>
                `;
            }, 300);
        }, 2000);
    }

    showError() {
        if (!this.element) return;

        this.element.innerHTML = `
            <div class="bg-red-500/20 border border-red-500/30 rounded-full px-4 py-2 shadow-lg backdrop-blur-md flex items-center gap-2">
                <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <span class="text-xs font-bold text-red-400">Erro ao sincronizar</span>
            </div>
        `;

        this.show();

        setTimeout(() => {
            this.hide();
        }, 3000);
    }
}

// Create singleton instance
export const syncIndicator = new SyncIndicator();


