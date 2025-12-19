/**
 * Bottom Navigation Component
 * Renders the mobile-first bottom tab bar.
 */
export const BottomNav = {
    async render(activeTab) {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;

        nav.className = 'fixed bottom-0 w-full bg-brand-surface/80 backdrop-blur-lg border-t border-white/5 safe-area-bottom z-50';

        nav.innerHTML = `
            <div class="max-w-lg mx-auto h-full px-2">
                <div class="grid grid-cols-6 h-full items-center">
                    <button class="nav-item group flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-gray-300 transition relative" data-target="dashboard">
                        <div class="absolute -top-3 w-8 h-1 bg-brand-green rounded-b-full transition-all duration-300 ${activeTab === 'dashboard' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1 transition-transform group-active:scale-90 ${activeTab === 'dashboard' ? 'text-brand-green' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span class="text-[10px] font-medium ${activeTab === 'dashboard' ? 'text-brand-green' : ''}">Home</span>
                    </button>
                    
                    <button class="nav-item group flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-gray-300 transition relative" data-target="wallet">
                         <div class="absolute -top-3 w-8 h-1 bg-brand-green-light rounded-b-full transition-all duration-300 ${activeTab === 'wallet' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}"></div>
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1 transition-transform group-active:scale-90 ${activeTab === 'wallet' ? 'text-brand-green-light' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span class="text-[10px] font-medium ${activeTab === 'wallet' ? 'text-brand-green-light' : ''}">Carteira</span>
                    </button>

                    <button class="nav-item group flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-gray-300 transition relative" data-target="goals">
                         <div class="absolute -top-3 w-8 h-1 bg-brand-gold rounded-b-full transition-all duration-300 ${activeTab === 'goals' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}"></div>
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1 transition-transform group-active:scale-90 ${activeTab === 'goals' ? 'text-brand-gold' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span class="text-[10px] font-medium ${activeTab === 'goals' ? 'text-brand-gold' : ''}">Metas</span>
                    </button>

                    <button class="nav-item group flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-gray-300 transition relative" data-target="reports">
                         <div class="absolute -top-3 w-8 h-1 bg-blue-500 rounded-b-full transition-all duration-300 ${activeTab === 'reports' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}"></div>
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1 transition-transform group-active:scale-90 ${activeTab === 'reports' ? 'text-blue-500' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span class="text-[10px] font-medium ${activeTab === 'reports' ? 'text-blue-500' : ''}">Relatórios</span>
                    </button>

                    <button class="nav-item group flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-gray-300 transition relative" data-target="investments">
                         <div class="absolute -top-3 w-8 h-1 bg-purple-500 rounded-b-full transition-all duration-300 ${activeTab === 'investments' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}"></div>
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1 transition-transform group-active:scale-90 ${activeTab === 'investments' ? 'text-purple-500' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span class="text-[10px] font-medium ${activeTab === 'investments' ? 'text-purple-500' : ''}">Inv.</span>
                    </button>

                    <button class="nav-item group flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-gray-300 transition relative" data-target="profile">
                        <div class="absolute -top-3 w-8 h-1 bg-brand-green rounded-b-full transition-all duration-300 ${activeTab === 'profile' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mb-1 transition-transform group-active:scale-90 ${activeTab === 'profile' ? 'text-brand-green' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span class="text-[10px] font-medium ${activeTab === 'profile' ? 'text-brand-green' : ''}">Perfil</span>
                    </button>
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
