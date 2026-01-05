/**
 * Bottom Navigation Component
 * Renders the mobile-first bottom tab bar with dynamic tab visibility.
 */
export const BottomNav = {
    // All available tabs with their configuration
    allTabs: [
        { id: 'dashboard', label: 'Home', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />', color: 'brand-green', canHide: false },
        { id: 'wallet', label: 'Carteira', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />', color: 'brand-green-light', canHide: true },
        { id: 'goals', label: 'Metas', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />', color: 'brand-gold', canHide: true },
        { id: 'reports', label: 'Relatórios', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />', color: 'blue-500', canHide: true },
        { id: 'investments', label: 'Inv.', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />', color: 'purple-500', canHide: true },
        { id: 'settings', label: 'Config', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>', color: 'brand-green', canHide: false }
    ],

    async render(activeTab, hiddenTabs = []) {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;

        // Filter out hidden tabs
        const visibleTabs = this.allTabs.filter(tab => !hiddenTabs.includes(tab.id));
        const colCount = visibleTabs.length;

        nav.className = 'fixed bottom-0 w-full bg-brand-surface/80 backdrop-blur-lg border-t border-brand-border safe-area-bottom z-50';

        const buttons = visibleTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return `
                <button class="nav-item group flex flex-col items-center justify-center w-full h-full text-brand-text-secondary hover:text-brand-text-secondary transition relative" data-target="${tab.id}">
                    <div class="absolute -top-3 w-8 h-1 bg-${tab.color} rounded-b-full transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}"></div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1 transition-transform group-active:scale-90 ${isActive ? `text-${tab.color}` : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        ${tab.icon}
                    </svg>
                    <span class="text-[10px] font-medium ${isActive ? `text-${tab.color}` : ''}">${tab.label}</span>
                </button>
            `;
        }).join('');

        nav.innerHTML = `
            <div class="max-w-lg mx-auto h-full px-2">
                <div class="grid grid-cols-${colCount} h-full items-center">
                    ${buttons}
                </div>
            </div>
        `;

        this.addListeners();
    },

    addListeners() {
        document.querySelectorAll('.nav-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                window.app.navigateTo(target);
            });
        });
    }
};
