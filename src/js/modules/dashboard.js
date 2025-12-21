import { TransactionService } from '../services/transaction.service.js';
import { InvestmentsService } from '../services/investments.service.js';
import { PartnersService } from '../services/partners.service.js';
import { GoalsService } from '../services/goals.service.js';
import { BudgetService } from '../services/budget.service.js';
import { GamificationService } from '../services/gamification.service.js';
import { SupabaseService } from '../services/supabase.service.js';

export const DashboardModule = {
    currentContext: 'personal', // 'personal' | 'business'
    chartInstances: {},

    unsubscribers: [],

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return; // Null Check to prevent race condition

        // Clean up old listeners
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];

        // Show Skeleton while loading
        this.renderSkeleton(container);

        // Ensure all data is ready
        await Promise.all([
            TransactionService.init(),
            InvestmentsService.init(),
            PartnersService.init(),
            GoalsService.init(),
            BudgetService.init()
        ]);

        // Subscribe to changes
        this.unsubscribers.push(TransactionService.subscribe(() => this.refreshView()));
        this.unsubscribers.push(InvestmentsService.subscribe(() => this.refreshView()));
        this.unsubscribers.push(GoalsService.subscribe(() => this.refreshView()));

        await this.renderView(container);
    },

    renderSkeleton(container) {
        container.innerHTML = `
            <div class="flex flex-col min-h-full bg-brand-bg safe-area-top pb-24 space-y-6 animate-pulse">
                <!-- Header Skeleton -->
                <div class="px-6 pt-6 flex justify-between items-center">
                    <div class="space-y-2">
                        <div class="h-3 w-20 bg-white/5 rounded"></div>
                        <div class="h-8 w-40 bg-white/5 rounded"></div>
                    </div>
                </div>

                <!-- Balance Card Skeleton -->
                <div class="px-6">
                    <div class="h-48 bg-white/5 rounded-3xl"></div>
                </div>

                <!-- Widgets Skeleton -->
                <div class="px-6 grid grid-cols-2 gap-4">
                    <div class="h-32 bg-white/5 rounded-2xl"></div>
                    <div class="h-32 bg-white/5 rounded-2xl"></div>
                </div>
            </div>
        `;
    },

    async refreshView() {
        // Debounce or just re-render view part if container exists
        const container = document.getElementById('main-content');
        if (container && container.querySelector('.dashboard-container')) {
            // Re-render only if dashboard is still active view
            await this.renderView(container);
        }
    },

    async renderView(container) {
        // --- DATA PREPARATION ---
        const session = await SupabaseService.getSession();
        const user = session?.user;

        // Fetch Profile for Cost of Living (optional for now, kept for transparency)
        let avgCostOfLiving = 5000;
        if (user) {
            const { data: profile } = await SupabaseService.client
                .from('profiles')
                .select('monthly_income')
                .eq('id', user.id)
                .maybeSingle();
            if (profile && profile.monthly_income) avgCostOfLiving = parseFloat(profile.monthly_income);
        }

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // 1. BALANCES
        const walletBalance = TransactionService.getBalance();
        const investmentsBalance = InvestmentsService.getTotalValue();
        const totalNetWorth = walletBalance + investmentsBalance;

        // 2. MONTHLY SUMMARY (Income vs Expense)
        const dre = TransactionService.getFinancialStatement(currentMonth, currentYear, 'personal'); // Defaulting to personal for main view or aggregate? User said "Overview". Let's use currentContext.

        // We need to aggregate contextual data if currentContext is 'all' or specific.
        // Assuming currentContext affects what we show.
        const summaryStats = TransactionService.getFinancialStatement(currentMonth, currentYear, this.currentContext === 'all' ? undefined : this.currentContext);

        // 3. HISTORY (Last 6 Months)
        // We need a helper to get last 6 months data.
        const historyData = this.getLast6MonthsHistory();

        // 4. CATEGORY BREAKDOWN (Current Month)
        const categoriesData = this.getCategoryBreakdown(currentMonth, currentYear);

        // 5. RECENT TRANSACTIONS
        const recentTransactions = TransactionService.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);


        // --- HTML CONSTRUCTION ---
        container.innerHTML = `
            <div class="dashboard-container flex flex-col min-h-full bg-brand-bg safe-area-top pb-24 space-y-6">
                
                <!-- HEADER -->
                <div class="px-6 pt-6 flex justify-between items-center bg-brand-bg sticky top-0 z-20 pb-4 border-b border-white/5 backdrop-blur-md">
                    <div>
                        <p class="text-xs text-gray-400 font-medium uppercase tracking-wider">Dashboard</p>
                        <h1 class="text-2xl font-bold text-white leading-none mt-1">Visão Geral</h1>
                    </div>
                    <div class="flex items-center gap-3">
                         <button onclick="window.app.togglePrivacy()" class="text-gray-400 hover:text-white transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <div class="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-xs cursor-pointer hover:bg-brand-gold/30 transition">
                            ${user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    </div>
                </div>

                <!-- 1. TOTAL BALANCE CARD -->
                <div class="px-6">
                    <div class="bg-gradient-to-br from-brand-surface to-brand-surface-light rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
                         <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-32 w-32 text-brand-gold" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                            </svg>
                         </div>
                         <div class="relative z-10">
                            <p class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Patrimônio Total</p>
                            <h2 class="text-4xl font-black text-white tracking-tight value-sensitive">
                                ${totalNetWorth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </h2>
                            <div class="mt-4 flex gap-4 text-xs font-medium text-gray-400">
                                <span>🏦 Contas: <span class="text-white value-sensitive">${walletBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                <span>📈 Invest: <span class="text-white value-sensitive">${investmentsBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                            </div>
                         </div>
                    </div>
                </div>

                <!-- 2. MONTHLY SUMMARY WIDGET -->
                <div class="px-6 grid grid-cols-2 gap-3">
                    <div class="bg-brand-surface/50 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                         <div class="w-8 h-8 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                         </div>
                         <div>
                             <p class="text-[10px] text-gray-400 uppercase font-bold">Receitas</p>
                             <p class="text-lg font-bold text-white value-sensitive">${((summaryStats.income || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                    </div>
                    <div class="bg-brand-surface/50 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                         <div class="w-8 h-8 rounded-full bg-brand-red/20 text-brand-red flex items-center justify-center mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                         </div>
                         <div>
                             <p class="text-[10px] text-gray-400 uppercase font-bold">Despesas</p>
                             <p class="text-lg font-bold text-white value-sensitive">${((summaryStats.expense || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                    </div>
                </div>

                <!-- 3. FINANCIAL HISTORY (Chart) -->
                <div class="px-6">
                    <h3 class="text-sm font-bold text-gray-300 uppercase mb-3 px-1">Histórico (6 Meses)</h3>
                    <div class="bg-brand-surface p-4 rounded-2xl border border-white/5 h-48 flex items-end justify-between gap-2 overflow-hidden relative">
                        <!-- Horizontal Grid Lines -->
                        <div class="absolute inset-0 flex flex-col justify-between pointer-events-none p-4 opacity-10">
                            <div class="border-t border-white"></div>
                            <div class="border-t border-white"></div>
                            <div class="border-t border-white"></div>
                        </div>

                        ${historyData.map(month => {
            const maxVal = Math.max(...historyData.map(h => Math.max(h.income, h.expense))) || 1;
            const hIncome = (month.income / maxVal) * 100;
            const hExpense = (month.expense / maxVal) * 100;

            return `
                                <div class="flex flex-col items-center justify-end h-full flex-1 gap-1">
                                    <div class="w-full flex gap-1 items-end justify-center h-full">
                                        <div class="w-2 bg-brand-green/80 rounded-t-sm transition-all hover:bg-brand-green" style="height: ${Math.max(hIncome, 5)}%"></div>
                                        <div class="w-2 bg-brand-red/80 rounded-t-sm transition-all hover:bg-brand-red" style="height: ${Math.max(hExpense, 5)}%"></div>
                                    </div>
                                    <span class="text-[9px] text-gray-500 font-bold uppercase">${month.label}</span>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>

                <!-- 4. CATEGORY BREAKDOWN -->
                <div class="px-6">
                    <div class="flex justify-between items-center mb-3 px-1">
                         <h3 class="text-sm font-bold text-gray-300 uppercase">Top Categorias</h3>
                         <button onclick="window.app.navigateTo('settings')" class="text-[10px] text-brand-gold font-bold uppercase hover:underline">Gerenciar Tags</button>
                    </div>
                    <div class="bg-brand-surface rounded-2xl border border-white/5 overflow-hidden">
                        ${categoriesData.length > 0 ? categoriesData.map(cat => `
                            <div class="p-4 border-b border-white/5 last:border-0 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs" style="background-color: ${cat.color}20; color: ${cat.color}">
                                        ${cat.icon.includes('fa-') ? '<i class="' + cat.icon + '"></i>' : cat.icon}
                                    </div>
                                    <div>
                                        <p class="text-sm font-bold text-white">${cat.name}</p>
                                        <div class="w-24 h-1.5 bg-gray-700/50 rounded-full mt-1 overflow-hidden">
                                            <div class="h-full rounded-full" style="width: ${cat.percentage}%; background-color: ${cat.color}"></div>
                                        </div>
                                    </div>
                                </div>
                                <span class="text-xs font-bold text-gray-300 value-sensitive">${(cat.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        `).join('') : '<div class="p-4 text-center text-gray-500 text-xs">Sem dados para este mês.</div>'}
                    </div>
                </div>

                <!-- 5. RECENT TRANSACTIONS -->
                <div class="px-6 pb-6">
                    <div class="flex justify-between items-center mb-3 px-1">
                        <h3 class="text-sm font-bold text-gray-300 uppercase">Últimas Transações</h3>
                        <button onclick="window.app.navigateTo('wallet')" class="text-[10px] text-brand-gold font-bold uppercase hover:underline">Ver Todas</button>
                    </div>
                    <div class="space-y-3">
                        ${recentTransactions.map(t => {
            const isExpense = t.type === 'expense';
            const colorClass = isExpense ? 'text-brand-red' : 'text-brand-green';
            const sign = isExpense ? '-' : '+';
            return `
                                <div class="bg-brand-surface p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-lg">
                                            ${t.category_icon && !t.category_icon.includes('fa-') ? t.category_icon : '💸'}
                                        </div>
                                        <div>
                                            <p class="text-sm font-bold text-white truncate max-w-[150px]">${t.description}</p>
                                            <p class="text-[10px] text-gray-500">${new Date(t.date).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold ${colorClass} value-sensitive">${sign} ${(parseFloat(t.amount) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
                
                <!-- MODAL (Integrated for Quick Actions) -->
                ${this.renderModalID()}
            </div>
        `;

        this.addModalListeners(container);
    },

    getLast6MonthsHistory() {
        const history = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const month = d.getMonth();
            const year = d.getFullYear();
            const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

            const stats = TransactionService.getFinancialStatement(month, year, this.currentContext === 'all' ? undefined : this.currentContext);
            history.push({
                label,
                income: stats.revenue,
                expense: stats.expenses
            });
        }
        return history;
    },

    getCategoryBreakdown(month, year) {
        // Filter transactions for specific month/year and type=expense
        let txs = TransactionService.transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === month &&
                d.getFullYear() === year &&
                t.type === 'expense';
        });

        if (this.currentContext !== 'all') {
            txs = txs.filter(t => t.context === this.currentContext);
        }

        const totalExpense = txs.reduce((acc, t) => acc + parseFloat(t.amount), 0);
        if (totalExpense === 0) return [];

        // Group by Category Name
        const map = {};
        txs.forEach(t => {
            const catName = t.category_name || 'Geral'; // Assuming join was done or name provided
            // NOTE: TransactionService usually provides category_name if joined. If not, might be ID. 
            // In wallet.js we saw `t.category_name`. Assuming it's available.

            if (!map[catName]) {
                map[catName] = {
                    name: catName,
                    total: 0,
                    color: t.category_color || '#6B7280',
                    icon: t.category_icon || '🏷️'
                };
            }
            map[catName].total += parseFloat(t.amount);
        });

        const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);

        return sorted.map(c => ({
            ...c,
            percentage: ((c.total / totalExpense) * 100).toFixed(0)
        }));
    },

    renderModalID() {
        const isBusiness = this.currentContext === 'business';
        const partners = PartnersService.partners;

        return `
            <div id="dashboard-tx-modal" class="fixed inset-0 z-50 hidden">
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity duration-300" id="close-dash-modal-overlay"></div>
                
                <div class="absolute bottom-0 w-full bg-brand-surface border-t border-white/10 rounded-t-[2.5rem] p-6 pb-8 animate-slide-up shadow-2xl h-[85vh] flex flex-col">
                    <div class="w-12 h-1 bg-gray-700/50 rounded-full mx-auto mb-6 shrink-0"></div>
                    
                    <div class="flex justify-between items-center mb-4 shrink-0">
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                             Nova Operação
                        </h3>
                        <button class="bg-white/5 rounded-full p-2 text-gray-400 hover:text-white transition" id="close-dash-modal-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    <form id="dash-tx-form" class="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-1">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Valor</label>
                            <div class="relative group">
                                <span class="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 text-2xl font-light group-focus-within:text-brand-green-light transition">R$</span>
                                <input type="number" step="0.01" name="amount" id="dash-amount-input" required 
                                    class="w-full bg-transparent text-5xl font-black text-white border-none focus:ring-0 pl-10 placeholder-gray-800 p-0 caret-brand-green" 
                                    placeholder="0,00">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <label class="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-brand-bg/30 cursor-pointer overflow-hidden group hover:bg-brand-bg/50 transition">
                                <input type="radio" name="type" value="income" class="peer hidden">
                                <div class="absolute inset-0 border-2 border-brand-green opacity-0 peer-checked:opacity-100 rounded-2xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-brand-green/20 text-brand-green mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                </div>
                                <span class="font-bold text-sm text-gray-400 peer-checked:text-brand-green transition">Entrada</span>
                            </label>
                             <label class="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-brand-bg/30 cursor-pointer overflow-hidden group hover:bg-brand-bg/50 transition">
                                <input type="radio" name="type" value="expense" class="peer hidden" checked>
                                <div class="absolute inset-0 border-2 border-brand-red opacity-0 peer-checked:opacity-100 rounded-2xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-brand-red/20 text-brand-red mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                </div>
                                <span class="font-bold text-sm text-gray-400 peer-checked:text-brand-red transition">Saída</span>
                            </label>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Descrição</label>
                            <input type="text" name="description" id="dash-desc-input" required 
                                class="w-full bg-brand-bg/50 rounded-2xl border border-white/5 p-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none transition placeholder-gray-600 font-medium"
                                placeholder="O que foi isso?">
                        </div>

                         <!-- Dynamic Fields based on global context would be ideal, but for Quick Action we simplify -->
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Categoria / Contexto</label>
                            <select name="category" class="w-full bg-brand-bg/50 rounded-2xl border border-white/5 p-4 text-white focus:border-brand-green outline-none appearance-none">
                                <option value="general">Geral</option>
                                <option value="food">Alimentação</option>
                                <option value="transport">Transporte / Uber</option>
                                <option value="leisure">Lazer</option>
                                <option value="bills">Contas Fixas</option>
                                <option value="investment">Investimento 📈</option>
                            </select>
                        </div>

                        ${partners.length > 0 ? `
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Vincular a Parceiro (Opcional)</label>
                            <select name="partner_id" class="w-full bg-brand-bg/50 rounded-2xl border border-white/5 p-4 text-white focus:border-brand-green outline-none appearance-none">
                                <option value="" selected>Nenhum</option>
                                ${partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}

                        <button type="submit" class="w-full bg-gradient-to-r from-brand-green to-brand-green-light text-white font-bold text-lg py-4 rounded-2xl shadow-glow-green active:scale-[0.98] transition mt-6">
                            Confirmar Lançamento
                        </button>
                    </form>
                </div>
            </div>
        `;
    },

    addModalListeners(container) {
        const modal = document.getElementById('dashboard-tx-modal');
        const form = document.getElementById('dash-tx-form');
        const closeBtn = document.getElementById('close-dash-modal-btn');
        const overlay = document.getElementById('close-dash-modal-overlay');

        const closeModal = () => modal.classList.add('hidden');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);

                // Determine context based on basic logic or current dashboard state
                // If partner selected, likely business.
                const partnerId = formData.get('partner_id');
                const context = partnerId ? 'business' : this.currentContext;

                const newTx = {
                    amount: parseFloat(formData.get('amount')),
                    description: formData.get('description'),
                    type: formData.get('type'),
                    date: new Date().toISOString(),
                    context: context,
                    partner_id: partnerId || null,
                    status: 'paid', // Quick action assumes paid usually
                    category: formData.get('category') || 'general'
                };

                try {
                    await TransactionService.create(newTx);
                    closeModal();
                    form.reset();
                    this.render(); // Refresh dashboard
                    Toast.show('Lançamento realizado com sucesso!', 'success');
                } catch (error) {
                    Toast.show('Erro: ' + error.message, 'error');
                }
            });
        }
    }
};

// Expose functions to window
window.app = window.app || {};
window.app.toggleDashboardContext = (ctx) => {
    DashboardModule.currentContext = ctx;
    DashboardModule.render();
};

window.app.openTransactionModal = (type = 'income', presets = {}) => {
    const modal = document.getElementById('dashboard-tx-modal');
    if (!modal) return;

    // Set type
    const typeInput = document.querySelector(`input[name="type"][value="${type}"]`);
    if (typeInput) typeInput.checked = true;

    // Set presets
    if (presets.description) {
        document.getElementById('dash-desc-input').value = presets.description;
    }

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('dash-amount-input').focus(), 100);
};

