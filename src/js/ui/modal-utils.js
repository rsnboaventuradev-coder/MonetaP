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
    confirm(title, message, options = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-5';
            overlay.style.zIndex = '9999';

            const confirmText = options.confirmText || 'Confirmar';
            const cancelText = options.cancelText || 'Cancelar';
            const isDanger = !!options.danger;

            const confirmBtnClass = isDanger
                ? 'flex-1 py-3.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-500/25 active:scale-95 transition-all min-h-[48px]'
                : 'flex-1 py-3.5 px-4 rounded-xl bg-brand-gold hover:bg-yellow-500 text-brand-darker font-black text-sm uppercase tracking-wider shadow-lg shadow-brand-gold/25 active:scale-95 transition-all min-h-[48px]';

            const iconHtml = isDanger
                ? `<div class="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                    <svg class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                   </div>`
                : `<div class="w-12 h-12 rounded-2xl bg-brand-gold/15 border border-brand-gold/20 flex items-center justify-center shrink-0">
                    <svg class="w-6 h-6 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                   </div>`;

            overlay.innerHTML = `
                <div class="absolute inset-0 bg-black/75 backdrop-blur-md" id="modal-bg-click"></div>
                <div class="relative w-full max-w-sm bg-brand-surface border border-brand-border/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                    
                    <!-- Decorative top accent line -->
                    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${isDanger ? 'via-red-500/50' : 'via-brand-gold/50'} to-transparent"></div>
                    <!-- Glow -->
                    <div class="absolute -top-10 -right-10 w-48 h-48 ${isDanger ? 'bg-red-500/8' : 'bg-brand-gold/8'} rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Header -->
                    <div class="px-7 pt-7 pb-5 relative z-10">
                        <div class="flex items-start gap-4">
                            ${iconHtml}
                            <div class="flex-1 pt-1">
                                <h3 class="text-lg font-black text-brand-text-primary tracking-tight leading-tight">${title}</h3>
                                ${message ? `<p class="text-sm text-brand-text-secondary mt-2 leading-relaxed whitespace-pre-line">${message}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-5 pb-5 pt-1 relative z-10 flex gap-3">
                        <button id="modal-cancel" class="flex-1 py-3.5 px-4 rounded-xl bg-brand-bg border border-brand-border/50 text-brand-text-secondary font-bold text-sm hover:bg-brand-surface-light hover:text-brand-text-primary transition-all min-h-[48px] active:scale-95">
                            ${cancelText}
                        </button>
                        <button id="modal-confirm" class="${confirmBtnClass}">
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
                try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (_) { }
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
            overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-5';
            overlay.style.zIndex = '9999';

            const placeholder = options.placeholder || '';
            const defaultValue = options.defaultValue || '';
            const inputType = options.inputType || 'text';

            overlay.innerHTML = `
                <div class="absolute inset-0 bg-black/75 backdrop-blur-md" id="modal-bg-click"></div>
                <div class="relative w-full max-w-sm bg-brand-surface border border-brand-border/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">

                    <!-- Decorative top accent line -->
                    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent"></div>
                    <div class="absolute -top-10 -right-10 w-48 h-48 bg-brand-gold/8 rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Header -->
                    <div class="px-7 pt-7 pb-4 relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary tracking-tight">${title}</h3>
                        ${message ? `<p class="text-sm text-brand-text-secondary mt-1 leading-relaxed">${message}</p>` : ''}
                    </div>

                    <!-- Input -->
                    <div class="px-7 pb-6 relative z-10">
                        <div class="relative">
                            <input 
                                type="${inputType}" 
                                inputmode="${inputType === 'number' ? 'decimal' : 'text'}"
                                id="modal-input" 
                                class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary placeholder-brand-text-secondary/40 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/40 transition-all font-bold text-base"
                                placeholder="${placeholder}"
                                value="${defaultValue}"
                            />
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-5 pb-5 relative z-10 flex gap-3">
                        <button id="modal-cancel" class="flex-1 py-3.5 px-4 rounded-xl bg-brand-bg border border-brand-border/50 text-brand-text-secondary font-bold text-sm hover:bg-brand-surface-light hover:text-brand-text-primary transition-all min-h-[48px] active:scale-95">
                            Cancelar
                        </button>
                        <button id="modal-confirm" class="flex-1 py-3.5 px-4 rounded-xl bg-brand-gold hover:bg-yellow-500 text-brand-darker font-black text-sm uppercase tracking-wider shadow-lg shadow-brand-gold/25 active:scale-95 transition-all min-h-[48px]">
                            Confirmar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const input = document.getElementById('modal-input');
            setTimeout(() => input.focus(), 50);

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
