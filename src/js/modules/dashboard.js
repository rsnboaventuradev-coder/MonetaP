import { TransactionService } from '../services/transaction.service.js';
import { InvestmentsService } from '../services/investments.service.js';
import { PartnersService } from '../services/partners.service.js';
import { GoalsService } from '../services/goals.service.js';
import { BudgetService } from '../services/budget.service.js';
import { AccountsService } from '../services/accounts.service.js';
import { GamificationService } from '../services/gamification.service.js';
import { SupabaseService } from '../services/supabase.service.js';

export const DashboardModule = {
    currentContext: 'personal', // 'personal' | 'business'
    chartInstances: {},

    unsubscribers: [],

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return; // Null Check to prevent race condition

        // 1. Initial Guard
        if (window.app.currentView !== 'dashboard') return;

        // Clean up old listeners
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];

        // Show Skeleton while loading (Sync operation, safe)
        this.renderSkeleton(container);

        try {
            // 2. Async Init
            await Promise.all([
                TransactionService.init(),
                InvestmentsService.init(),
                PartnersService.init(),
                GoalsService.init(),
                BudgetService.init(),
                AccountsService.init()
            ]);

            // 3. Guard after await
            if (window.app.currentView !== 'dashboard') return;

            // Subscribe to changes
            this.unsubscribers.push(TransactionService.subscribe(() => this.refreshView()));
            this.unsubscribers.push(InvestmentsService.subscribe(() => this.refreshView()));
            this.unsubscribers.push(GoalsService.subscribe(() => this.refreshView()));
            this.unsubscribers.push(AccountsService.subscribe(() => this.refreshView()));

            // 4. Render Content
            if (window.app.currentView === 'dashboard') {
                await this.renderView(container);
            }

        } catch (error) {
            console.error('Dashboard Render Error:', error);
            if (window.app.currentView === 'dashboard') {
                Toast.show('Erro ao carregar dashboard', 'error');
            }
        }
    },

    renderSkeleton(container) {
        container.innerHTML = `
            <div class="flex flex-col min-h-full bg-brand-bg safe-area-top pb-24 space-y-6 animate-pulse">
                <!-- Header Skeleton -->
                <div class="px-6 pt-6 flex justify-between items-center">
                    <div class="space-y-2">
                        <div class="h-3 w-20 bg-brand-surface-light rounded"></div>
                        <div class="h-8 w-40 bg-brand-surface-light rounded"></div>
                    </div>
                </div>

                <!-- Balance Card Skeleton -->
                <div class="px-6">
                    <div class="h-48 bg-brand-surface-light rounded-3xl"></div>
                </div>

                <!-- Widgets Skeleton -->
                <div class="px-6 grid grid-cols-2 gap-4">
                    <div class="h-32 bg-brand-surface-light rounded-2xl"></div>
                    <div class="h-32 bg-brand-surface-light rounded-2xl"></div>
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
        const walletBalance = AccountsService.getTotalBalance() / 100; // Contas em centavos
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
                <div class="px-6 pt-6 flex justify-between items-center bg-brand-bg sticky top-0 z-20 pb-4 border-b border-brand-border backdrop-blur-md">
                    <div>
                        <p class="text-xs text-brand-text-secondary font-medium uppercase tracking-wider">Dashboard</p>
                        <h1 class="text-2xl font-bold text-brand-text-primary leading-none mt-1">Visão Geral</h1>
                    </div>
                    <div class="flex items-center gap-3">
                         <button onclick="window.app.togglePrivacy()" class="text-brand-text-secondary hover:text-brand-text-primary transition">
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
                    <div class="bg-gradient-to-br from-brand-surface to-brand-surface-light rounded-3xl p-6 border border-brand-border shadow-2xl relative overflow-hidden group">
                         <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-32 w-32 text-brand-gold" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                            </svg>
                         </div>
                         <div class="relative z-10">
                            <p class="text-brand-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Patrimônio Total</p>
                            <h2 class="text-4xl font-black text-brand-text-primary tracking-tight value-sensitive">
                                ${totalNetWorth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </h2>
                            <div class="mt-4 flex gap-4 text-xs font-medium text-brand-text-secondary">
                                <span>🏦 Contas: <span class="text-brand-text-primary value-sensitive">${walletBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                <span>📈 Invest: <span class="text-brand-text-primary value-sensitive">${investmentsBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                            </div>
                         </div>
                    </div>
                </div>

                <!-- 2. MONTHLY SUMMARY WIDGET -->
                <div class="px-6 grid grid-cols-2 gap-3">
                    <div class="bg-brand-surface/50 p-4 rounded-2xl border border-brand-border shadow-card-sm hover:shadow-md hover:border-brand-green/30 transition-all flex flex-col justify-between cursor-pointer">
                         <div class="w-8 h-8 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                         </div>
                         <div>
                             <p class="text-[10px] text-brand-text-secondary uppercase font-bold">Receitas</p>
                             <p class="text-lg font-bold text-brand-text-primary value-sensitive">${((summaryStats.income || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                    </div>
                    <div class="bg-brand-surface/50 p-4 rounded-2xl border border-brand-border shadow-card-sm hover:shadow-md hover:border-brand-red/30 transition-all flex flex-col justify-between cursor-pointer">
                         <div class="w-8 h-8 rounded-full bg-brand-red/20 text-brand-red flex items-center justify-center mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                         </div>
                         <div>
                             <p class="text-[10px] text-brand-text-secondary uppercase font-bold">Despesas</p>
                             <p class="text-lg font-bold text-brand-text-primary value-sensitive">${((summaryStats.expense || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                    </div>
                </div>

                <!-- 2.5 EMERGENCY FUND CARD -->
                ${this.renderEmergencyFundCard(avgCostOfLiving)}

                <!-- 2.6 UPCOMING EXPENSES ALERT -->
                ${await this.renderUpcomingExpenses()}

                <!-- 3. FINANCIAL HISTORY (Chart) -->
                <div class="px-6">
                    <h3 class="text-sm font-bold text-brand-text-secondary uppercase mb-3 px-1">Histórico (6 Meses)</h3>
                    <div class="bg-brand-surface p-4 rounded-2xl border border-brand-border h-48 flex items-end justify-between gap-2 overflow-hidden relative shadow-card-sm">
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
                                    <span class="text-[9px] text-brand-text-secondary font-bold uppercase">${month.label}</span>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>

                <!-- 4. CATEGORY BREAKDOWN -->
                <div class="px-6">
                    <div class="flex justify-between items-center mb-3 px-1">
                         <h3 class="text-sm font-bold text-brand-text-secondary uppercase">Top Categorias</h3>
                         <button onclick="window.app.navigateTo('settings')" class="text-[10px] text-brand-gold font-bold uppercase hover:underline">Gerenciar Tags</button>
                    </div>
                    <div class="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden shadow-card-sm">
                        ${categoriesData.length > 0 ? categoriesData.map(cat => `
                            <div class="p-4 border-b border-brand-border last:border-0 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs" style="background-color: ${cat.color}20; color: ${cat.color}">
                                        ${cat.icon.includes('fa-') ? '<i class="' + cat.icon + '"></i>' : cat.icon}
                                    </div>
                                    <div>
                                        <p class="text-sm font-bold text-brand-text-primary">${cat.name}</p>
                                        <div class="w-24 h-1.5 bg-brand-surface-light rounded-full mt-1 overflow-hidden">
                                            <div class="h-full rounded-full" style="width: ${cat.percentage}%; background-color: ${cat.color}"></div>
                                        </div>
                                    </div>
                                </div>
                                <span class="text-xs font-bold text-brand-text-secondary value-sensitive">${(cat.total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        `).join('') : '<div class="p-4 text-center text-brand-text-secondary text-xs">Sem dados para este mês.</div>'}
                    </div>
                </div>

                <!-- 5. RECENT TRANSACTIONS -->
                <div class="px-6 pb-6">
                    <div class="flex justify-between items-center mb-3 px-1">
                        <h3 class="text-sm font-bold text-brand-text-secondary uppercase">Últimas Transações</h3>
                        <button onclick="window.app.navigateTo('wallet')" class="text-[10px] text-brand-gold font-bold uppercase hover:underline">Ver Todas</button>
                    </div>
                    <div class="space-y-3">
                        ${recentTransactions.map(t => {
            const isExpense = t.type === 'expense';
            const colorClass = isExpense ? 'text-brand-red' : 'text-brand-green';
            const sign = isExpense ? '-' : '+';
            return `
                                <div class="bg-brand-surface p-4 rounded-2xl border border-brand-border flex items-center justify-between shadow-card-sm">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-brand-surface-light flex items-center justify-center text-lg">
                                            ${t.category_icon && !t.category_icon.includes('fa-') ? t.category_icon : '💸'}
                                        </div>
                                        <div>
                                            <p class="text-sm font-bold text-brand-text-primary truncate max-w-[150px]">${t.description}</p>
                                            <p class="text-[10px] text-brand-text-secondary">${new Date(t.date).toLocaleDateString('pt-BR')}</p>
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

    renderEmergencyFundCard(monthlyCost) {
        const emergencyStatus = AccountsService.getEmergencyFundStatus(monthlyCost, 6);

        if (emergencyStatus.accountsCount === 0) {
            return `
                <div class="px-6">
                    <div class="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-3xl p-6">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-brand-text-primary">Reserva de Emergência</h3>
                                <p class="text-xs text-brand-text-secondary">Proteja seu futuro financeiro</p>
                            </div>
                        </div>
                        <p class="text-xs text-brand-text-secondary mb-3">Marque contas como reserva de emergência em Investimentos → Contas</p>
                        <button onclick="window.app.navigateTo('investments')" class="text-xs bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition font-bold">
                            Configurar Agora
                        </button>
                    </div>
                </div>
            `;
        }

        const currentFormatted = (emergencyStatus.currentAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const goalFormatted = (emergencyStatus.goalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const progressColor = emergencyStatus.isComplete ? 'from-green-500 to-green-400' : 'from-blue-500 to-blue-400';
        const borderColor = emergencyStatus.isComplete ? 'border-green-500/30' : 'border-blue-500/30';

        return `
            <div class="px-6">
                <div class="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border ${borderColor} rounded-3xl p-6 relative overflow-hidden">
                    ${emergencyStatus.isComplete ? '<div class="absolute top-2 right-2 text-2xl animate-bounce">🎉</div>' : ''}
                    
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <div class="flex items-center gap-2 mb-2">
                                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                <p class="text-xs text-blue-400 uppercase tracking-widest font-bold">Reserva de Emergência</p>
                            </div>
                            <h3 class="text-3xl font-black text-brand-text-primary value-sensitive">${currentFormatted}</h3>
                            <p class="text-xs text-brand-text-secondary mt-1">Meta: ${goalFormatted} (6 meses)</p>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-black ${emergencyStatus.isComplete ? 'text-green-400' : 'text-blue-400'}">${emergencyStatus.progress}%</div>
                            <p class="text-[10px] text-brand-text-secondary">${emergencyStatus.accountsCount} conta(s)</p>
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="relative h-3 bg-black/30 rounded-full overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-r ${progressColor} transition-all duration-500" style="width: ${emergencyStatus.progress}%"></div>
                    </div>
                    
                    ${emergencyStatus.isComplete
                ? '<p class="text-xs text-green-400 font-bold mt-3">✅ Meta alcançada! Você está protegido.</p>'
                : `<p class="text-xs text-brand-text-secondary mt-3">Faltam ${((emergencyStatus.goalAmount - emergencyStatus.currentAmount) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para atingir a meta</p>`
            }
                </div>
            </div>
        `;
    },

    async renderUpcomingExpenses() {
        const recurring = await TransactionService.getRecurringDefinitions();
        if (recurring.length === 0) return '';

        const today = new Date();
        const currentDay = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        // Find subscriptions due in the next 7 days
        const upcoming = recurring.filter(r => {
            const dueDay = r.day_of_month;
            // Calculate days until due
            let daysUntil;
            if (dueDay >= currentDay) {
                daysUntil = dueDay - currentDay;
            } else {
                // Next month
                daysUntil = (daysInMonth - currentDay) + dueDay;
            }
            return daysUntil <= 7 && daysUntil >= 0;
        }).sort((a, b) => a.day_of_month - b.day_of_month);

        if (upcoming.length === 0) return '';

        return `
            <div class="px-6">
                <div class="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-3xl p-5">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-brand-text-primary">📅 Próximos Vencimentos</h3>
                                <p class="text-[10px] text-brand-text-secondary">Despesas chegando nos próximos 7 dias</p>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-2">
                        ${upcoming.map(r => {
            const dueDay = r.day_of_month;
            const daysUntil = dueDay >= currentDay ? dueDay - currentDay : (daysInMonth - currentDay) + dueDay;
            const urgencyClass = daysUntil <= 2 ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-orange-500/10 border-orange-500/20';
            const urgencyText = daysUntil === 0 ? '⚠️ HOJE' : daysUntil === 1 ? '⏰ Amanhã' : `Em ${daysUntil} dias`;

            return `
                                <div class="flex items-center justify-between p-3 rounded-xl border ${urgencyClass}">
                                    <div class="flex items-center gap-3">
                                        <input type="checkbox" 
                                            class="w-5 h-5 rounded accent-green-500 cursor-pointer" 
                                            onclick="window.app.markSubscriptionPaid('${r.id}', '${r.description}', ${r.amount})"
                                            title="Marcar como pago">
                                        <div>
                                            <p class="text-sm font-bold text-brand-text-primary">${r.description}</p>
                                            <p class="text-[10px] text-brand-text-secondary">📆 Dia ${r.day_of_month} • ${urgencyText}</p>
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold text-brand-text-primary value-sensitive">
                                        R$ ${(r.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `;
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
                
                <div class="absolute bottom-0 w-full bg-brand-surface border-t border-brand-border rounded-t-[2.5rem] p-6 pb-8 animate-slide-up shadow-2xl h-[85vh] flex flex-col">
                    <div class="w-12 h-1 bg-brand-surface-light rounded-full mx-auto mb-6 shrink-0"></div>
                    
                    <div class="flex justify-between items-center mb-4 shrink-0">
                        <h3 class="text-xl font-bold text-brand-text-primary flex items-center gap-2">
                             Nova Operação
                        </h3>
                        <button class="bg-brand-surface-light rounded-full p-2 text-brand-text-secondary hover:text-brand-text-primary transition" id="close-dash-modal-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    <form id="dash-tx-form" class="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-1">
                        <div>
                            <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Valor</label>
                            <div class="relative group">
                                <span class="absolute left-0 top-1/2 -translate-y-1/2 text-brand-text-secondary text-2xl font-light group-focus-within:text-brand-green-light transition">R$</span>
                                <input type="number" step="0.01" name="amount" id="dash-amount-input" required 
                                    class="w-full bg-transparent text-5xl font-black text-brand-text-primary border-none focus:ring-0 pl-10 placeholder-gray-800 p-0 caret-brand-green" 
                                    placeholder="0,00">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <label class="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-brand-border bg-brand-bg/30 cursor-pointer overflow-hidden group hover:bg-brand-bg/50 transition">
                                <input type="radio" name="type" value="income" class="peer hidden">
                                <div class="absolute inset-0 border-2 border-brand-green opacity-0 peer-checked:opacity-100 rounded-2xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-brand-green/20 text-brand-green mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                </div>
                                <span class="font-bold text-sm text-brand-text-secondary peer-checked:text-brand-green transition">Entrada</span>
                            </label>
                             <label class="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-brand-border bg-brand-bg/30 cursor-pointer overflow-hidden group hover:bg-brand-bg/50 transition">
                                <input type="radio" name="type" value="expense" class="peer hidden" checked>
                                <div class="absolute inset-0 border-2 border-brand-red opacity-0 peer-checked:opacity-100 rounded-2xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-brand-red/20 text-brand-red mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                </div>
                                <span class="font-bold text-sm text-brand-text-secondary peer-checked:text-brand-red transition">Saída</span>
                            </label>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Descrição</label>
                            <input type="text" name="description" id="dash-desc-input" required 
                                class="w-full bg-[#27272a] rounded-2xl border border-brand-border p-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none transition placeholder-gray-500 font-medium"
                                placeholder="O que foi isso?">
                        </div>

                         <!-- Dynamic Fields based on global context would be ideal, but for Quick Action we simplify -->
                        <div>
                            <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Categoria / Contexto</label>
                            <select name="category" class="w-full bg-[#27272a] rounded-2xl border border-brand-border p-4 text-white focus:border-brand-green outline-none appearance-none">
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
                            <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Vincular a Parceiro (Opcional)</label>
                            <select name="partner_id" class="w-full bg-[#27272a] rounded-2xl border border-brand-border p-4 text-white focus:border-brand-green outline-none appearance-none">
                                <option value="" selected>Nenhum</option>
                                ${partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}

                        <button type="submit" class="w-full bg-gradient-to-r from-brand-green to-brand-green-light text-brand-text-primary font-bold text-lg py-4 rounded-2xl shadow-glow-green active:scale-[0.98] transition mt-6">
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

// Mark a subscription as paid - auto-create transaction
window.app.markSubscriptionPaid = async (recurringId, description, amount) => {
    try {
        const today = new Date();

        // Create the transaction as a paid expense
        await TransactionService.create({
            amount: amount / 100, // Convert from cents to reais for the create function
            description: `${description} (Assinatura)`,
            type: 'expense',
            date: today.toISOString(),
            context: 'personal',
            status: 'paid',
            category: 'bills', // Fixed expenses category
            recurring_origin_id: recurringId // Track which subscription generated this
        });

        Toast.show(`✅ "${description}" registrado como pago!`, 'success');

        // Refresh the dashboard
        DashboardModule.render();
    } catch (error) {
        console.error('Error marking subscription as paid:', error);
        Toast.show('Erro ao registrar pagamento: ' + error.message, 'error');
    }
};




