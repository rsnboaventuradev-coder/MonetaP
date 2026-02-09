import { TransactionService } from '../services/transaction.service.js';
import { InvestmentsService } from '../services/investments.service.js';
import { PartnersService } from '../services/partners.service.js';
import { GoalsService } from '../services/goals.service.js';
import { BudgetService } from '../services/budget.service.js';
import { AccountsService } from '../services/accounts.service.js';
import { GamificationService } from '../services/gamification.service.js';
import { SupabaseService } from '../services/supabase.service.js';
import { ReportsService } from '../services/reports.service.js';

export const DashboardModule = {
    currentContext: 'personal', // 'personal' | 'business'
    selectedDate: new Date(),
    chartInstances: {},

    unsubscribers: [],

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return; // Null Check to prevent race condition

        // 1. Initial Guard
        if (window.app.currentView !== 'dashboard') return;

        // Clean up old listeners and charts
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];

        // Destroy old chart instances to prevent leaks
        if (this.chartInstances) {
            Object.values(this.chartInstances).forEach(chart => chart.destroy());
        }
        this.chartInstances = {};

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

            // Render Onboarding Carousel if needed
            setTimeout(() => {
                if (window.OnboardingModule && typeof window.OnboardingModule.renderCarouselWidget === 'function') {
                    window.OnboardingModule.renderCarouselWidget('onboarding-carousel-container');
                }
            }, 100);

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

        // Fetch Profile for Cost of Living and Name
        let avgCostOfLiving = 5000;
        let userName = 'Usuário';

        if (user) {
            const { data: profile } = await SupabaseService.client
                .from('profiles')
                .select('monthly_income,full_name')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                if (profile.monthly_income) avgCostOfLiving = parseFloat(profile.monthly_income);
                // Priority: Full Name > Email > 'Usuário'
                userName = profile.full_name || (user.email ? user.email.split('@')[0] : 'Usuário');
            } else {
                userName = user.email ? user.email.split('@')[0] : 'Usuário';
            }
        }

        // Format First Name
        const firstName = userName.split(' ')[0];

        const currentMonth = this.selectedDate.getMonth();
        const currentYear = this.selectedDate.getFullYear();
        const monthLabel = this.selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        // 1. BALANCES
        const walletBalance = AccountsService.getTotalBalance() / 100; // Contas em centavos
        const investmentsBalance = InvestmentsService.getTotalValue();
        const totalNetWorth = walletBalance + investmentsBalance;

        // 2. MONTHLY SUMMARY (Income vs Expense)
        // Assuming currentContext affects what we show.
        const summaryStats = TransactionService.getFinancialStatement(currentMonth, currentYear, this.currentContext === 'all' ? undefined : this.currentContext);

        // 5. RECENT TRANSACTIONS
        const recentTransactions = TransactionService.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);


        // --- HTML CONSTRUCTION ---
        container.innerHTML = `
            <div class="dashboard-container flex flex-col min-h-full bg-background-light dark:bg-background-dark safe-area-top pb-24 space-y-6 transition-colors duration-300">
                
                <!-- HEADER -->
                <div class="px-6 pt-6 flex justify-between items-center bg-background-light/80 dark:bg-background-dark/80 sticky top-0 z-20 pb-4 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md transition-colors duration-300">
                    <div onclick="window.app.navigateTo('settings')" class="cursor-pointer group">
                        <p class="text-xs text-text-secondary_light dark:text-text-secondary_dark font-medium uppercase tracking-wider group-hover:text-brand-500 transition-colors">Olá, ${firstName}</p>
                        <h1 class="text-2xl font-bold text-text-primary_light dark:text-text-primary_dark leading-none mt-1 group-hover:text-brand-500 transition-colors">Visão Geral</h1>
                    </div>
                    <div class="flex items-center gap-3">
                         <button onclick="window.app.togglePrivacy()" class="text-text-secondary_light dark:text-text-secondary_dark hover:text-text-primary_light dark:hover:text-text-primary_dark transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <div onclick="window.app.navigateTo('settings')" class="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold font-bold text-xs cursor-pointer hover:bg-accent-gold/30 transition shadow-sm">
                            ${firstName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>

                <!-- MONTH SELECTOR -->
                <div class="px-6 flex items-center justify-between">
                    <button onclick="window.app.changeDashboardMonth(-1)" class="w-10 h-10 rounded-full bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 flex items-center justify-center text-text-secondary_light dark:text-text-secondary_dark hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-text-primary_light dark:hover:text-text-primary_dark transition shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <span class="text-sm font-black text-text-primary_light dark:text-text-primary_dark uppercase tracking-widest bg-background-card_light dark:bg-background-card_dark px-6 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                        ${monthLabel}
                    </span>
                    <button onclick="window.app.changeDashboardMonth(1)" class="w-10 h-10 rounded-full bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 flex items-center justify-center text-text-secondary_light dark:text-text-secondary_dark hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-text-primary_light dark:hover:text-text-primary_dark transition shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>

                <!-- ONBOARDING CAROUSEL WIDGET -->
                <div id="onboarding-carousel-container" class="pl-6 empty:hidden animate-fade-in-up"></div>

                <!-- 1. TOTAL BALANCE CARD -->
                <div class="px-6">
                    <div class="bg-gradient-to-br from-background-card_light via-white to-slate-50 dark:from-background-card_dark dark:via-background-card_dark dark:to-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none relative overflow-hidden group">
                         <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-32 w-32 text-brand-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                            </svg>
                         </div>
                         <div class="relative z-10">
                            <p class="text-text-secondary_light dark:text-text-secondary_dark text-xs font-bold uppercase tracking-wider mb-2">Patrimônio Total</p>
                            <h2 class="text-4xl font-black text-text-primary_light dark:text-text-primary_dark tracking-tight value-sensitive">
                                ${totalNetWorth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </h2>
                            <div class="mt-4 flex gap-4 text-xs font-medium text-text-secondary_light dark:text-text-secondary_dark">
                                <span class="flex items-center gap-1">🏦 Contas: <span class="text-text-primary_light dark:text-text-primary_dark value-sensitive font-bold">${walletBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                                <span class="flex items-center gap-1">📈 Invest: <span class="text-text-primary_light dark:text-text-primary_dark value-sensitive font-bold">${investmentsBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                            </div>
                         </div>
                    </div>
                </div>

                <!-- 2. MONTHLY SUMMARY WIDGET -->
                <div class="px-6 grid grid-cols-2 gap-3">
                    <div class="bg-background-card_light dark:bg-background-card_dark p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group">
                         <div class="w-8 h-8 rounded-lg bg-accent-success/10 text-accent-success flex items-center justify-center mb-3 group-hover:bg-accent-success/20 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                         </div>
                         <div>
                             <p class="text-[10px] text-text-secondary_light dark:text-text-secondary_dark uppercase font-bold tracking-wide">Receitas</p>
                             <p class="text-lg font-bold text-text-primary_light dark:text-text-primary_dark value-sensitive mt-0.5">${((summaryStats.income || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                    </div>
                    <div class="bg-background-card_light dark:bg-background-card_dark p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group">
                         <div class="w-8 h-8 rounded-lg bg-accent-danger/10 text-accent-danger flex items-center justify-center mb-3 group-hover:bg-accent-danger/20 transition">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                         </div>
                         <div>
                             <p class="text-[10px] text-text-secondary_light dark:text-text-secondary_dark uppercase font-bold tracking-wide">Despesas</p>
                             <p class="text-lg font-bold text-text-primary_light dark:text-text-primary_dark value-sensitive mt-0.5">${((summaryStats.expense || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                         </div>
                    </div>
                </div>

                <!-- 2.5 EMERGENCY FUND CARD -->
                ${this.renderEmergencyFundCard(avgCostOfLiving)}

                <!-- 2.6 UPCOMING EXPENSES ALERT -->
                ${await this.renderUpcomingExpenses()}

                <!-- 3. FINANCIAL HISTORY (Chart) -->
                <div class="px-6">
                    <h3 class="text-xs font-bold text-text-secondary_light dark:text-text-secondary_dark uppercase mb-3 px-1 tracking-wider">Fluxo de Caixa (6 Meses)</h3>
                    <div class="bg-background-card_light dark:bg-background-card_dark p-4 rounded-xl border border-slate-200 dark:border-slate-700 h-64 shadow-sm relative">
                         <canvas id="cash-flow-chart"></canvas>
                    </div>
                </div>

                <!-- 4. CATEGORY BREAKDOWN -->
                <div class="px-6">
                    <div class="flex justify-between items-center mb-3 px-1">
                         <h3 class="text-xs font-bold text-text-secondary_light dark:text-text-secondary_dark uppercase tracking-wider">Despesas por Categoria</h3>
                         <button onclick="window.app.navigateTo('settings')" class="text-[10px] text-brand-500 font-bold uppercase hover:underline">Gerenciar Tags</button>
                    </div>
                    <div class="bg-background-card_light dark:bg-background-card_dark p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center relative">
                        <div class="h-64 w-full relative">
                            <canvas id="expenses-chart"></canvas>
                            <!-- Center Text Overlay -->
                            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p class="text-xs text-text-secondary_light dark:text-text-secondary_dark font-medium">Total</p>
                                <p id="expenses-chart-total" class="text-xl font-bold text-text-primary_light dark:text-text-primary_dark">R$ ...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 5. RECENT TRANSACTIONS -->
                <div class="px-6 pb-6">
                    <div class="flex justify-between items-center mb-3 px-1">
                        <h3 class="text-xs font-bold text-text-secondary_light dark:text-text-secondary_dark uppercase tracking-wider">Últimas Transações</h3>
                        <button onclick="window.app.navigateTo('wallet')" class="text-[10px] text-brand-500 font-bold uppercase hover:underline">Ver Todas</button>
                    </div>
                    <div class="space-y-3">
                        ${recentTransactions.map(t => {
            const isExpense = t.type === 'expense';
            const colorClass = isExpense ? 'text-accent-danger' : 'text-accent-success';
            const sign = isExpense ? '-' : '+';
            return `
                                <div class="bg-background-card_light dark:bg-background-card_dark p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-background-light dark:bg-slate-800 flex items-center justify-center text-lg border border-slate-100 dark:border-slate-700">
                                            ${t.category_icon && !t.category_icon.includes('fa-') ? t.category_icon : '💸'}
                                        </div>
                                        <div>
                                            <p class="text-sm font-bold text-text-primary_light dark:text-text-primary_dark truncate max-w-[150px]">${t.description}</p>
                                            <p class="text-[10px] text-text-secondary_light dark:text-text-secondary_dark">${new Date(t.date).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold ${colorClass} value-sensitive">${sign} ${(parseFloat(t.amount) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
                
                <!-- VERSION FOOTER -->
                <div class="px-6 pb-6 text-center">
                    <p class="text-[10px] text-text-secondary_light dark:text-text-secondary_dark uppercase tracking-widest opacity-50">Moneta v1.0.0</p>
                </div>

                <!-- MODAL (Integrated for Quick Actions) -->
                ${this.renderModalID()}
            </div>
        `;

        this.addModalListeners(container);

        // Render Charts after DOM update
        await this.renderCharts(currentMonth, currentYear);
    },

    async renderCharts(month, year) {
        try {
            // --- CASH FLOW CHART ---
            const flowCtx = document.getElementById('cash-flow-chart');
            if (flowCtx) {
                const evolutionData = await ReportsService.getEvolution(6);

                this.chartInstances.cashFlow = new Chart(flowCtx, {
                    type: 'bar',
                    data: {
                        labels: evolutionData.map(d => d.month),
                        datasets: [
                            {
                                label: 'Receitas',
                                data: evolutionData.map(d => d.income / 100), // Convert cents
                                backgroundColor: '#10b981',
                                borderRadius: 4,
                                barPercentage: 0.6,
                                categoryPercentage: 0.8
                            },
                            {
                                label: 'Despesas',
                                data: evolutionData.map(d => d.expense / 100), // Convert cents
                                backgroundColor: '#ef4444',
                                borderRadius: 4,
                                barPercentage: 0.6,
                                categoryPercentage: 0.8
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: function (context) {
                                        return context.dataset.label + ': ' +
                                            context.raw.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                    }
                                },
                                backgroundColor: 'rgba(23, 23, 23, 0.9)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                borderColor: '#333',
                                borderWidth: 1
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false, drawBorder: false },
                                ticks: { color: '#94a3b8', font: { size: 10 } }
                            },
                            y: {
                                grid: { color: '#33415520', drawBorder: false },
                                ticks: { display: false }
                            }
                        },
                        interaction: {
                            mode: 'nearest',
                            axis: 'x',
                            intersect: false
                        }
                    }
                });
            }

            // --- EXPENSES BREAKDOWN CHART ---
            const expenseCtx = document.getElementById('expenses-chart');
            if (expenseCtx) {
                let breakdownData = await ReportsService.getBreakdown('expense', month + 1, year);

                // Grouping Logic: Top 5 + Others
                if (breakdownData.length > 5) {
                    const top5 = breakdownData.slice(0, 5);
                    const others = breakdownData.slice(5);
                    const othersTotal = others.reduce((sum, item) => sum + item.total, 0);

                    if (othersTotal > 0) {
                        top5.push({
                            category: 'Outros',
                            total: othersTotal,
                            color: '#94a3b8', // Slate 400
                            percentage: 0 // Will be calc by chart or ignored
                        });
                    }
                    breakdownData = top5;
                }

                // Update Total Text
                const totalVal = breakdownData.reduce((acc, item) => acc + (item.total || 0), 0);

                const totalEl = document.getElementById('expenses-chart-total');
                if (totalEl) totalEl.textContent = (totalVal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                this.chartInstances.expenses = new Chart(expenseCtx, {
                    type: 'doughnut',
                    data: {
                        labels: breakdownData.map(d => d.category),
                        datasets: [{
                            data: breakdownData.map(d => d.total / 100), // Convert cents
                            backgroundColor: breakdownData.map(d => d.color || '#cbd5e1'),
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '75%',
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: '#94a3b8',
                                    font: { size: 10 },
                                    usePointStyle: true,
                                    boxWidth: 8
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        const val = context.raw;
                                        // Calculate percentage based on displayed data
                                        const tot = context.chart._metasets[context.datasetIndex].total;
                                        const pct = ((val / tot) * 100).toFixed(0);
                                        return context.label + ': ' +
                                            val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) +
                                            ' (' + pct + '%)';
                                    }
                                },
                                backgroundColor: 'rgba(23, 23, 23, 0.9)',
                                bodyColor: '#fff',
                                borderColor: '#333',
                                borderWidth: 1
                            }
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Error rendering charts:', error);
        }
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



    renderModalID() {
        const isBusiness = this.currentContext === 'business';
        const partners = PartnersService.partners;

        return `
            <div id="dashboard-tx-modal" class="fixed inset-0 hidden" style="z-index: 9999;">
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity duration-300" id="close-dash-modal-overlay"></div>
                <div class="fixed bottom-0 left-0 right-0 w-full bg-brand-surface border-t border-brand-border rounded-t-2xl md:rounded-2xl md:border p-0 shadow-2xl max-h-[90vh] flex flex-col md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:min-w-[500px] md:h-auto animate-slide-up md:animate-scale-in">
                    
                    <!-- Drag Handle (Mobile Only) -->
                    <div class="w-12 h-1.5 bg-brand-surface-light rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>

                    <!-- Header -->
                    <div class="p-6 pb-4 border-b border-brand-border flex justify-between items-center shrink-0">
                         <h3 class="text-xl font-bold text-brand-text-primary flex items-center gap-2">
                             🚀 Nova Operação
                        </h3>
                         <button class="bg-brand-surface-light rounded-full p-2 text-brand-text-secondary hover:text-brand-text-primary transition" id="close-dash-modal-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Body (Scrollable) -->
                    <form id="dash-tx-form" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                         <div>
                            <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Valor</label>
                            <div class="relative group">
                                <span class="absolute left-0 top-1/2 -translate-y-1/2 text-brand-text-secondary text-2xl font-light group-focus-within:text-brand-gold transition">R$</span>
                                <input type="number" inputmode="decimal" step="0.01" name="amount" id="dash-amount-input" required 
                                    class="w-full bg-transparent text-5xl font-black text-brand-text-primary border-none focus:ring-0 pl-10 placeholder-brand-surface-light p-0 caret-brand-gold" 
                                    placeholder="0,00">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <label class="relative flex flex-col items-center justify-center p-4 rounded-xl border border-brand-border bg-brand-bg cursor-pointer overflow-hidden group hover:bg-brand-surface-light transition">
                                <input type="radio" name="type" value="income" class="peer hidden">
                                <div class="absolute inset-0 border-2 border-green-500 opacity-0 peer-checked:opacity-100 rounded-xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-green-500/20 text-green-500 mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                </div>
                                <span class="font-bold text-sm text-brand-text-secondary peer-checked:text-green-500 transition">Entrada</span>
                            </label>
                             <label class="relative flex flex-col items-center justify-center p-4 rounded-xl border border-brand-border bg-brand-bg cursor-pointer overflow-hidden group hover:bg-brand-surface-light transition">
                                <input type="radio" name="type" value="expense" class="peer hidden" checked>
                                <div class="absolute inset-0 border-2 border-red-500 opacity-0 peer-checked:opacity-100 rounded-xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-red-500/20 text-red-500 mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                </div>
                                <span class="font-bold text-sm text-brand-text-secondary peer-checked:text-red-500 transition">Saída</span>
                            </label>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Descrição</label>
                            <input type="text" name="description" id="dash-desc-input" required 
                                class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition placeholder-brand-text-secondary font-medium"
                                placeholder="O que foi isso?">
                        </div>

                         <!-- Dynamic Fields based on global context would be ideal, but for Quick Action we simplify -->
                        <div>
                            <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Categoria / Contexto</label>
                            <select name="category" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary focus:border-brand-gold outline-none appearance-none">
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
                            <select name="partner_id" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary focus:border-brand-gold outline-none appearance-none">
                                <option value="" selected>Nenhum</option>
                                ${partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}

                         <div class="pb-32 md:pb-0"></div>
                    </form>

                    <!-- Footer (Fixed) -->
                    <div class="p-6 border-t border-brand-border bg-brand-surface rounded-b-2xl shrink-0 safe-area-bottom z-10 relative">
                        <button type="submit" form="dash-tx-form" class="w-full bg-brand-gold hover:bg-yellow-500 text-brand-darker font-bold text-lg py-4 rounded-xl shadow-lg shadow-brand-gold/20 active:scale-[0.98] transition">
                            Confirmar Lançamento
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async addModalListeners(container) {
        const modal = document.getElementById('dashboard-tx-modal');
        const form = document.getElementById('dash-tx-form');
        const closeBtn = document.getElementById('close-dash-modal-btn');
        const overlay = document.getElementById('close-dash-modal-overlay');

        const closeModal = () => modal.classList.add('hidden');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

        // --- DYNAMIC CATEGORY POPULATION ---
        const categorySelect = form ? form.querySelector('select[name="category"]') : null;
        if (categorySelect) {
            try {
                const categories = await TransactionService.getCategories();

                // FILTER LOGIC (Same as Wallet.js)
                const REQUIRED_CATEGORIES = [
                    'Custos Fixos',
                    'Liberdade Financeira',
                    'Metas',
                    'Conforto',
                    'Prazeres',
                    'Conhecimento'
                ];

                let filtered = categories.filter(cat =>
                    REQUIRED_CATEGORIES.some(req => req.toLowerCase() === cat.name.toLowerCase())
                );

                filtered.sort((a, b) => {
                    const indexA = REQUIRED_CATEGORIES.findIndex(r => r.toLowerCase() === a.name.toLowerCase());
                    const indexB = REQUIRED_CATEGORIES.findIndex(r => r.toLowerCase() === b.name.toLowerCase());
                    return indexA - indexB;
                });

                // Clear hardcoded and populate
                if (filtered.length > 0) {
                    categorySelect.innerHTML = '<option value="" disabled selected>Selecione...</option>';

                    const emojiMap = {
                        'lock': '🔒',
                        'trending-up': '📈',
                        'target': '🎯',
                        'coffee': '☕',
                        'smile': '😃',
                        'book': '📚',
                        'home': '🏠',
                        'car': '🚗',
                        'gamepad': '🎮',
                        'activity': '⚕️',
                        'dollar-sign': '💰',
                        'shopping-cart': '🛒',
                        'gift': '🎁',
                        'tool': '🛠️',
                        'briefcase': '💼'
                    };

                    filtered.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat.id; // Correct ID

                        let emoji = '';
                        const iconName = cat.icon ? cat.icon.toLowerCase() : '';

                        if (emojiMap[iconName]) {
                            emoji = emojiMap[iconName];
                        } else if (cat.icon && !cat.icon.includes('fa-') && !cat.icon.match(/^[a-z-]+$/)) {
                            emoji = cat.icon;
                        }

                        option.text = emoji ? `${emoji} ${cat.name}` : cat.name;
                        categorySelect.appendChild(option);
                    });

                    // Add "Manage" option or link? Not strictly requested for Quick Action, but consistency is good.
                    // Since this is a select, we can't add a button inside easily without breaking UI flow of the simple form.
                    // The user can go to Settings via the button in the dashboard header if needed.
                } else {
                    // Fallback to original text if no DB matches (avoids empty dropdown)
                    // But we suspect DB has them. If not, keep hardcoded or show "No categories".
                    // We'll leave the hardcoded ones if filtered is empty, assuming init failed?
                    // Actually, let's just leave it alone if length is 0.
                }

            } catch (e) {
                console.error('Failed to load categories in dashboard', e);
            }
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);

                // Determine context based on basic logic or current dashboard state
                // If partner selected, likely business.
                const partnerId = formData.get('partner_id');
                const context = partnerId ? 'business' : this.currentContext;

                // Get Amount (Handle comma)
                // Dashboard input is 'number' step 0.01 often, but sticking to float parse.
                // Note: TransactionService handles simple float inputs as Reais.
                let amountFloat = parseFloat(formData.get('amount'));

                const newTx = {
                    amount: amountFloat,
                    description: formData.get('description'),
                    type: formData.get('type'),
                    date: new Date().toISOString(),
                    context: context,
                    partner_id: partnerId || null,
                    status: 'paid', // Quick action assumes paid usually
                    category_id: formData.get('category') // Changed from 'category' (text) to 'category_id' (UUID)
                };

                // If the user didn't select a valid UUID category (e.g. left logic above failed), 
                // newTx.category_id might be "general" (if we didn't clear hardcoded) or null.
                // We should ensure it's valid.

                try {
                    await TransactionService.create(newTx);
                    closeModal();
                    form.reset();
                    // Reset Select to default
                    if (categorySelect && categorySelect.options.length > 0) categorySelect.value = "";

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
// Expose functions to window
window.app = window.app || {};

window.app.changeDashboardMonth = (delta) => {
    DashboardModule.selectedDate.setMonth(DashboardModule.selectedDate.getMonth() + delta);
    DashboardModule.render();
};

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




