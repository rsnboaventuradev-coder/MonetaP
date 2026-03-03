import { GoalsService } from '../services/goals.service.js';
import { InvestmentsService } from '../services/investments.service.js';
import { EvolutionService } from '../services/evolution.service.js';
import { AnalysisService } from '../services/analysis.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { AccountsService } from '../services/accounts.service.js';
import { supabase } from '../services/supabase.service.js';
import { Toast } from '../utils/toast.js';
import { CurrencyMask } from '../utils/mask.js';

export const InvestmentsModule = {
    activeTab: 'resumo', // 'resumo', 'fixed', 'variable', 'crypto', 'contas'
    userProfile: null,
    avgCostOfLiving: 0,
    listFilter: null, // 'stock', 'fii', 'crypto', 'fixed' - For ARCA interaction

    unsubscribe: null,

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return;
        this.activeTab = this.activeTab || 'resumo';
        this.listFilter = null; // Reset filter on full render

        await GoalsService.init(); // Init Goals to check for Emergency Fund completion
        await InvestmentsService.init();
        await TransactionService.init();
        await AccountsService.init();
        await this.fetchUserData();

        // Subscribe to Store updates
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = InvestmentsService.subscribe(() => {
            if (document.getElementById('investments-list-container')) {
                this.renderView(container); // Or optimize to update parts
            }
        });

        this.renderView(container);
        window.app.openAnalysisModal = this.openAnalysisModal.bind(this);
    },

    async fetchUserData() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('birth_date,monthly_income,risk_profile,emergency_fund_target_months,current_balance')
                .eq('id', user.id)
                .maybeSingle();
            this.userProfile = profile;

            // Calculate Avg Cost of Living
            const transactions = TransactionService.transactions;
            const now = new Date();
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);

            const recentExpenses = transactions.filter(t =>
                (t.type === 'expense' || t.amount < 0) &&
                new Date(t.date) >= threeMonthsAgo
            );

            if (recentExpenses.length > 0) {
                const totalExpense = recentExpenses.reduce((acc, curr) => acc + Math.abs(curr.amount), 0);
                this.avgCostOfLiving = totalExpense / 3;
            } else {
                this.avgCostOfLiving = 2000;
            }
        } catch (e) {
            console.error("Error fetching user data", e);
            this.avgCostOfLiving = 2000;
        }
    },

    renderView(container) {
        // --- 0. SAFETY MODE CHECK (Selective Blocking) ---
        const stage = EvolutionService.calculateStage(this.userProfile);
        const isSafetyMode = stage === EvolutionService.STAGES.SECURITY;

        // If in Safety Mode AND trying to access restricted tabs, show Safety Screen
        if (isSafetyMode && ['variable', 'crypto'].includes(this.activeTab)) {
            this.renderSafetyMode(container);
            return;
        }

        // C2: Disclaimer (Only if accessing risky assets or if not accepted yet generally?)
        // Let's keep disclaimer for general access if not in safety mode, 
        // OR maybe only for variable/crypto too. For now keep as is for general access but maybe skip if just Fixed?
        // Let's enforce disclaimer only if NOT in safety mode (implied you are advancing) AND haven't accepted.
        // But if user is just doing Fixed Income, maybe no disclaimer needed?
        // Let's keep it simple: If stage > SECURITY, check disclaimer.
        if (!isSafetyMode) {
            const disclaimerAccepted = localStorage.getItem('invest_disclaimer_accepted');
            if (!disclaimerAccepted) {
                this.renderDisclaimer(container);
                return;
            }
        }

        // Tag container content for easy check
        // We will wrap content in investments-container class

        const investments = InvestmentsService.investments;
        // Service returns values in cents - convert to reais for display
        const totalEquityCents = InvestmentsService.calculateTotalEquity();
        const totalInvestedCents = InvestmentsService.calculateTotalInvested();
        const totalEquity = totalEquityCents / 100;
        const totalInvested = totalInvestedCents / 100;
        const profit = totalEquity - totalInvested;
        const profitPercent = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

        // --- Logic via Service ---
        const arca = InvestmentsService.calculateARCA();
        const gifPercent = InvestmentsService.calculateGIF(this.avgCostOfLiving);
        const pnif = InvestmentsService.calculatePNIF(this.avgCostOfLiving);

        // --- Filtering Logic ---
        // 1. Tab Filter
        let filteredInvestments = investments;
        if (this.activeTab === 'fixed') {
            filteredInvestments = investments.filter(i => ['fixed_income', 'treasure'].includes(i.type));
        } else if (this.activeTab === 'variable') {
            filteredInvestments = investments.filter(i => ['stock', 'fii'].includes(i.type));
        } else if (this.activeTab === 'crypto') {
            filteredInvestments = investments.filter(i => i.type === 'crypto');
        }

        // 2. Interactive List Filter (from ARCA click)
        if (this.listFilter) {
            if (this.listFilter === 'fixed') {
                filteredInvestments = investments.filter(i => ['fixed_income', 'treasure'].includes(i.type));
            } else {
                filteredInvestments = investments.filter(i => i.type === this.listFilter);
            }
        }

        const grouped = this.groupInvestmentsByType(filteredInvestments);

        // Metrics for Display
        let displayEquity = totalEquity;
        let displayProfit = profit;
        let displayProfitPercent = profitPercent;

        if (this.activeTab !== 'resumo' || this.listFilter) {
            // Calculate in cents then convert to reais for display
            const displayEquityCents = filteredInvestments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
            const displayInvestedCents = filteredInvestments.reduce((acc, curr) => acc + (curr.quantity * curr.average_price), 0);
            displayEquity = displayEquityCents / 100;
            displayProfit = (displayEquityCents - displayInvestedCents) / 100;
            displayProfitPercent = displayInvestedCents > 0 ? ((displayEquityCents - displayInvestedCents) / displayInvestedCents) * 100 : 0;
        }

        const containerHTML = `
            <div class="h-full flex flex-col bg-brand-bg relative pb-24">
                <!-- Header -->
                <header class="pt-8 pb-4 px-4 bg-brand-bg/95 backdrop-blur-md sticky top-0 z-20 safe-area-top border-b border-brand-border">
                    <h1 class="text-2xl font-bold text-brand-text-primary tracking-tight mb-4">Investimentos</h1>
                    
                    <!-- Tabs -->
                    <div class="flex space-x-2 overflow-x-auto pb-2 mb-4 custom-scrollbar">
                        ${this.renderTabButton('resumo', 'Resumo')}
                        ${this.renderTabButton('contas', '<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>Contas')}
                        ${this.renderTabButton('variable', '<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>Ações & FIIs')}
                        ${this.renderTabButton('fixed', 'Renda Fixa')}
                        ${this.renderTabButton('crypto', '<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Cripto & Outros')}
                    </div>

                    <!-- Summary Card -->
                    <div class="bg-gradient-to-br from-brand-surface to-brand-surface-light border border-brand-border rounded-3xl p-5 shadow-lg relative overflow-hidden transition-all duration-300">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-2xl -mr-16 -mt-16"></div>
                        
                        <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest font-bold mb-1">
                            ${(this.activeTab === 'resumo' && !this.listFilter) ? 'Patrimônio Total' : 'Saldo da Seleção'}
                        </p>
                        <h2 class="text-3xl font-black text-brand-text-primary mb-2">R$ ${displayEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                        
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold ${displayProfit >= 0 ? 'text-brand-green' : 'text-brand-red'} bg-black/20 px-2 py-1 rounded-lg border border-brand-border">
                                ${displayProfitPercent >= 0 ? '+' : ''}${displayProfitPercent.toFixed(2)}%
                            </span>
                            <span class="text-xs text-brand-text-secondary">
                                (${displayProfit >= 0 ? '+' : ''}R$ ${displayProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                            </span>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24">

                    <!-- Charts Grid (Only on Resumo Tab Main View) -->
                    ${this.activeTab === 'resumo' ? `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <!-- GIF Gauge -->
                        <div class="bg-brand-surface/30 border border-brand-border rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="text-sm font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-2">
                                    <span class="bg-green-500/10 text-green-400 p-1 rounded-lg">🔋</span>
                                    GIF (Independência)
                                </h3>
                                <span class="text-[10px] bg-brand-surface-light text-brand-text-secondary px-2 py-0.5 rounded-full font-bold">${gifPercent.toFixed(1)}%</span>
                            </div>
                            <div class="relative h-32 w-full flex justify-center items-center">
                                <canvas id="gif-gauge-chart" class="relative z-10"></canvas>
                                <div class="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
                                    <p class="text-2xl font-black text-brand-text-primary">${gifPercent.toFixed(1)}%</p>
                                </div>
                            </div>
                            <p class="text-[10px] text-brand-text-secondary text-center mt-2">Custo de Vida: R$ ${this.avgCostOfLiving.toFixed(0)}</p>
                        </div>

                         <!-- MENAGERIE (PNIF + ARCA) -->
                        <div class="bg-brand-surface/30 border border-brand-border rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up delay-100 flex flex-col gap-4">
                            
                            <!-- PNIF -->
                            <div>
                                <h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-wider mb-2">🏁 Meta PNIF (Regra 4%)</h3>
                                <div class="flex justify-between items-end mb-1">
                                    <span class="text-lg font-bold text-brand-text-primary">R$ ${totalEquity.toLocaleString('pt-BR', { notation: 'compact' })}</span>
                                    <span class="text-xs text-brand-text-secondary">Meta: R$ ${pnif.target.toLocaleString('pt-BR', { notation: 'compact' })}</span>
                                </div>
                                <div class="w-full bg-black/20 rounded-full h-3 overflow-hidden">
                                    <div class="bg-gradient-to-r from-blue-500 to-green-400 h-full rounded-full transition-all duration-1000" style="width: ${Math.min(100, pnif.progress)}%"></div>
                                </div>
                            </div>

                            <!-- ARCA Methodology (Clickable) -->
                            <div class="pt-4 border-t border-brand-border">
                                 <h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-wider mb-3">🔺 Metodologia ARCA (Toque para Filtrar)</h3>
                                 <div class="grid grid-cols-4 gap-2">
                                    <!-- Ações -->
                                    <div class="arca-box bg-blue-500/5 border ${this.listFilter === 'stock' ? 'border-blue-500 bg-blue-500/20' : 'border-blue-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-blue-500/10 transition" data-filter="stock">
                                        <span class="text-[10px] text-blue-400 font-bold">Ações</span>
                                        <span class="text-sm font-bold text-brand-text-primary">${arca.percentages.a.toFixed(0)}%</span>
                                        <div class="w-full h-1 bg-brand-surface-light rounded-full overflow-hidden">
                                            <div class="h-full bg-blue-500" style="width: ${Math.min(100, (arca.percentages.a / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                    <!-- Real Estate -->
                                    <div class="arca-box bg-orange-500/5 border ${this.listFilter === 'fii' ? 'border-orange-500 bg-orange-500/20' : 'border-orange-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-orange-500/10 transition" data-filter="fii">
                                        <span class="text-[10px] text-orange-400 font-bold">FIIs</span>
                                        <span class="text-sm font-bold text-brand-text-primary">${arca.percentages.r.toFixed(0)}%</span>
                                         <div class="w-full h-1 bg-brand-surface-light rounded-full overflow-hidden">
                                            <div class="h-full bg-orange-500" style="width: ${Math.min(100, (arca.percentages.r / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                    <!-- Caixa -->
                                    <div class="arca-box bg-green-500/5 border ${this.listFilter === 'fixed' ? 'border-green-500 bg-green-500/20' : 'border-green-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-green-500/10 transition" data-filter="fixed">
                                        <span class="text-[10px] text-green-400 font-bold">Caixa</span>
                                        <span class="text-sm font-bold text-brand-text-primary">${arca.percentages.c.toFixed(0)}%</span>
                                         <div class="w-full h-1 bg-brand-surface-light rounded-full overflow-hidden">
                                            <div class="h-full bg-green-500" style="width: ${Math.min(100, (arca.percentages.c / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                    <!-- Antifrágeis -->
                                    <div class="arca-box bg-purple-500/5 border ${this.listFilter === 'crypto' ? 'border-purple-500 bg-purple-500/20' : 'border-purple-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-purple-500/10 transition" data-filter="crypto">
                                        <span class="text-[10px] text-purple-400 font-bold">Antifrág.</span>
                                        <span class="text-sm font-bold text-brand-text-primary">${arca.percentages.alt.toFixed(0)}%</span>
                                         <div class="w-full h-1 bg-brand-surface-light rounded-full overflow-hidden">
                                            <div class="h-full bg-purple-500" style="width: ${Math.min(100, (arca.percentages.alt / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        </div>

                        <!-- Evolution Chart -->
                         <div class="bg-brand-surface/30 border border-brand-border rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up md:col-span-2">
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="text-sm font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-2">
                                    <span class="bg-blue-500/10 text-blue-400 p-1 rounded-lg">🚀</span>
                                    Comparativo de Evolução
                                </h3>
                             </div>
                            <div class="relative h-56 w-full flex justify-center items-center">
                                <canvas id="evolution-chart" class="relative z-10"></canvas>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Specialized Charts based on Tab -->
                    ${this.activeTab === 'variable' ? `<div class="bg-brand-surface/30 border border-brand-border rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up"><h3 class="text-sm font-bold text-brand-text-secondary uppercase tracking-wider mb-4">📊 Exposição por Setor</h3><div class="relative h-48 w-full"><canvas id="sector-chart"></canvas></div></div>` : ''}
                    ${this.activeTab === 'fixed' ? `<div class="bg-brand-surface/30 border border-brand-border rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up"><h3 class="text-sm font-bold text-brand-text-secondary uppercase tracking-wider mb-4">📈 Rentabilidade (%)</h3><div class="relative h-48 w-full"><canvas id="fixed-yield-chart"></canvas></div></div>` : ''}

                    <!-- Accounts Tab Content -->
                    ${this.activeTab === 'contas' ? this.renderAccountsTab() : ''}

                    <!-- Asset Lists (Filtered) -->
                    ${this.listFilter ? `<h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-widest pl-2 mb-2 animate-fade-in">Filtrado por: ${this.getFilterName(this.listFilter)}</h3>` : ''}
                    
                    ${this.activeTab !== 'contas' ? (Object.keys(grouped).length > 0 ? Object.keys(grouped).map(type => this.renderAssetGroup(type, grouped[type])).join('') :
                '<div class="text-center text-brand-text-secondary mt-10"><p>Nenhum ativo encontrado.</p></div>') : ''}
                </div>

                <!-- FAB -->
                <button id="fab-add-asset" class="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full shadow-lg flex items-center justify-center text-brand-text-primary hover:scale-105 active:scale-95 transition z-20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
            ${this.renderModal()}
            ${this.renderAccountModal()}
        `;

        // Update container once
        container.innerHTML = containerHTML;

        // Render Charts after DOM injection
        requestAnimationFrame(() => {
            if (this.activeTab === 'resumo') {
                this.renderGIFGauge(gifPercent);
                this.renderEvolutionChart(displayEquity);
            }
            if (this.activeTab === 'variable') {
                this.renderSectorChart(filteredInvestments);
            }
            if (this.activeTab === 'fixed') {
                this.renderFixedYieldChart(filteredInvestments);
            }
        });

        this.addListeners();
    },


    async renderSafetyMode(container) {
        // Ensure data is fresh
        if (!GoalsService.goals || GoalsService.goals.length === 0) {
            console.warn('⚠️ Investments: GoalsService empty, forcing refresh...');
            await GoalsService.init();
        }

        console.log('🔍 Investments Safety Check: Scanning Goals...', GoalsService.goals);

        // 1. Check for Completed Goal
        const completedEmergencyGoal = GoalsService.goals.find(g =>
            (g.name.toLowerCase().includes('reserva') || g.type === 'security') &&
            (g.status === 'completed' || (g.current_amount >= g.target_amount && g.target_amount > 0))
        );

        let liquidity = EvolutionService.calculateLiquidity(this.userProfile);
        const costOfLiving = EvolutionService.calculateAvgCostOfLiving();
        const targetMonths = this.userProfile?.emergency_fund_target_months || 6;
        const targetAmount = costOfLiving * targetMonths;

        let progress = Math.min(100, (liquidity / targetAmount) * 100);
        let missing = Math.max(0, targetAmount - liquidity);

        // Override if goal is explicitly completed
        if (completedEmergencyGoal) {
            progress = 100;
            missing = 0;
            liquidity = targetAmount;

            // Auto-unlock via setTimeout to let UI render first (UX)
            if (completedEmergencyGoal.status === 'completed') {
                setTimeout(() => {
                    this.unlockInvestments(completedEmergencyGoal);
                }, 1500);
            }
        }

        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in safe-area-top">
                
                <div class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 animate-pulse-slow shadow-lg shadow-blue-900/20">
                    <svg class="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>

                <h2 class="text-2xl font-bold text-white mb-2 tracking-tight">MODO SEGURANÇA ATIVO</h2>
                <p class="text-slate-400 max-w-sm mx-auto mb-10 text-sm leading-relaxed">
                    Para acessar investimentos de maior risco, você precisa completar sua 
                    <button onclick="window.app.navigateTo('goals')" class="text-blue-400 font-bold hover:text-blue-300 transition underline decoration-blue-400/30 underline-offset-4">Reserva de Emergência</button>.
                </p>

                <!-- Progress Bar -->
                <div class="w-full max-w-sm bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 shadow-xl mb-8 group hover:border-blue-500/30 transition-all duration-500">
                    <div class="flex justify-between text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                        <span>Progresso</span>
                        <span class="${progress >= 100 ? 'text-green-400' : 'text-blue-400'}">${Math.round(progress)}%</span>
                    </div>
                    <div class="h-2.5 bg-slate-700 rounded-full overflow-hidden shadow-inner">
                        <div class="h-full ${progress >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-600 to-blue-400'} rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style="width: ${progress}%"></div>
                    </div>
                    <p class="text-xs text-slate-500 mt-4 font-mono">
                        ${progress >= 100
                ? '<span class="text-green-400 flex items-center justify-center gap-2">✨ Reserva Completa!</span>'
                : `Faltam <span class="text-slate-300">R$ ${missing.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> para o objetivo.`
            }
                    </p>
                </div>

                ${progress >= 100 ? `
                    <button onclick="window.app.InvestmentsModule.handleManualUnlock()" class="w-full max-w-sm bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 group">
                        <span class="text-xl group-hover:scale-110 transition">🔓</span>
                        Validar & Desbloquear
                    </button>
                    <p class="text-xs text-slate-500 mt-2">Clique para confirmar e liberar o acesso.</p>
                ` : `
                    <button onclick="window.app.navigateTo('goals')" class="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                        Focar na Reserva
                    </button>
                    
                     <button onclick="window.app.InvestmentsModule.verifyEmergencyFundManual()" class="mt-6 text-sm text-slate-500 hover:text-slate-300 transition flex items-center gap-2 py-2 px-4 rounded-lg hover:bg-slate-800/50">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Já completei a reserva
                    </button>
                `}
                
                <button onclick="window.app.navigateTo('dashboard')" class="mt-8 text-sm text-slate-500 hover:text-slate-300 transition underline decoration-slate-700 underline-offset-4">
                    Voltar ao Dashboard
                </button>
            </div>
        `;
    },

    async handleManualUnlock() {
        try {
            Toast.show('Validando reserva...', 'info');

            // 1. Try to find existing goal
            let existingGoal = GoalsService.goals.find(g =>
                g.name.toLowerCase().includes('reserva') || g.type === 'security'
            );

            // 2. If not found, create it (System Goal became Real Goal)
            if (!existingGoal) {
                console.log('Creating Default System Goal...');
                existingGoal = await GoalsService.createDefaultEmergencyGoal();
            }

            // 3. Mark as completed
            if (existingGoal && existingGoal.status !== 'completed') {
                const updated = await GoalsService.update(existingGoal.id, { status: 'completed' });
                if (updated) {
                    existingGoal.status = 'completed'; // Local update
                }
            }

            // 4. Force Unlock logic
            this.verifyEmergencyFundManual();

        } catch (error) {
            console.error('Unlock failed', error);
            Toast.show('Erro ao desbloquear. Tente novamente.', 'error');
        }
    },

    async verifyEmergencyFundManual() {
        const { Toast } = await import('../utils/toast.js');
        const { GoalsService } = await import('../services/goals.service.js');

        Toast.show({ type: 'info', message: 'Verificando metas...' });

        await GoalsService.init(); // Force fresh fetch

        const goals = GoalsService.goals || [];
        console.log('🔍 Manual Verify: Found goals:', goals);

        // Lenient check
        const completedGoal = goals.find(g =>
            (g.current_amount >= g.target_amount && g.target_amount > 0) ||
            g.status === 'completed'
        );

        if (completedGoal) {
            Toast.show({ type: 'success', message: `Meta encontrada: ${completedGoal.name}! Liberando acesso...` });

            // Update local override if needed or just re-render
            // We can force re-render which will now pick it up because we just refreshed logic
            this.render();
        } else {
            // List found goals to user to explain why
            const goalNames = goals.map(g => `${g.name} (${Math.round(g.current_amount / g.target_amount * 100)}%)`).join(', ');
            Toast.show({
                type: 'warning',
                message: `Nenhuma meta completa encontrada. Metas atuais: ${goalNames || 'Nenhuma'}. Certifique-se que o valor atual atingiu a meta.`
            });
        }
    },

    unlockAccumulation() {
        // Logic to manually refresh or force unlock locally if needed, mainly just refresh view
        // The checkEmergencyFundUnlock in goals service should have handled DB side.
        // This is for instant UI feedback.
        this.activeTab = 'fixed'; // Move to fixed as first step
        this.render();
    },

    renderDisclaimer(container) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center bg-brand-bg px-6 text-center space-y-8 animate-fade-in safe-area-top">
                <div class="w-20 h-20 rounded-2xl bg-brand-gold/20 flex items-center justify-center rotate-3 hover:rotate-6 transition duration-500">
                    <svg class="w-10 h-10 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>

                <div class="space-y-4 max-w-sm">
                    <h2 class="text-3xl font-black text-brand-text-primary tracking-tight">Aviso Legal</h2>
                    <p class="text-sm text-brand-text-secondary leading-relaxed">
                        Você está prestes a acessar a área de <strong>Investimentos</strong>.
                    </p>
                    <div class="bg-brand-surface/50 border border-brand-border rounded-xl p-4 text-left">
                        <ul class="space-y-3 text-xs text-brand-text-secondary list-disc pl-4">
                            <li>Investimentos envolvem riscos, incluindo a perda do capital investido.</li>
                            <li>A rentabilidade passada não garante rentabilidade futura.</li>
                            <li>Certifique-se de que seu perfil de risco é compatível com os ativos escolhidos.</li>
                        </ul>
                    </div>
                </div>

                <button id="accept-disclaimer-btn" class="w-full max-w-xs bg-brand-gold hover:bg-yellow-400 text-brand-bg font-bold py-4 rounded-xl shadow-glow-gold transition transform active:scale-95">
                    Estou Ciente e Quero Continuar
                </button>
                
                 <button onclick="window.app.navigateTo('dashboard')" class="text-sm text-brand-text-secondary hover:text-brand-text-primary transition">
                    Cancelar
                </button>
            </div>
        `;

        // Add Logic for Button
        setTimeout(() => {
            const btn = document.getElementById('accept-disclaimer-btn');
            if (btn) {
                btn.onclick = () => {
                    localStorage.setItem('invest_disclaimer_accepted', 'true');
                    this.render(); // Re-render to bypass check
                };
            }
        }, 100);
    },

    getFilterName(filter) {
        const names = { 'stock': 'Ações', 'fii': 'FIIs', 'fixed': 'Renda Fixa/Caixa', 'crypto': 'Antifrágeis/Cripto' };
        return names[filter] || filter;
    },

    addListeners() {
        // ... (Existing Modal & Logic Listeners) ...
        const modal = document.getElementById('asset-modal');
        const fab = document.getElementById('fab-add-asset');
        const closeBtn = document.getElementById('close-asset-btn');
        const overlay = document.getElementById('close-asset-overlay');
        const form = document.getElementById('asset-form');
        const deleteBtn = document.getElementById('btn-delete-asset');

        const closeModal = () => { if (modal) modal.classList.add('hidden'); }
        const openModal = () => {
            if (!form || !modal) return;
            form.reset();
            const idInput = document.getElementById('asset-id');
            if (idInput) idInput.value = '';
            if (deleteBtn) deleteBtn.classList.add('hidden');
            modal.classList.remove('hidden');
            setTimeout(() => CurrencyMask.initAll(), 100);

            const tickerField = document.getElementById('ticker-field');
            const fiFields = document.getElementById('fixed-income-fields');
            const viFields = document.getElementById('variable-income-fields');
            const cryptoFields = document.getElementById('crypto-fields');
            const typeSelect = document.getElementById('asset-type-select');

            if (typeSelect) typeSelect.value = 'stock';

            [tickerField, fiFields, viFields, cryptoFields].forEach(el => {
                if (el) el.classList.add('hidden');
            });
            if (tickerField) tickerField.classList.remove('hidden');
        };

        if (fab) fab.addEventListener('click', () => {
            // Open account modal if on Contas tab, otherwise open asset modal
            if (this.activeTab === 'contas') {
                window.app.openAccountModal();
            } else {
                openModal();
            }
        });
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

        // --- NEW: Auto-fill Market Data via Brapi ---
        const tickerInput = document.querySelector('input[name="ticker"]');
        if (tickerInput) {
            tickerInput.addEventListener('blur', async (e) => {
                const typeVal = document.getElementById('asset-type-select')?.value;
                // Only auto-fill for variable income (stocks & FIIs)
                if (!['stock', 'fii'].includes(typeVal)) return;

                const ticker = e.target.value.trim().toUpperCase();
                if (!ticker) return;

                const nameInput = document.querySelector('input[name="name"]');
                const priceInput = document.querySelector('input[name="current_price"]');
                const sectorInput = document.querySelector('input[name="sector"]');

                // Visual Feedback
                const originalNamePlaceholder = nameInput ? nameInput.placeholder : '';
                if (nameInput) nameInput.placeholder = 'Buscando dados na B3...';
                if (tickerInput) tickerInput.disabled = true;

                try {
                    // Using StatusInvest via CORS Proxies as open alternatives since Brapi blocks some tickers
                    const targetUrl = encodeURIComponent(`https://statusinvest.com.br/home/mainsearchquery?q=${ticker}`);
                    const proxies = [
                        `https://api.allorigins.win/raw?url=${targetUrl}`,
                        `https://corsproxy.io/?${targetUrl}`
                    ];

                    let data = null;
                    for (const proxyUrl of proxies) {
                        try {
                            const response = await fetch(proxyUrl);
                            if (response.ok) {
                                data = await response.json();
                                break; // Success, exit the fallback loop
                            }
                        } catch (e) {
                            console.warn(`Proxy falhou: ${proxyUrl}`, e);
                        }
                    }

                    if (data && Array.isArray(data) && data.length > 0) {
                        const asset = data[0];

                        // Set Name (Format from StatusInvest: "ABCB4 - BANCO ABC BRASIL")
                        if (nameInput && !nameInput.value) {
                            const fullName = asset.nameFormated || '';
                            const parts = fullName.split(' - ');
                            nameInput.value = parts.length > 1 ? parts[1].trim() : fullName;
                        }

                        // Set Price (Format from StatusInvest is localized string: "27,89")
                        if (priceInput && asset.price && !priceInput.value) {
                            priceInput.value = `R$ ${asset.price}`;
                        }

                        Toast.show(`Dados de ${ticker} encontrados!`, 'success');
                    } else {
                        Toast.show(`Ativo ${ticker} não encontrado nas consultas ou erro de rede.`, 'warning');
                    }
                } catch (error) {
                    console.error('Fetch StatusInvest error:', error);
                    Toast.show('Falha crítica ao buscar dados na bolsa.', 'error');
                } finally {
                    if (nameInput) nameInput.placeholder = originalNamePlaceholder;
                    if (tickerInput) tickerInput.disabled = false;
                }
            });
        }

        // Helper for listener
        const typeSelect = document.getElementById('asset-type-select');
        if (typeSelect) {
            typeSelect.onchange = (e) => {
                const val = e.target.value;
                const fiFields = document.getElementById('fixed-income-fields');
                const viFields = document.getElementById('variable-income-fields');
                const cryptoFields = document.getElementById('crypto-fields');
                const tickerField = document.getElementById('ticker-field');

                if (fiFields) fiFields.classList.add('hidden');
                if (viFields) viFields.classList.add('hidden');
                if (cryptoFields) cryptoFields.classList.add('hidden');
                if (tickerField) tickerField.classList.remove('hidden');

                if (['fixed_income', 'treasure'].includes(val)) {
                    if (fiFields) fiFields.classList.remove('hidden');
                    if (tickerField) tickerField.classList.add('hidden');
                } else if (['stock', 'fii'].includes(val)) {
                    if (viFields) viFields.classList.remove('hidden');
                } else if (val === 'crypto') {
                    if (cryptoFields) cryptoFields.classList.remove('hidden');
                }
            };
        }

        document.querySelectorAll('.investment-tab').forEach(btn => {
            btn.onclick = (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.activeTab = tab;
                this.listFilter = null; // Clear filter when switching tabs via button
                this.renderView(document.getElementById('main-content'));
            };
        });

        // --- NEW: ARCA Box Listeners ---
        document.querySelectorAll('.arca-box').forEach(box => {
            box.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                // Toggle filter
                if (this.listFilter === filter) {
                    this.listFilter = null;
                } else {
                    this.listFilter = filter;
                }
                this.renderView(document.getElementById('main-content'));
            });
        });

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn ? submitBtn.innerHTML : 'Salvar';
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';
                }

                const formData = new FormData(form);
                const assetData = Object.fromEntries(formData.entries());
                const id = assetData.id;
                delete assetData.id;

                const currencyFields = ['average_price', 'current_price', 'principal_amount', 'current_value'];

                // Parse standard numeric fields
                ['quantity', 'rate', 'dividend_yield', 'p_vp'].forEach(field => {
                    if (assetData[field] === '' || assetData[field] === undefined) {
                        assetData[field] = null;
                    } else {
                        assetData[field] = parseFloat(assetData[field]);
                    }
                });

                // Parse Currency Fields
                currencyFields.forEach(field => {
                    if (assetData[field]) {
                        // Unmask returns float (Reais) for Service to handle conversion
                        assetData[field] = CurrencyMask.unmaskToFloat(assetData[field]);
                    } else {
                        assetData[field] = null;
                    }
                });

                // Parse Date Fields (Prevent empty string from breaking Supabase date type)
                ['application_date', 'maturity_date'].forEach(field => {
                    if (assetData[field] === '') {
                        assetData[field] = null;
                    }
                });

                if (assetData.type === 'crypto' && assetData.crypto_issuer) {
                    assetData.issuer = assetData.crypto_issuer;
                }
                delete assetData.crypto_issuer;

                // For fixed income: map current_value to current_price and principal_amount to average_price
                if (['fixed_income', 'treasure'].includes(assetData.type)) {
                    if (assetData.current_value !== null) {
                        assetData.current_price = assetData.current_value;
                    }
                    if (assetData.principal_amount !== null) {
                        // Principal Amount is assumed to be average price for fixed income logic in Service
                        assetData.average_price = assetData.principal_amount;
                    }
                    // Fixed income always has quantity = 1
                    assetData.quantity = 1;
                }
                delete assetData.current_value; // Remove intermediate field

                // Cleanup irrelevant fields based on asset type
                if (!['fixed_income', 'treasure', 'crypto'].includes(assetData.type)) assetData.issuer = null;
                if (!['fixed_income', 'treasure'].includes(assetData.type)) {
                    assetData.indexer = null; assetData.rate = null; assetData.maturity_date = assetData.maturity_date || null;
                    assetData.principal_amount = null; assetData.application_date = null; assetData.liquidity = null;
                }
                if (!['stock', 'fii'].includes(assetData.type)) {
                    assetData.sector = null; assetData.dividend_yield = null; assetData.p_vp = null;
                }
                if (!assetData.current_price) assetData.current_price = 0;

                try {
                    if (id) await InvestmentsService.update(id, assetData);
                    else await InvestmentsService.create(assetData);
                    Toast.show('Investimento salvo com sucesso!', 'success');
                    closeModal();
                    this.render();
                } catch (error) {
                    console.error(error);
                    Toast.show('Erro ao salvar investimento: ' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }
                }
            };
        }

        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                const id = document.getElementById('asset-id').value;
                const confirmed = await window.ModalUtils.confirm('Excluir Ativo', 'Tem certeza que deseja excluir este ativo?', { danger: true });
                if (confirmed) {
                    await InvestmentsService.delete(id);
                    closeModal();
                    this.render();
                }
            };
        }

        window.app.editAsset = (id) => {
            const asset = InvestmentsService.investments.find(a => a.id === id);
            if (!asset) return;
            const inputs = form.elements;

            inputs['id'].value = asset.id;
            inputs['ticker'].value = asset.ticker;
            inputs['name'].value = asset.name;
            inputs['type'].value = asset.type;
            inputs['quantity'].value = asset.quantity;
            inputs['average_price'].value = CurrencyMask.format(asset.average_price.toString());
            inputs['current_price'].value = CurrencyMask.format(asset.current_price.toString());

            if (inputs['issuer']) inputs['issuer'].value = asset.issuer || '';
            const cryptoIssuerInput = inputs['crypto_issuer'];
            if (cryptoIssuerInput) cryptoIssuerInput.value = asset.type === 'crypto' ? (asset.issuer || '') : '';

            if (inputs['indexer']) inputs['indexer'].value = asset.indexer || 'CDI';
            if (inputs['rate']) inputs['rate'].value = asset.rate || '';
            if (inputs['maturity_date']) inputs['maturity_date'].value = asset.maturity_date || '';

            // NEW: Fixed income complete fields
            if (inputs['principal_amount']) inputs['principal_amount'].value = asset.principal_amount ? CurrencyMask.format(asset.principal_amount.toString()) : '';
            if (inputs['application_date']) inputs['application_date'].value = asset.application_date || '';
            if (inputs['liquidity']) inputs['liquidity'].value = asset.liquidity || 'daily';
            if (inputs['current_value']) inputs['current_value'].value = (asset.current_price && ['fixed_income', 'treasure'].includes(asset.type)) ? CurrencyMask.format(asset.current_price.toString()) : '';
            if (inputs['entity_context']) inputs['entity_context'].value = asset.entity_context || 'personal';
            if (inputs['is_emergency_fund']) inputs['is_emergency_fund'].checked = asset.is_emergency_fund || false;

            if (inputs['sector']) inputs['sector'].value = asset.sector || '';
            if (inputs['dividend_yield']) inputs['dividend_yield'].value = asset.dividend_yield || '';
            if (inputs['p_vp']) inputs['p_vp'].value = asset.p_vp || '';

            if (deleteBtn) deleteBtn.classList.remove('hidden');
            if (modal) modal.classList.remove('hidden');

            if (typeSelect) {
                typeSelect.value = asset.type;
                typeSelect.dispatchEvent(new Event('change'));
            }

            // Re-bind masks
            setTimeout(() => CurrencyMask.initAll(), 100);
        };

        // --- ACCOUNT MODAL LISTENERS ---
        const accountModal = document.getElementById('account-modal');
        const accountForm = document.getElementById('account-form');
        const closeAccountBtn = document.getElementById('close-account-btn');
        const closeAccountOverlay = document.getElementById('close-account-overlay');
        const deleteAccountBtn = document.getElementById('btn-delete-account');

        const closeAccountModal = () => { if (accountModal) accountModal.classList.add('hidden'); };

        window.app.openAccountModal = () => {
            if (!accountForm || !accountModal) return;
            accountForm.reset();
            const idInput = document.getElementById('account-id');
            if (idInput) idInput.value = '';
            if (deleteAccountBtn) deleteAccountBtn.classList.add('hidden');
            accountModal.classList.remove('hidden');
            setTimeout(() => CurrencyMask.initAll(), 100);
        };

        window.app.editAccount = (id) => {
            const account = AccountsService.getAccountById(id);
            if (!account || !accountForm) return;

            const inputs = accountForm.elements;
            inputs['id'].value = account.id;
            inputs['name'].value = account.name;
            inputs['type'].value = account.type;
            inputs['institution'].value = account.institution || '';
            inputs['initial_balance'].value = CurrencyMask.format(account.initial_balance.toString());
            inputs['color'].value = account.color || '#3B82F6';
            inputs['icon'].value = account.icon || '';
            inputs['include_in_total'].checked = account.include_in_total;
            inputs['is_emergency_fund'].checked = account.is_emergency_fund || false;

            if (deleteAccountBtn) deleteAccountBtn.classList.remove('hidden');
            accountModal.classList.remove('hidden');
        };

        if (closeAccountBtn) closeAccountBtn.addEventListener('click', closeAccountModal);
        if (closeAccountOverlay) closeAccountOverlay.addEventListener('click', closeAccountModal);

        if (accountForm) {
            accountForm.onsubmit = async (e) => {
                e.preventDefault();

                const submitBtn = accountForm.querySelector('button[type="submit"]');
                const originalText = submitBtn ? submitBtn.innerHTML : 'Salvar';
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';
                }

                const formData = new FormData(accountForm);

                // Parse initial_balance
                const rawBalance = formData.get('initial_balance');
                const balance = CurrencyMask.unmask(rawBalance);

                const accountData = {
                    name: formData.get('name'),
                    type: formData.get('type'),
                    institution: formData.get('institution') || null,
                    initial_balance: balance,
                    color: formData.get('color'),
                    icon: formData.get('icon') || null,
                    include_in_total: formData.get('include_in_total') === 'on',
                    is_emergency_fund: formData.get('is_emergency_fund') === 'on'
                };

                const id = formData.get('id');

                try {
                    if (id) {
                        await AccountsService.update(id, accountData);
                        Toast.show('Conta atualizada com sucesso!', 'success');
                    } else {
                        await AccountsService.create(accountData);
                        Toast.show('Conta criada com sucesso!', 'success');
                    }
                    closeAccountModal();
                    this.render();
                } catch (error) {
                    console.error(error);
                    Toast.show('Erro ao salvar conta: ' + error.message, 'error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }
                }
            };
        }

        if (deleteAccountBtn) {
            deleteAccountBtn.onclick = async () => {
                const id = document.getElementById('account-id').value;
                const confirmed = await window.ModalUtils.confirm('Excluir Conta', 'Tem certeza que deseja excluir esta conta?', { danger: true });
                if (confirmed) {
                    try {
                        await AccountsService.delete(id);
                        Toast.show('Conta excluída com sucesso!', 'success');
                        closeAccountModal();
                        this.render();
                    } catch (error) {
                        Toast.show(error.message, 'error');
                    }
                }
            };
        }
    },

    // --- Helper for rendering (needed as these were local before) ---
    renderAssetGroup(type, assets) {
        return `
            <div class="mb-6 animate-fade-in-up">
                <h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 pl-2">${this.getTypeName(type)}</h3>
                <div class="bg-black/20 backdrop-blur-sm border border-brand-border rounded-3xl overflow-hidden shadow-lg">
                    ${assets.map((asset, index) => this.renderAssetItem(asset, index, assets.length)).join('')}
                </div>
            </div>
        `;
    },

    getTypeName(type) {
        const map = { 'stock': 'Ações', 'fii': 'FIIs', 'fixed_income': 'Renda Fixa', 'crypto': 'Criptomoedas', 'treasure': 'Tesouro Direto' };
        return map[type] || type;
    },

    groupInvestmentsByType(investments) {
        const groups = {};
        investments.forEach(inv => {
            if (!groups[inv.type]) groups[inv.type] = [];
            groups[inv.type].push(inv);
        });
        return groups;
    },

    renderTabButton(id, label) {
        const isActive = this.activeTab === id;
        const classes = isActive ? 'bg-white text-brand-bg font-bold shadow-md' : 'bg-brand-surface-light text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-light';
        return `<button class="px-4 py-2 rounded-full text-xs transition-all whitespace-nowrap investment-tab ${classes}" data-tab="${id}">${label}</button>`;
    },

    renderAssetItem(asset, index, total) {
        // Prices are stored in cents, calculate in cents then convert for display
        const totalValueCents = asset.quantity * asset.current_price;
        const investedValueCents = asset.quantity * asset.average_price;
        const gainCents = totalValueCents - investedValueCents;
        const gainPercent = investedValueCents > 0 ? (gainCents / investedValueCents) * 100 : 0;
        const isPos = gainCents >= 0;

        // Convert to reais for display
        const totalValue = totalValueCents / 100;
        const gain = gainCents / 100;

        const isFI = ['fixed_income', 'treasure'].includes(asset.type);
        const isVI = ['stock', 'fii'].includes(asset.type);
        const isCrypto = asset.type === 'crypto';

        let subText = `${asset.quantity} cotas`;
        if (isFI) {
            const rateText = asset.indexer === 'PRE' ? `${asset.rate}% a.a.` : `${asset.rate}% ${asset.indexer}`;
            subText = `${asset.issuer || 'Emissor desc.'} • ${rateText}`;
        } else if (isVI) {
            subText = asset.sector || 'Setor não def.';
            if (asset.dividend_yield) subText += ` • DY ${asset.dividend_yield}%`;
        } else if (isCrypto) subText = asset.issuer || 'Wallet/Exchange';

        let iconBox = asset.ticker;
        if (isFI) {
            iconBox = asset.type === 'treasure'
                ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>'
                : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>';
        }
        if (isCrypto) iconBox = '₿';

        return `
           <div class="relative group touch-manipulation cursor-pointer hover:bg-brand-surface-light transition-colors duration-200 p-4 ${index !== (total - 1) ? 'border-b border-brand-border' : ''}" onclick="window.app.editAsset('${asset.id}')">
               <div class="flex items-center justify-between">
                   <div class="flex items-center gap-4">
                       <div class="w-10 h-10 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center shrink-0 text-brand-text-primary font-bold text-xs ${isFI ? 'text-lg' : ''}">${iconBox}</div>
                       <div>
                           <span class="text-brand-text-primary font-bold text-sm block truncate max-w-[150px]">${asset.name}</span>
                           <span class="text-[10px] text-brand-text-secondary font-medium block">${subText}</span>
                            ${isFI && asset.maturity_date ? `<span class="text-[9px] text-brand-gold bg-brand-gold/10 px-1.5 py-0.5 rounded inline-block mt-1 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> ${new Date(asset.maturity_date).toLocaleDateString()}</span>` : ''}
                           ${isVI && asset.p_vp ? `<span class="text-[9px] ${asset.p_vp < 1 ? 'text-green-400 bg-green-500/10' : 'text-orange-400 bg-orange-500/10'} px-1.5 py-0.5 rounded inline-block mt-1">P/VP ${asset.p_vp}</span>` : ''}
                           ${isCrypto ? `<span class="text-[9px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded inline-block mt-1">⚡ Volátil</span>` : ''}
                       </div>
                   </div>
                   <div class="text-right flex items-center gap-3">
                       <div>
                           <span class="text-brand-text-primary font-bold text-sm block">R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           <div class="flex flex-col items-end">
                                <span class="text-[10px] font-bold ${isPos ? 'text-brand-green' : 'text-brand-red'}">${isPos ? '+' : ''}${gainPercent.toFixed(1)}%</span>
                           </div>
                       </div>
                       <button onclick="event.stopPropagation(); window.app.openAnalysisModal('${asset.id}', '${asset.name}')" class="w-8 h-8 rounded-full bg-brand-surface-light hover:bg-brand-surface-light flex items-center justify-center text-brand-text-primary/50 hover:text-brand-gold transition-colors" title="Análise do Cerrado">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                       </button>
                   </div>
               </div>
           </div>
       `;
    },

    // --- Chart Methods (Logic moved to Service, Rendering remains here) ---
    renderGIFGauge(score) {
        const ctx = document.getElementById('gif-gauge-chart')?.getContext('2d');
        if (!ctx) return;
        if (window.gifChartInstance) window.gifChartInstance.destroy(); // Cleanup

        window.gifChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Conquistado', 'Falta'],
                datasets: [{
                    data: [Math.min(score, 100), 100 - Math.min(score, 100)],
                    backgroundColor: ['#10B981', 'rgba(255, 255, 255, 0.1)'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270,
                    borderRadius: 10
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }
        });
    },

    renderEvolutionChart(currentEquity) {
        const ctx = document.getElementById('evolution-chart')?.getContext('2d');
        if (!ctx) return;
        if (window.evolutionChartInstance) window.evolutionChartInstance.destroy();

        const data = InvestmentsService.calculateEvolutionProjection();

        window.evolutionChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Sua Carteira', data: data.dataMy, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4, borderWidth: 3 },
                    { label: 'CDI', data: data.dataCDI, borderColor: '#3B82F6', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, tension: 0.4 },
                    { label: 'Ibov', data: data.dataIbov, borderColor: '#F59E0B', borderDash: [2, 2], borderWidth: 2, pointRadius: 0, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, scales: { x: { display: true, grid: { display: false } }, y: { display: false } }, plugins: { legend: { display: true, position: 'bottom', labels: { color: 'white' } } } }
        });
    },

    renderSectorChart(assets) {
        const ctx = document.getElementById('sector-chart')?.getContext('2d');
        if (!ctx) return;
        const sectors = {};
        assets.forEach(asset => {
            const val = asset.quantity * asset.current_price;
            sectors[asset.sector || 'Outros'] = (sectors[asset.sector || 'Outros'] || 0) + val;
        });
        const labels = Object.keys(sectors);
        const data = Object.values(sectors);
        const bgColors = labels.map((_, i) => ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'][i % 5]);
        new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 0, cutout: '60%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: 'white' } } } } });
    },

    renderFixedYieldChart(assets) {
        const ctx = document.getElementById('fixed-yield-chart')?.getContext('2d');
        if (!ctx) return;
        const dataPoints = assets.map(a => ({ label: a.name, yield: a.quantity * a.average_price > 0 ? ((a.quantity * a.current_price - a.quantity * a.average_price) / (a.quantity * a.average_price)) * 100 : 0 }));
        dataPoints.sort((a, b) => b.yield - a.yield);
        new Chart(ctx, { type: 'bar', data: { labels: dataPoints.map(d => d.label), datasets: [{ data: dataPoints.map(d => d.yield), backgroundColor: dataPoints.map(d => d.yield >= 0 ? '#10B981' : '#EF4444') }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: 'white' } } } } });
    },

    async openAnalysisModal(id, name) {
        const modalHtml = this.renderAnalysisModal(id, name);
        const overlay = document.createElement('div');
        overlay.innerHTML = modalHtml;
        document.body.appendChild(overlay.firstElementChild);

        const modal = document.getElementById('analysis-modal');
        const overlayBg = document.getElementById('close-analysis-overlay');
        const closeBtn = document.getElementById('close-analysis-btn');
        const form = document.getElementById('analysis-form');

        const closeModal = () => {
            modal.classList.add('fade-out'); // Add CSS for exit animation if desired
            setTimeout(() => modal.remove(), 300);
        };

        overlayBg.onclick = closeModal;
        closeBtn.onclick = closeModal;

        // Fetch existing data
        const analysis = await AnalysisService.getAnalysis(id);

        // Populate inputs and Chart
        const criteria = ['profitability', 'perenniality', 'management', 'debt', 'moat', 'roe', 'cash_flow', 'dividends', 'governance', 'valuation'];

        const updateChart = () => {
            const values = criteria.map(c => parseInt(form.elements[c].value));
            this.renderRadarChart(values);
        };

        criteria.forEach(c => {
            const input = form.elements[c];
            if (analysis) input.value = analysis[c];
            // Update bubble label
            const label = input.parentElement.querySelector('.value-bubble');
            if (label) label.textContent = input.value;

            input.addEventListener('input', (e) => {
                if (label) label.textContent = e.target.value;
                updateChart();
            });
        });

        // Initial Chart Render
        updateChart();

        form.onsubmit = async (e) => {
            e.preventDefault();
            const scores = {};
            criteria.forEach(c => scores[c] = parseInt(form.elements[c].value));

            try {
                await AnalysisService.saveAnalysis(id, scores);
                Toast.show('Análise salva com sucesso!', 'success');
                closeModal();
            } catch (err) {
                Toast.show('Erro ao salvar análise: ' + err.message, 'error');
            }
        };
    },

    renderRadarChart(data) {
        const ctx = document.getElementById('analysis-radar-chart').getContext('2d');
        if (window.radarChartInstance) window.radarChartInstance.destroy();

        window.radarChartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Lucratividade', 'Perenidade', 'Gestão', 'Dívida', 'Vantagem', 'ROE', 'Caixa', 'Proventos', 'Governança', 'Preço'],
                datasets: [{
                    label: 'Pontuação',
                    data: data,
                    fill: true,
                    backgroundColor: 'rgba(212, 175, 55, 0.2)', // Brand Gold
                    borderColor: '#D4AF37',
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#D4AF37',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#D4AF37'
                }]
            },
            options: {
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#bbb', font: { size: 10 } },
                        ticks: { display: false, max: 5, min: 0, stepSize: 1 }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    },

    renderAnalysisModal(id, name) {
        const criteria = [
            { id: 'profitability', label: 'Empresa Lucrativa?', desc: 'Lucros consistentes ao longo dos anos.' },
            { id: 'perenniality', label: 'Setor Perene?', desc: 'Vai existir daqui 10, 20 anos?' },
            { id: 'management', label: 'Boa Gestão?', desc: 'Histórico e entrega da diretoria.' },
            { id: 'debt', label: 'Dívida Controlada?', desc: 'Dívida saudável em relação ao caixa.' },
            { id: 'moat', label: 'Vantagem Competitiva?', desc: 'Difícil de copiar (Fosso).' },
            { id: 'roe', label: 'ROE Alto?', desc: 'Rentabilidade sobre patrimônio.' },
            { id: 'cash_flow', label: 'Caixa Positivo?', desc: 'Entra dinheiro de verdade?' },
            { id: 'dividends', label: 'Bons Proventos?', desc: 'Paga ou cresce com inteligência.' },
            { id: 'governance', label: 'Governança Sólida?', desc: 'Respeita o minoritário (Tag Along).' },
            { id: 'valuation', label: 'Preço Justo?', desc: 'Não está cara demais (P/L, PVP).' }
        ];

        return `
            <div id="analysis-modal" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in hidden">
                <div class="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300" id="close-analysis-overlay"></div>
                <div class="fixed bottom-0 left-0 right-0 w-full bg-brand-surface border-t border-brand-border/50 rounded-t-[2rem] md:rounded-3xl shadow-2xl md:border md:border-brand-border/60 flex flex-col md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:min-w-[450px] md:h-auto max-h-[90vh] animate-slide-up md:animate-scale-in overflow-hidden">
                    
                    <!-- Decorative accent -->
                    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent"></div>
                    <div class="absolute -top-10 right-0 w-48 h-48 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Drag Handle (Mobile Only) -->
                    <div class="w-10 h-1 bg-brand-border rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>
                    
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-brand-border/50 flex justify-between items-center shrink-0 relative z-10">
                        <div>
                            <p class="text-[10px] text-brand-gold uppercase tracking-widest font-black opacity-70 mb-0.5">Diagrama do Cerrado</p>
                            <h3 class="text-lg font-black text-brand-text-primary tracking-tight">Analisando Ativo</h3>
                        </div>
                        <button class="bg-brand-surface-light hover:bg-brand-border rounded-xl p-2.5 text-brand-text-secondary hover:text-brand-text-primary transition-all active:scale-90" id="close-analysis-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <!-- Body -->
                    <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
                        <!-- Chart Area -->
                        <div class="h-64 relative bg-brand-bg rounded-2xl p-2 border border-brand-border/50">
                            <canvas id="analysis-radar-chart"></canvas>
                        </div>

                        <!-- Form Area -->
                        <form id="analysis-form" class="space-y-5">
                            ${criteria.map(c => `
                                <div>
                                    <div class="flex justify-between items-center mb-2">
                                        <div>
                                            <label class="block text-xs font-black text-brand-text-primary uppercase tracking-wider">${c.label}</label>
                                            <p class="text-[10px] text-brand-text-secondary opacity-70">${c.desc}</p>
                                        </div>
                                        <div class="value-bubble w-6 h-6 rounded-full bg-brand-gold text-brand-darker font-black text-[10px] flex items-center justify-center shadow-lg shadow-brand-gold/20">0</div>
                                    </div>
                                    <input type="range" name="${c.id}" min="0" max="5" value="0" step="1" class="w-full h-1 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-brand-gold border border-brand-border/20">
                                    <div class="flex justify-between text-[8px] text-brand-text-secondary font-black uppercase tracking-widest mt-1.5 opacity-60">
                                        <span>Ruim</span>
                                        <span>Excelente</span>
                                    </div>
                                </div>
                            `).join('')}
                            
                            <!-- Spacer -->
                            <div class="pb-32 md:pb-6"></div>
                        </form>
                    </div>

                    <!-- Footer -->
                    <div class="p-5 border-t border-brand-border/50 bg-brand-surface rounded-b-3xl shrink-0 safe-area-bottom z-10 relative">
                        <button type="submit" form="analysis-form" class="w-full bg-brand-gold hover:bg-yellow-500 text-brand-darker font-black py-4 rounded-2xl shadow-xl shadow-brand-gold/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                            Salvar Análise
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderAccountsTab() {
        const accounts = AccountsService.accounts;
        const totalBalance = AccountsService.getTotalBalance();

        return `
            <!-- Total Balance Card -->
            <div class="bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 border border-brand-gold/30 rounded-3xl p-6 mb-6 animate-fade-in-up">
                <p class="text-xs text-brand-gold uppercase tracking-widest font-bold mb-2">💰 Saldo Total em Contas</p>
                <h2 class="text-4xl font-black text-brand-text-primary">R$ ${(totalBalance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                <p class="text-xs text-brand-text-secondary mt-2">${accounts.filter(a => a.include_in_total).length} contas ativas</p>
            </div>

            <!-- Accounts List -->
            ${accounts.length === 0 ? `
                <div class="text-center py-16 animate-fade-in-up">
                    <div class="w-20 h-20 bg-brand-surface-light rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-4xl">💳</span>
                    </div>
                    <h3 class="text-lg font-bold text-brand-text-primary mb-2">Nenhuma conta cadastrada</h3>
                    <p class="text-sm text-brand-text-secondary mb-6">Adicione suas contas para rastrear saldos automaticamente</p>
                    <button onclick="window.app.openAccountModal()" class="bg-brand-gold text-brand-darker font-bold py-3 px-6 rounded-xl shadow-lg active:scale-95 transition">
                        Adicionar Primeira Conta
                    </button>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${accounts.map(account => this.renderAccountCard(account)).join('')}
                </div>
            `}
        `;
    },

    renderAccountCard(account) {
        const balance = account.current_balance || 0;
        const isNegative = balance < 0;
        const icon = account.icon || AccountsService.getTypeIcon(account.type);
        const typeLabel = AccountsService.getTypeLabel(account.type);

        return `
            <div class="bg-gradient-to-br from-brand-surface to-brand-surface-light border border-brand-border rounded-2xl p-5 hover:border-brand-gold/30 transition-all cursor-pointer group animate-fade-in-up" 
                 onclick="window.app.editAccount('${account.id}')"
                 style="border-left: 4px solid ${account.color}">
                
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style="background-color: ${account.color}20">
                            ${icon}
                        </div>
                        <div>
                            <h3 class="font-bold text-brand-text-primary text-sm">${account.name}</h3>
                            <p class="text-xs text-brand-text-secondary">${typeLabel}</p>
                            ${account.institution ? `<p class="text-[10px] text-brand-text-secondary">${account.institution}</p>` : ''}
                        </div>
                    </div>
                    ${!account.include_in_total ? `<span class="text-[9px] bg-gray-500/20 text-brand-text-secondary px-2 py-0.5 rounded">Oculto</span>` : ''}
                </div>

                <div class="flex justify-between items-end">
                    <div>
                        <p class="text-xs text-brand-text-secondary mb-1">Saldo Atual</p>
                        <p class="text-2xl font-black ${isNegative ? 'text-red-400' : 'text-brand-text-primary'}">
                            R$ ${(balance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <button onclick="event.stopPropagation(); window.app.openTransferModal('${account.id}')" 
                            class="text-xs bg-brand-surface-light hover:bg-brand-surface-light px-3 py-2 rounded-lg text-brand-gold transition flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Transferir
                    </button>
                </div>
            </div>
        `;
    },

    renderModal() {
        return `
            <div id="asset-modal" class="fixed inset-0 hidden" style="z-index: 9999;">
                <div class="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300" id="close-asset-overlay"></div>
                <div class="fixed bottom-0 left-0 right-0 w-full bg-brand-surface border-t border-brand-border/50 rounded-t-[2rem] md:rounded-3xl shadow-2xl md:border md:border-brand-border/60 flex flex-col md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:min-w-[500px] md:h-auto max-h-[90vh] animate-slide-up md:animate-scale-in overflow-hidden">
                    
                    <!-- Decorative accent -->
                    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent"></div>
                    <div class="absolute -top-10 right-0 w-48 h-48 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Drag Handle (Mobile Only) -->
                    <div class="w-10 h-1 bg-brand-border rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>
                    
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-brand-border/50 flex justify-between items-center shrink-0 relative z-10">
                        <div>
                            <h3 class="text-lg font-black text-brand-text-primary tracking-tight flex items-center gap-2">📈 Novo Ativo</h3>
                            <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest opacity-70 mt-0.5">Adicione um novo investimento</p>
                        </div>
                        <button class="bg-brand-surface-light hover:bg-brand-border rounded-xl p-2.5 text-brand-text-secondary hover:text-brand-text-primary transition-all active:scale-90" id="close-asset-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <!-- Body (Scrollable) -->
                    <form id="asset-form" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
                        <input type="hidden" name="id" id="asset-id">
                        
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Tipo de Ativo</label>
                            <select name="type" id="asset-type-select" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-10">
                                <option value="stock">Ação</option>
                                <option value="fii">Fundo Imobiliário (FII)</option>
                                <option value="fixed_income">Renda Fixa (CDB/LCI/LCA)</option>
                                <option value="treasure">Tesouro Direto</option>
                                <option value="crypto">Criptomoeda</option>
                            </select>
                        </div>

                        <!-- Common Fields -->
                        <div id="ticker-field" class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Ticker / Símbolo</label>
                            <input type="text" name="ticker" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30 uppercase" placeholder="EX: BTC, ETH, PETR4">
                        </div>
                        
                        <div id="name-field" class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Nome do Ativo</label>
                            <input type="text" name="name" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Bitcoin, Nubank">
                        </div>

                        <!-- Fixed Income Specifics -->
                        <div id="fixed-income-fields" class="hidden space-y-6 border-l-2 border-brand-gold/30 pl-4 py-2">
                             <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Emissor / Instituição</label>
                                <input type="text" name="issuer" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Banco Inter, Nubank">
                            </div>

                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Valor Aplicado (Principal)</label>
                                <input type="text" name="principal_amount" data-currency="true" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="R$ 0,00">
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Data de Aplicação</label>
                                    <input type="date" name="application_date" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all [color-scheme:dark]">
                                </div>
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Vencimento (Opcional)</label>
                                    <input type="date" name="maturity_date" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all [color-scheme:dark]">
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Tipo de Rentabilidade</label>
                                    <select name="indexer" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-10">
                                        <option value="CDI">Pós (CDI)</option>
                                        <option value="IPCA">Híbrido (IPCA+)</option>
                                        <option value="PRE">Pré-fixado</option>
                                        <option value="SELIC">Selic</option>
                                    </select>
                                </div>
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Taxa (%)</label>
                                    <input type="number" step="0.01" name="rate" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: 105">
                                </div>
                            </div>
                            
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Liquidez</label>
                                <select name="liquidity" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-10">
                                    <option value="daily">Liquidez Diária (D+0/D+1)</option>
                                    <option value="maturity">Apenas no Vencimento</option>
                                    <option value="d30">D+30 ou mais</option>
                                </select>
                            </div>

                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-gold z-10">Valor Atual (Bruto)</label>
                                <input type="text" name="current_value" data-currency="true" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="R$ 0,00">
                            </div>

                            <label class="flex items-center gap-3 bg-blue-500/10 p-4 rounded-2xl cursor-pointer border border-blue-500/20 hover:border-blue-500/40 transition-all">
                                <input type="checkbox" name="is_emergency_fund" id="investment-emergency-fund" class="w-5 h-5 rounded accent-blue-500 flex-shrink-0">
                                <span class="text-sm font-bold text-blue-400">🛡️ Compõe a Reserva de Emergência</span>
                            </label>
                        </div>

                        <!-- Variable Income Specifics -->
                        <div id="variable-income-fields" class="hidden space-y-6 border-l-2 border-blue-500/30 pl-4 py-2">
                             <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-blue-400 z-10">Setor</label>
                                <input type="text" name="sector" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Bancário, Energia">
                            </div>

                             <div class="grid grid-cols-2 gap-4">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-blue-400 z-10">Dividend Yield (%)</label>
                                    <input type="number" step="0.01" name="dividend_yield" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: 8.5">
                                </div>
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-blue-400 z-10">P/VP</label>
                                    <input type="number" step="0.01" name="p_vp" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: 1.05">
                                </div>
                            </div>
                        </div>

                         <!-- Crypto Specifics -->
                        <div id="crypto-fields" class="hidden border-l-2 border-purple-500/30 pl-4 py-2">
                             <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-purple-400 z-10">Exchange / Wallet</label>
                                <input type="text" name="crypto_issuer" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Binance, Ledger">
                            </div>
                        </div>

                        <!-- Values -->
                        <div class="grid grid-cols-2 gap-4">
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-emerald-500 z-10">Quantidade</label>
                                <input type="number" step="any" name="quantity" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="0">
                            </div>
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-blue-500 z-10">Preço Médio</label>
                                <input type="text" name="average_price" data-currency="true" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="R$ 0,00">
                            </div>
                        </div>

                        <div class="relative">
                             <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-primary z-10">Cotação Atual (R$)</label>
                             <input type="text" name="current_price" data-currency="true" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="R$ 0,00">
                        </div>

                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Classificação</label>
                            <select name="entity_context" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-10">
                                <option value="personal">👤 Pessoal (PF)</option>
                                <option value="business">💼 Empresa (PJ)</option>
                            </select>
                        </div>

                        <!-- Spacer for safe area -->
                        <div class="pb-32 md:pb-6"></div>
                    </form>

                    <!-- Footer -->
                    <div class="p-5 border-t border-brand-border/50 bg-brand-surface rounded-b-3xl shrink-0 safe-area-bottom z-10 relative flex flex-col gap-3">
                        <button type="submit" form="asset-form" class="w-full bg-brand-gold hover:bg-yellow-500 text-brand-darker font-black py-4 rounded-2xl shadow-xl shadow-brand-gold/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                            Salvar Ativo
                        </button>
                         <button type="button" id="btn-delete-asset" class="hidden w-full bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-2xl shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest">
                            Excluir Ativo
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderAccountModal() {
        return `
            <div id="account-modal" class="fixed inset-0 hidden" style="z-index: 9999;">
                <div class="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300" id="close-account-overlay"></div>
                <div class="fixed bottom-0 left-0 right-0 w-full bg-brand-surface border-t border-brand-border/50 rounded-t-[2rem] md:rounded-3xl shadow-2xl md:border md:border-brand-border/60 flex flex-col md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-xl md:min-w-[500px] md:h-auto max-h-[90vh] animate-slide-up md:animate-scale-in overflow-hidden">
                    
                    <!-- Decorative accent -->
                    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent"></div>
                    <div class="absolute -top-10 right-0 w-48 h-48 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Drag Handle (Mobile Only) -->
                    <div class="w-10 h-1 bg-brand-border rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>
                    
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-brand-border/50 flex justify-between items-center shrink-0 relative z-10">
                        <div>
                            <h3 class="text-lg font-black text-brand-text-primary tracking-tight flex items-center gap-2">💳 Nova Conta</h3>
                            <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest opacity-70 mt-0.5">Adicione uma nova fonte financeira</p>
                        </div>
                        <button class="bg-brand-surface-light hover:bg-brand-border rounded-xl p-2.5 text-brand-text-secondary hover:text-brand-text-primary transition-all active:scale-90" id="close-account-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <!-- Body -->
                    <form id="account-form" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
                        <input type="hidden" name="id" id="account-id">

                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Nome da Conta</label>
                            <input type="text" name="name" required class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Nubank, Dinheiro, PicPay">
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Tipo</label>
                                <select name="type" required class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-10">
                                    <option value="checking">💳 Corrente</option>
                                    <option value="savings">🏦 Poupança</option>
                                    <option value="wallet">📱 Digital</option>
                                    <option value="cash">💵 Dinheiro</option>
                                    <option value="investment">📈 Invest</option>
                                    <option value="credit">💎 Crédito</option>
                                </select>
                            </div>

                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Ícone (Emoji)</label>
                                <input type="text" name="icon" maxlength="2" class="w-full h-[54px] bg-brand-bg rounded-2xl border border-brand-border px-4 text-white text-center text-xl focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all" placeholder="💳">
                            </div>
                        </div>

                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Instituição (Opcional)</label>
                            <input type="text" name="institution" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Nubank, Banco do Brasil">
                        </div>

                        <div class="bg-brand-bg rounded-2xl p-5 border border-brand-border/50">
                            <label class="block text-[10px] font-black text-brand-text-secondary uppercase tracking-widest mb-2">Saldo Inicial</label>
                            <input type="text" inputmode="numeric" name="initial_balance" data-currency="true" required class="w-full bg-transparent text-4xl leading-none font-black text-brand-text-primary border-0 p-0 focus:ring-0 outline-none placeholder:text-brand-text-secondary/25" placeholder="R$ 0,00">
                        </div>

                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Cor Temática</label>
                            <div class="flex items-center bg-brand-bg rounded-2xl border border-brand-border p-2 focus-within:border-brand-gold transition-all">
                                <input type="color" name="color" value="#3B82F6" class="w-full h-10 bg-transparent rounded-xl cursor-pointer border-0 p-0 shadow-none">
                            </div>
                        </div>

                        <div class="space-y-3">
                            <label class="flex items-center gap-3 bg-brand-surface-light p-4 rounded-2xl cursor-pointer border border-brand-border/50 hover:border-brand-gold/30 transition-all">
                                <input type="checkbox" name="include_in_total" id="include-total" checked class="w-5 h-5 rounded accent-brand-gold flex-shrink-0">
                                <span class="text-sm font-bold text-brand-text-primary">Incluir no patrimônio total</span>
                            </label>

                            <label class="flex items-center gap-3 bg-blue-500/10 p-4 rounded-2xl cursor-pointer border border-blue-500/20 hover:border-blue-500/40 transition-all">
                                <input type="checkbox" name="is_emergency_fund" id="emergency-fund-toggle" class="w-5 h-5 rounded accent-blue-500 flex-shrink-0">
                                <span class="text-sm font-bold text-blue-400">🛡️ Faz parte da Reserva de Emergência</span>
                            </label>
                        </div>

                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Classificação</label>
                            <select name="context" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 outline-none transition-all appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-10">
                                <option value="personal">👤 Pessoal (PF)</option>
                                <option value="business">💼 Empresa (PJ)</option>
                            </select>
                        </div>
                        
                        <!-- Spacer -->
                        <div class="pb-32 md:pb-6"></div>
                    </form>
                    
                    <!-- Footer -->
                    <div class="p-5 border-t border-brand-border/50 bg-brand-surface rounded-b-3xl shrink-0 safe-area-bottom z-10 relative flex flex-col gap-3">
                        <button type="submit" form="account-form" class="w-full bg-brand-gold hover:bg-yellow-500 text-brand-darker font-black py-4 rounded-2xl shadow-xl shadow-brand-gold/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                            Salvar Conta
                        </button>
                        <button type="button" id="btn-delete-account" class="hidden w-full bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-2xl shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest">
                            Excluir Conta
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
};



