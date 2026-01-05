/**
 * Modal Utilities
 * Custom modal dialogs to replace native confirm() and prompt()
 * which are not supported in Electron
 */

export const ModalUtils = {
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
            overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
            overlay.id = 'modal-utils-overlay';

            const confirmText = options.confirmText || 'Confirmar';
            const cancelText = options.cancelText || 'Cancelar';
            const confirmClass = options.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-green hover:bg-brand-green-dark';

            overlay.innerHTML = `
                <div class="bg-brand-surface rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
                    <h3 class="text-xl font-bold text-brand-text-primary mb-4">${title}</h3>
                    <p class="text-brand-text-secondary whitespace-pre-line mb-6">${message}</p>
                    <div class="flex gap-3">
                        <button id="modal-cancel" class="flex-1 py-3 px-4 rounded-xl bg-brand-bg text-brand-text-secondary font-medium hover:bg-brand-surface-light transition">
                            ${cancelText}
                        </button>
                        <button id="modal-confirm" class="flex-1 py-3 px-4 rounded-xl ${confirmClass} text-white font-bold transition">
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

            document.getElementById('modal-confirm').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            document.getElementById('modal-cancel').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
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
            overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
            overlay.id = 'modal-utils-overlay';

            const placeholder = options.placeholder || '';
            const defaultValue = options.defaultValue || '';
            const inputType = options.inputType || 'text';

            overlay.innerHTML = `
                <div class="bg-brand-surface rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
                    <h3 class="text-xl font-bold text-brand-text-primary mb-4">${title}</h3>
                    <p class="text-brand-text-secondary whitespace-pre-line mb-4">${message}</p>
                    <input 
                        type="${inputType}" 
                        id="modal-input" 
                        class="w-full p-3 rounded-xl bg-brand-bg border border-brand-border text-brand-text-primary placeholder-brand-text-secondary mb-6 focus:outline-none focus:border-brand-green"
                        placeholder="${placeholder}"
                        value="${defaultValue}"
                    />
                    <div class="flex gap-3">
                        <button id="modal-cancel" class="flex-1 py-3 px-4 rounded-xl bg-brand-bg text-brand-text-secondary font-medium hover:bg-brand-surface-light transition">
                            Cancelar
                        </button>
                        <button id="modal-confirm" class="flex-1 py-3 px-4 rounded-xl bg-brand-green text-white font-bold hover:bg-brand-green-dark transition">
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

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
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
