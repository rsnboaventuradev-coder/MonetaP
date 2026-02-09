/**
 * Modal Utilities
 * Custom modal dialogs to replace native confirm() and prompt()
 * which are not supported in Electron
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const ModalUtils = {
    /**
     * Shows a confirmation modal
     * @param {string} title - Modal title
     * @param {string} message - Modal message
     * @param {object} options - Optional settings
     * @returns {Promise<boolean>}
     */
    /**
     * Shows a confirmation modal
     * @param {string} title - Modal title
     * @param {string} message - Modal message
     * @param {object} options - Optional settings
     * @returns {Promise<boolean>}
     */
    confirm(title, message, options = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
            overlay.id = 'modal-utils-overlay';
            overlay.style.zIndex = '9999';

            const confirmText = options.confirmText || 'Confirmar';
            const cancelText = options.cancelText || 'Cancelar';
            const confirmClass = options.danger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-brand-gold hover:bg-yellow-500 shadow-brand-gold/20 text-brand-darker';

            overlay.innerHTML = `
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" id="modal-bg-click"></div>
                <div class="relative w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
                    
                    <!-- Header -->
                    <div class="p-6 pb-4 border-b border-brand-border shrink-0">
                        <h3 class="text-xl font-bold text-brand-text-primary">${title}</h3>
                    </div>

                    <!-- Body -->
                    <div class="p-6 overflow-y-auto custom-scrollbar">
                        <p class="text-brand-text-secondary whitespace-pre-line leading-relaxed">${message}</p>
                    </div>

                    <!-- Footer -->
                    <div class="p-6 border-t border-brand-border bg-brand-surface shrink-0 flex gap-3">
                        <button id="modal-cancel" class="flex-1 py-3 px-4 rounded-xl bg-brand-bg text-brand-text-secondary font-medium hover:bg-brand-surface-light transition min-h-[44px]">
                            ${cancelText}
                        </button>
                        <button id="modal-confirm" class="flex-1 py-3 px-4 rounded-xl ${confirmClass} font-bold transition min-h-[44px] shadow-lg">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            };

            document.getElementById('modal-confirm').addEventListener('click', async () => {
                await Haptics.impact({ style: ImpactStyle.Light });
                cleanup();
                resolve(true);
            });

            document.getElementById('modal-cancel').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            document.getElementById('modal-bg-click').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    },

    /**
     * Shows a prompt modal for text input
     * @param {string} title - Modal title
     * @param {string} message - Modal message
     * @param {object} options - Optional settings
     * @returns {Promise<string|null>}
     */
    prompt(title, message, options = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
            overlay.id = 'modal-utils-overlay';
            overlay.style.zIndex = '9999';

            const placeholder = options.placeholder || '';
            const defaultValue = options.defaultValue || '';
            const inputType = options.inputType || 'text';

            overlay.innerHTML = `
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" id="modal-bg-click"></div>
                <div class="relative w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
                    
                    <!-- Header -->
                    <div class="p-6 pb-4 border-b border-brand-border shrink-0">
                        <h3 class="text-xl font-bold text-brand-text-primary">${title}</h3>
                    </div>

                    <!-- Body -->
                    <div class="p-6 overflow-y-auto custom-scrollbar space-y-4">
                        <p class="text-brand-text-secondary whitespace-pre-line leading-relaxed">${message}</p>
                        <input 
                            type="${inputType}" 
                            inputmode="${inputType === 'number' ? 'decimal' : 'text'}"
                            id="modal-input" 
                            class="w-full p-4 rounded-xl bg-brand-bg border border-brand-border text-brand-text-primary placeholder-brand-text-secondary focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-all font-medium"
                            placeholder="${placeholder}"
                            value="${defaultValue}"
                        />
                    </div>

                    <!-- Footer -->
                    <div class="p-6 border-t border-brand-border bg-brand-surface shrink-0 flex gap-3">
                        <button id="modal-cancel" class="flex-1 py-3 px-4 rounded-xl bg-brand-bg text-brand-text-secondary font-medium hover:bg-brand-surface-light transition min-h-[44px]">
                            Cancelar
                        </button>
                        <button id="modal-confirm" class="flex-1 py-3 px-4 rounded-xl bg-brand-gold text-brand-darker font-bold hover:bg-yellow-500 transition min-h-[44px] shadow-lg shadow-brand-gold/20">
                            Confirmar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const input = document.getElementById('modal-input');
            input.focus();

            const cleanup = () => {
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
            };

            document.getElementById('modal-confirm').addEventListener('click', () => {
                const value = input.value;
                cleanup();
                resolve(value);
            });

            document.getElementById('modal-cancel').addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            document.getElementById('modal-bg-click').addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            const keyHandler = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                } else if (e.key === 'Enter') {
                    const value = input.value;
                    cleanup();
                    resolve(value);
                }
            };
            document.addEventListener('keydown', keyHandler);
        });
    }
};

// Make it globally available
window.ModalUtils = ModalUtils;
