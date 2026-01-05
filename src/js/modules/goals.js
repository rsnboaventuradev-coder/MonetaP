import { GoalsService } from '../services/goals.service.js';
import { BudgetService } from '../services/budget.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { InvestmentsService } from '../services/investments.service.js';
import { Toast } from '../utils/toast.js';

export const GoalsModule = {
    chartInstance: null,

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        // 1. Initial Guard
        if (window.app.currentView !== 'goals') return;

        // 2. Render Shell (Immediate Feedback)
        this.renderShell(container);

        try {
            // 3. Async Inits
            // Using Promise.all calls to parallelize independent fetches if possible
            // But preserving dependency order if strictly needed. 
            // Goals and Budget are independent of each other.

            const promises = [];

            if (GoalsService.goals.length === 0) promises.push(GoalsService.init());
            if (BudgetService.allocations.length === 0) promises.push(BudgetService.init());

            // Investments might be needed for GIF calculation
            promises.push(InvestmentsService.init());

            await Promise.all(promises);

            // Guard again after await
            if (window.app.currentView !== 'goals') return;

            // 4. Render Full View
            this.renderView(container);

        } catch (error) {
            console.error('Goals Render Error:', error);
            if (window.app.currentView === 'goals') {
                Toast.show('Erro ao carregar metas', 'error');
                // Could render an error state in container here if desired
                container.innerHTML += `<div class="p-6 text-center text-red-400">Erro de conexão. Tente recarregar.</div>`;
            }
        }
    },

    renderShell(container) {
        container.innerHTML = `
            <div class="h-full flex flex-col bg-brand-dark safe-area-top overflow-y-auto pb-24">
                <header class="p-6 pb-4">
                    <h1 class="text-2xl font-bold text-brand-text-primary mb-1">Metas & Orçamento</h1>
                    <p class="text-brand-text-secondary text-sm">Carregando...</p>
                </header>
                <div class="flex items-center justify-center flex-1 h-64">
                     <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-gold"></div>
                </div>
            </div>
        `;
    },

    renderView(container) {
        const goals = GoalsService.goals;
        const allocations = BudgetService.allocations.sort((a, b) => b.percentage - a.percentage);

        // Calculate GIF (Passive Income / Cost of Living)
        // Cost of Living is currently static (placeholder), can be improved later to fetch from average expenses
        const costOfLiving = 5000;

        const passiveIncome = InvestmentsService.calculateProjectedMonthlyIncome();

        // Cap at 100% for the visual bar, but display real %. 
        // Logic: if living cost is 0, avoid division by zero.
        let gifPercentage = 0;
        if (costOfLiving > 0) {
            gifPercentage = (passiveIncome / costOfLiving) * 100;
        }

        const displayPercentage = Math.min(100, Math.round(gifPercentage));
        const realPercentageFormatted = gifPercentage.toFixed(1);

        container.innerHTML = `
            <div class="h-full flex flex-col bg-brand-dark safe-area-top overflow-y-auto pb-24">
                <header class="p-6 pb-4">
                    <h1 class="text-2xl font-bold text-brand-text-primary mb-1">Metas & Orçamento</h1>
                    <p class="text-brand-text-secondary text-sm">Planeje sua liberdade.</p>
                </header>

                <!-- Tab Navigation -->
                <div class="px-6 mb-6">
                    <div class="bg-brand-surface-light p-1 rounded-xl flex gap-1">
                        <button onclick="window.app.GoalsModule.switchTab('personal')" id="tab-personal" class="flex-1 py-2.5 rounded-lg text-sm font-bold bg-brand-gold text-brand-darker shadow-lg transition-all flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                            Pessoal
                        </button>
                        <button onclick="window.app.GoalsModule.switchTab('business')" id="tab-business" class="flex-1 py-2.5 rounded-lg text-sm font-bold text-brand-text-secondary hover:text-brand-text-primary transition-all flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            Empresa
                        </button>
                        <button onclick="window.app.GoalsModule.switchTab('savings')" id="tab-savings" class="flex-1 py-2.5 rounded-lg text-sm font-bold text-brand-text-secondary hover:text-brand-text-primary transition-all flex items-center justify-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                            Economias
                        </button>
                    </div>
                </div>

                <!-- Content Container -->
                <div id="goals-tab-content">
                    <!-- Dynamic content will be rendered here -->
                </div>
            </div>

            <!-- Modal -->
            ${this.renderModal()}
        `;

        // Set initial tab
        this.currentTab = 'personal';
        this.renderTabContent();
        window.app.GoalsModule = this;
        this.addListeners();
    },

    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        ['personal', 'business', 'savings'].forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (btn) {
                if (t === tab) {
                    btn.className = 'flex-1 py-2.5 rounded-lg text-sm font-bold bg-brand-gold text-brand-darker shadow-lg transition-all';
                } else {
                    btn.className = 'flex-1 py-2.5 rounded-lg text-sm font-bold text-brand-text-secondary hover:text-brand-text-primary transition-all';
                }
            }
        });

        this.renderTabContent();
    },

    renderTabContent() {
        const container = document.getElementById('goals-tab-content');
        if (!container) return;

        if (this.currentTab === 'business') {
            this.renderBusinessTab(container);
        } else if (this.currentTab === 'savings') {
            this.renderSavingsTab(container);
        } else {
            this.renderPersonalTab(container);
        }
    },

    renderPersonalTab(container) {
        const goals = GoalsService.goals;
        const allocations = BudgetService.getAllocations('personal').sort((a, b) => b.percentage - a.percentage);

        // Calculate GIF
        const costOfLiving = 5000;
        const passiveIncome = InvestmentsService.calculateProjectedMonthlyIncome();
        let gifPercentage = 0;
        if (costOfLiving > 0) {
            gifPercentage = (passiveIncome / costOfLiving) * 100;
        }
        const displayPercentage = Math.min(100, Math.round(gifPercentage));
        const realPercentageFormatted = gifPercentage.toFixed(1);

        container.innerHTML = `
                <!-- Budget Control Section -->
                <div class="px-6 mb-8">
                     <h2 class="text-lg font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                        <span class="w-1 h-6 bg-brand-gold rounded-full"></span>
                        Controle de Orçamento
                    </h2>
                    
                    <div class="bg-brand-darker rounded-2xl p-6 border border-brand-border grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Chart -->
                        <div class="h-48 relative flex justify-center items-center">
                            <canvas id="budgetChart"></canvas>
                            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span class="text-2xl font-bold text-brand-text-primary" id="totalBudgetUsage">100%</span>
                                <span class="text-xs text-brand-text-secondary">Total</span>
                            </div>
                        </div>

                        <!-- Sliders -->
                        <div class="space-y-4">
                            ${allocations.map(a => this.renderBudgetSlider(a)).join('')}
                            <button id="save-budget-btn" class="w-full bg-brand-gold text-brand-darker font-bold py-3 rounded-xl mt-4 active:scale-95 transition shadow-lg shadow-brand-gold/10">
                                Salvar Distribuição
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Goals Sections -->
                ${goals.length === 0 ? `
                    <div class="px-6 mb-8 mt-4 animate-fade-in-up">
                        <div class="bg-gradient-to-br from-brand-surface to-brand-bg border border-brand-border rounded-2xl p-8 text-center relative overflow-hidden group hover:border-brand-gold/20 transition-all cursor-pointer" onclick="document.getElementById('add-goal-modal').classList.remove('hidden')">
                             <div class="w-20 h-20 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition duration-300">
                                <span class="text-4xl">🎯</span>
                             </div>
                             <h3 class="text-xl font-bold text-brand-text-primary mb-2">Defina seus Objetivos</h3>
                             <p class="text-brand-text-secondary text-sm max-w-xs mx-auto mb-6">Transforme seus sonhos em realidade. Acompanhe o progresso de suas conquistas.</p>
                             <button class="bg-brand-gold text-brand-darker font-bold py-3 px-6 rounded-xl shadow-lg shadow-brand-gold/10 active:scale-95 transition">
                                Criar Primeira Meta
                             </button>
                        </div>
                    </div>
                ` : `
                    ${this.renderGoalsSection('Segurança (Curto Prazo)', 'security', goals)}
                    ${this.renderGoalsSection('Carreira (Médio Prazo)', 'career', goals)}
                    ${this.renderGoalsSection('Estilo de Vida (Longo Prazo)', 'lifestyle', goals)}
                    ${this.renderGoalsSection('Independência Financeira', 'financial_freedom', goals)}
                `}

                <!-- FAB -->
                <button id="fab-add-goal" class="fixed bottom-24 right-6 w-14 h-14 bg-brand-gold rounded-full shadow-lg shadow-brand-gold/20 flex items-center justify-center text-brand-text-primary active:scale-95 transition z-30">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            <!-- Modal -->
            ${this.renderModal()}
        `;

        this.initBudgetChart(allocations, 'personal');
        this.addListeners();
    },

    renderBudgetSlider(allocation) {
        const label = BudgetService.getLabel(allocation.category);
        const color = BudgetService.getColor(allocation.category);

        return `
            <div class="budget-slider-group">
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-brand-text-secondary font-medium" style="color: ${color}">${label}</span>
                    <span class="text-brand-text-primary font-bold" id="val-${allocation.category}">${allocation.percentage}%</span>
                </div>
                <input type="range" 
                    min="0" max="100" 
                    value="${allocation.percentage}" 
                    data-category="${allocation.category}"
                    class="w-full h-2 bg-brand-surface-light rounded-lg appearance-none cursor-pointer accent-[${color}]"
                    style="accent-color: ${color};"
                >
            </div>
        `;
    },

    renderGoalsSection(title, type, allGoals) {
        const goals = (allGoals && allGoals.length) ? allGoals.filter(g => g.type === type) : [];
        if (!goals.length) return '';

        return `
            <div class="px-6 mb-6">
                <h2 class="text-lg font-bold text-brand-text-primary mb-3 flex items-center gap-2">
                    <span class="w-1 h-6 bg-gray-500 rounded-full"></span>
                    ${title}
                </h2>
                <div class="space-y-3">
                    ${goals.map(g => this.renderGoalCard(g)).join('')}
                </div>
            </div>
        `;
    },

    renderGoalCard(goal) {
        const percentage = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
        const colorClass = percentage >= 100 ? 'bg-green-500' : 'bg-brand-gold';

        let extraInfo = '';
        if (goal.type === 'career') extraInfo = '<span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Investimento</span>';
        if (goal.type === 'lifestyle' && goal.maintenance_cost > 0) extraInfo = `<span class="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded">-${goal.maintenance_cost}/mês</span>`;

        return `
            <div class="bg-brand-surface-light rounded-2xl p-5 border border-brand-border relative overflow-hidden group active:scale-[0.99] transition cursor-pointer" onclick="window.app.viewGoal('${goal.id}')">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-brand-surface-light flex items-center justify-center text-xl">
                            ${goal.icon || '🎯'}
                        </div>
                        <div>
                            <h3 class="font-bold text-brand-text-primary leading-tight flex items-center gap-2">
                                ${goal.title}
                                ${extraInfo}
                            </h3>
                            <p class="text-xs text-brand-text-secondary">Meta: R$ ${parseFloat(goal.target_amount).toFixed(2)}</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold ${colorClass} text-brand-dark px-2 py-1 rounded-md">
                        ${percentage}%
                    </span>
                </div>

                <div class="relative h-2 bg-brand-surface-light rounded-full overflow-hidden mb-2">
                    <div class="absolute top-0 left-0 h-full ${colorClass} transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
                
                <div class="flex justify-between text-xs text-brand-text-secondary">
                    <span>R$ ${parseFloat(goal.current_amount || 0).toFixed(2)}</span>
                    ${goal.investment_link ? `<span class="italic text-brand-text-secondary truncate max-w-[100px]">${goal.investment_link}</span>` : ''}
                </div>
            </div>
        `;
    },

    renderModal() {
        return `
            <div id="add-goal-modal" class="fixed inset-0 z-50 hidden">
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" id="close-goal-overlay"></div>
                <div class="absolute bottom-0 w-full bg-[#18181b] rounded-t-3xl p-0 pb-8 animate-slide-up border-t border-brand-border h-[90vh] flex flex-col shadow-2xl shadow-black">
                    
                    <!-- Header -->
                    <div class="flex justify-between items-center p-6 border-b border-brand-border bg-brand-surface-light backdrop-blur-md sticky top-0 z-10 rounded-t-3xl">
                        <div>
                            <h3 class="text-xl font-bold text-brand-text-primary tracking-tight">Nova Meta</h3>
                            <p class="text-xs text-brand-text-secondary">Defina seu próximo objetivo financeiro</p>
                        </div>
                        <button class="w-8 h-8 rounded-full bg-brand-surface-light flex items-center justify-center text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/20 transition" id="close-goal-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Scrollable Content -->
                    <div class="overflow-y-auto flex-1 p-6 space-y-6">
                        <form id="add-goal-form" class="space-y-6">
                            
                            <!-- Goal Type Selection (Visual) -->
                            <div>
                                <label class="label-premium">Qual é o foco desta meta?</label>
                                <div class="grid grid-cols-2 gap-3 mt-3">
                                    <label class="cursor-pointer relative">
                                        <input type="radio" name="type" value="security" class="peer sr-only">
                                        <div class="p-4 rounded-xl bg-brand-surface-light border border-brand-border hover:bg-brand-surface-light peer-checked:bg-brand-green/10 peer-checked:border-brand-green peer-checked:text-brand-green transition flex flex-col items-center gap-2 text-center h-full">
                                            <svg class="w-8 h-8 text-brand-text-secondary peer-checked:text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                            </svg>
                                            <span class="text-xs font-bold text-brand-text-secondary peer-checked:text-brand-green">Segurança</span>
                                        </div>
                                    </label>
                                    <label class="cursor-pointer relative">
                                        <input type="radio" name="type" value="career" class="peer sr-only">
                                        <div class="p-4 rounded-xl bg-brand-surface-light border border-brand-border hover:bg-brand-surface-light peer-checked:border-blue-500 peer-checked:bg-blue-500/10 peer-checked:text-blue-500 transition flex flex-col items-center gap-2 text-center h-full">
                                            <svg class="w-8 h-8 text-brand-text-secondary peer-checked:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                            </svg>
                                            <span class="text-xs font-bold text-brand-text-secondary peer-checked:text-blue-500">Carreira</span>
                                        </div>
                                    </label>
                                    <label class="cursor-pointer relative">
                                        <input type="radio" name="type" value="lifestyle" class="peer sr-only" checked>
                                        <div class="p-4 rounded-xl bg-brand-surface-light border border-brand-border hover:bg-brand-surface-light peer-checked:border-pink-500 peer-checked:bg-pink-500/10 peer-checked:text-pink-500 transition flex flex-col items-center gap-2 text-center h-full">
                                            <span class="text-2xl">🌴</span>
                                            <span class="text-xs font-bold text-brand-text-secondary peer-checked:text-pink-500">Estilo de Vida</span>
                                        </div>
                                    </label>
                                    <label class="cursor-pointer relative">
                                        <input type="radio" name="type" value="financial_freedom" class="peer sr-only">
                                        <div class="p-4 rounded-xl bg-brand-surface-light border border-brand-border hover:bg-brand-surface-light peer-checked:border-brand-gold peer-checked:bg-brand-gold/10 peer-checked:text-brand-gold transition flex flex-col items-center gap-2 text-center h-full">
                                            <span class="text-2xl">🚀</span>
                                            <span class="text-xs font-bold text-brand-text-secondary peer-checked:text-brand-gold">Indep. Financeira</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <!-- Name Field -->
                            <div>
                                <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-wide mb-2 ml-1">Nome da Meta</label>
                                <input type="text" name="title" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-brand-text-primary focus:border-brand-gold focus:bg-brand-surface-light outline-none transition placeholder-gray-600 text-lg font-medium" placeholder="Ex: Viagem para Paris">
                            </div>

                            <!-- Values Section -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-wide mb-2 ml-1">Valor Alvo</label>
                                    <div class="relative">
                                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-secondary font-medium">R$</span>
                                        <input type="number" step="0.01" name="target_amount" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 pl-10 text-brand-text-primary focus:border-brand-gold focus:bg-brand-surface-light outline-none transition placeholder-gray-600 font-bold" placeholder="0,00">
                                    </div>
                                </div>
                                 <div class="group relative">
                                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-wide mb-2 ml-1 flex justify-between">
                                        Já Guardado
                                        <span class="text-[10px] text-brand-text-secondary bg-brand-surface-light px-2 py-0.5 rounded cursor-help" title="Saldo inicial se você já começou">?</span>
                                    </label>
                                    <div class="relative">
                                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-secondary font-medium">R$</span>
                                        <input type="number" step="0.01" name="current_amount" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 pl-10 text-brand-text-primary focus:border-brand-gold focus:bg-brand-surface-light outline-none transition placeholder-gray-600 font-bold" placeholder="0,00">
                                    </div>
                                </div>
                            </div>

                            <!-- Priority & Date -->
                            <div class="grid grid-cols-2 gap-4">
                                 <div>
                                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-wide mb-2 ml-1">Prioridade</label>
                                    <div class="relative">
                                        <select name="priority" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-brand-text-primary focus:border-brand-gold focus:bg-brand-surface-light outline-none transition appearance-none cursor-pointer">
                                            <option value="high">🔥 Alta</option>
                                            <option value="medium" selected>⚡ Média</option>
                                            <option value="low">🧊 Baixa</option>
                                        </select>
                                        <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-brand-text-secondary">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-wide mb-2 ml-1">Prazo (Opcional)</label>
                                    <input type="date" name="deadline" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-brand-text-primary focus:border-brand-gold focus:bg-brand-surface-light outline-none transition [color-scheme:dark]">
                                </div>
                            </div>

                            <!-- Conditional Fields -->
                            <div id="maintenance-field" class="bg-red-500/5 border border-red-500/20 rounded-xl p-4 hidden animate-fade-in-up">
                                <label class="block text-xs font-bold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Custo de Manutenção
                                </label>
                                <p class="text-[11px] text-brand-text-secondary mb-3">Possuir este item vai aumentar seu custo fixo mensal em quanto?</p>
                                <div class="relative">
                                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-red-300 font-medium">R$</span>
                                    <input type="number" step="0.01" name="maintenance_cost" class="w-full bg-red-500/10 rounded-lg border border-red-500/20 p-3 pl-10 text-brand-text-primary focus:border-red-500 outline-none transition placeholder-red-300/30">
                                </div>
                            </div>
                            
                            <!-- Submit Button -->
                            <div class="pt-2">
                                <button type="submit" class="w-full bg-brand-gold hover:bg-yellow-400 text-brand-darker font-bold py-4 rounded-xl shadow-lg shadow-brand-gold/20 active:scale-[0.98] transition flex items-center justify-center gap-2 text-lg">
                                    <span>Criar Meta</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            </style>
        `;
    },

    initBudgetChart(allocations, context = 'personal') {
        const ctx = document.getElementById('budgetChart');
        if (!ctx) return;

        if (this.chartInstance) this.chartInstance.destroy();

        // Default colors for Chart
        const colors = allocations.map(a => BudgetService.getColor(a.category));
        const labels = allocations.map(a => BudgetService.getLabel(a.category));
        const data = allocations.map(a => a.percentage);

        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        bodyColor: '#fff',
                        cornerRadius: 8,
                        displayColors: true
                    }
                }
            }
        });

        // Sliders Logic
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const category = e.target.dataset.category;
                const val = parseInt(e.target.value);

                // Update text
                document.getElementById(`val-${category}`).textContent = val + '%';

                // Update Chart Data (Optimistic)
                // Filter allocations by context to find correct index in specific context list if needed, 
                // but chart ignores other contexts? Chart is built from `allocations` arg.
                // We need to match slider category to the chart dataset index.
                const allocIndex = allocations.findIndex(a => a.category === category);

                if (allocIndex !== -1) {
                    allocations[allocIndex].percentage = val;
                    // Also update service state
                    BudgetService.save(category, val, context); // Optimistic save to service cache
                    this.chartInstance.data.datasets[0].data[allocIndex] = val;
                    this.chartInstance.update();
                }

                // Update Total
                const total = allocations.reduce((acc, curr) => acc + curr.percentage, 0);
                const totalEl = document.getElementById('totalBudgetUsage');
                totalEl.textContent = total + '%';
                totalEl.className = `text-2xl font-bold ${total === 100 ? 'text-green-500' : 'text-red-500'}`;
            });
        });

        document.getElementById('save-budget-btn').addEventListener('click', async () => {
            // Recalculate total from current UI or filtered list
            const currentAllocations = BudgetService.getAllocations(context);
            const total = currentAllocations.reduce((acc, curr) => acc + curr.percentage, 0);

            if (total !== 100) {
                Toast.show(`A distribuição deve somar 100%. Atual: ${total}%`, 'warning');
                return;
            }

            // Batch save
            for (const alloc of currentAllocations) {
                await BudgetService.save(alloc.category, alloc.percentage, context);
            }
            Toast.show('Orçamento salvo com sucesso!', 'success');
        });
    },

    addListeners() {
        const modal = document.getElementById('add-goal-modal');
        const fab = document.getElementById('fab-add-goal');
        const closeBtn = document.getElementById('close-goal-btn');
        const overlay = document.getElementById('close-goal-overlay');
        const form = document.getElementById('add-goal-form');
        const typeSelect = document.getElementById('goal-type-select');
        const maintenanceField = document.getElementById('maintenance-field');

        const openModal = () => modal.classList.remove('hidden');
        const closeModal = () => modal.classList.add('hidden');

        if (fab) fab.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

        // Update listener for Radio Buttons
        form.addEventListener('change', (e) => {
            if (e.target.name === 'type') {
                if (e.target.value === 'lifestyle') {
                    maintenanceField.classList.remove('hidden');
                } else {
                    maintenanceField.classList.add('hidden');
                }
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);

            const newGoal = {
                title: formData.get('title'),
                target_amount: formData.get('target_amount'),
                current_amount: formData.get('current_amount'),
                deadline: formData.get('deadline') || null,
                priority: formData.get('priority'),
                type: formData.get('type'),
                maintenance_cost: formData.get('maintenance_cost'),
                investment_link: formData.get('investment_link'),
                icon: '🎯'
            };

            try {
                await GoalsService.create(newGoal);
                Toast.show('Meta criada com sucesso!', 'success');
                closeModal();
                this.render();
            } catch (error) {
                console.error(error);
                Toast.show('Erro ao salvar meta: ' + error.message, 'error');
            }
        });

        window.app.viewGoal = async (id) => {
            const amount = await window.ModalUtils.prompt(
                'Adicionar Valor',
                'Deseja adicionar valor a esta meta?',
                { placeholder: 'Ex: 50.00', inputType: 'number' }
            );
            if (amount && !isNaN(parseFloat(amount))) {
                await GoalsService.addContribution(id, parseFloat(amount));
                this.renderTabContent();
            }
        };
    },

    async saveAllocations() {
        const modal = document.getElementById('edit-allocations-modal');
        const inputs = document.querySelectorAll('.allocation-input');
        const context = modal.dataset.context || 'personal';

        // Validation sum = 100
        let total = 0;
        const updates = [];

        inputs.forEach(input => {
            const val = parseInt(input.value) || 0;
            total += val;
            updates.push({
                category: input.dataset.category,
                percentage: val
            });
        });

        if (total !== 100) {
            Toast.show(`O total deve ser 100%. Atual: ${total}%`, 'error');
            return;
        }

        try {
            for (const u of updates) {
                await BudgetService.save(u.category, u.percentage, context);
            }

            Toast.show('Alocações atualizadas com sucesso!', 'success');
            document.getElementById('edit-allocations-modal').classList.add('hidden');
            this.renderTabContent(); // Re-render current tab
        } catch (error) {
            console.error(error);
            Toast.show('Erro ao salvar alocações.', 'error');
        }
    },

    renderBusinessTab(container) {
        const pjBudget = GoalsService.getPJBudget();
        const dre = GoalsService.calculatePJDRE();
        const allocations = BudgetService.getAllocations('business').sort((a, b) => b.percentage - a.percentage);

        // Calculate Totals for top cards
        const targetRevenue = pjBudget.revenues.reduce((acc, g) => acc + parseFloat(g.target_amount || 0), 0);
        const currentRevenue = pjBudget.revenues.reduce((acc, g) => acc + parseFloat(g.current_amount || 0), 0) / 100;

        container.innerHTML = `
            <!-- Budget Control Section (Pie Chart) -->
             <div class="px-6 mb-8 mt-2">
                 <h2 class="text-lg font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                    <span class="w-1 h-6 bg-brand-gold rounded-full"></span>
                    Estrutura de Custos PJ
                 </h2>
                 
                 <div class="bg-brand-darker rounded-2xl p-6 border border-brand-border grid grid-cols-1 md:grid-cols-2 gap-8">
                     <!-- Chart -->
                     <div class="h-48 relative flex justify-center items-center">
                         <canvas id="budgetChart"></canvas>
                         <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                             <span class="text-2xl font-bold text-brand-text-primary" id="totalBudgetUsage">100%</span>
                             <span class="text-xs text-brand-text-secondary">Total</span>
                         </div>
                     </div>

                     <!-- Sliders -->
                     <div class="space-y-4">
                         ${allocations.map(a => this.renderBudgetSlider(a)).join('')}
                         <button id="save-budget-btn" class="w-full bg-brand-gold text-brand-darker font-bold py-3 rounded-xl mt-4 active:scale-95 transition shadow-lg shadow-brand-gold/10">
                             Salvar Distribuição PJ
                         </button>
                     </div>
                 </div>
            </div>

            <!-- DRE Summary -->
            <div class="px-6 mb-6">
                <h2 class="text-lg font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                    <span class="w-1 h-6 bg-purple-500 rounded-full"></span>
                    DRE Simplificado
                </h2>
                <div class="grid grid-cols-3 gap-3">
                    <div class="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-xl p-4">
                        <p class="text-xs text-brand-text-secondary mb-1">Receitas</p>
                        <p class="text-xl font-black text-green-400">R$ ${currentRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p class="text-[10px] text-brand-text-secondary mt-1">Meta: R$ ${targetRevenue.toLocaleString('pt-BR')}</p>
                    </div>
                    <div class="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <p class="text-xs text-brand-text-secondary mb-1">Despesas</p>
                        <p class="text-xl font-black text-red-400">R$ ${(dre.expenses / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div class="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                        <p class="text-xs text-brand-text-secondary mb-1">Lucro</p>
                        <p class="text-xl font-black ${dre.profit >= 0 ? 'text-blue-400' : 'text-red-400'}">R$ ${(dre.profit / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p class="text-[10px] text-brand-text-secondary mt-1">Margem: ${dre.margin.toFixed(1)}%</p>
                    </div>
                </div>
            </div>
            
            ${this.renderPJSection('💰 Receitas', pjBudget.revenues, 'revenue')}
            ${this.renderPJSection('💻 Custos Operacionais', pjBudget.expenses.fixed_costs, 'expense')}
            ${this.renderPJSection('📦 Insumos e Materiais', pjBudget.expenses.taxes, 'expense')}
            ${this.renderPJSection('👥 Equipe e Terceirizados', pjBudget.expenses.personnel, 'expense')}
            
            ${(pjBudget.revenues.length === 0 && Object.values(pjBudget.expenses).every(arr => arr.length === 0)) ? `
                <div class="px-6 mb-8 mt-4 animate-fade-in-up">
                    <button onclick="window.app.GoalsModule.createPJTemplate()" class="w-full bg-purple-500 hover:bg-purple-600 text-brand-text-primary font-bold py-4 px-6 rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-3">
                        <span>🚀</span> Criar Orçamento PJ Padrão
                    </button>
                </div>
            ` : ''}
        `;

        this.initBudgetChart(allocations, 'business');
        // Note: No addListeners() specific to sliders here? 
        // Assuming addListeners logic is mainly for modals, but initBudgetChart attaches slider listeners.
        // Check addListeners usage in PersonalTab. Ah, renderPersonalTab calls this.initBudgetChart AND this.addListeners.
        // renderBusinessTab does NOT call this.addListeners()? 
        // IMPORTANT: The sliders work via initBudgetChart. But if we need modals for adding items, we probably need addListeners or ensure they are globally active.
        // Let's call addListeners just to be safe if PJ tab uses similar modals.
        // Actually, renderPJSection uses createPJTemplate but also maybe "View Goal". "View Goal" is global.
        // So we likely don't strictly need addListeners unless using the same Add Goal modal.
        // But PJ uses template. Let's stick to initChart.
    },

    renderPJSection(title, goals, type) {
        if (!goals || goals.length === 0) return '';
        return `
            <div class="px-6 mb-6">
                <h3 class="text-sm font-bold text-brand-text-secondary mb-3 uppercase tracking-wider">${title}</h3>
                <div class="space-y-2">
                    ${goals.map(g => this.renderPJGoalCard(g, type)).join('')}
                </div>
            </div>
        `;
    },

    renderPJGoalCard(goal, type) {
        const current = parseFloat(goal.current_amount || 0) / 100;
        const target = parseFloat(goal.target_amount || 0);
        const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        const colorClass = type === 'revenue' ? 'bg-green-500' : 'bg-red-500';
        return `
            <div class="bg-brand-surface-light rounded-xl p-4 border border-brand-border hover:bg-brand-surface-light transition cursor-pointer" onclick="window.app.viewGoal('${goal.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">${goal.icon || '📊'}</span>
                        <div>
                            <h4 class="font-bold text-brand-text-primary text-sm">${goal.name}</h4>
                            <p class="text-xs text-brand-text-secondary">Meta: R$ ${target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold ${colorClass} text-brand-text-primary px-2 py-1 rounded-md">${percentage}%</span>
                </div>
                <div class="relative h-2 bg-brand-surface-light rounded-full overflow-hidden">
                    <div class="absolute top-0 left-0 h-full ${colorClass} transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
                <div class="flex justify-between text-xs text-brand-text-secondary mt-1">
                    <span>R$ ${current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    ${goal.is_progressive ? '<span class="text-blue-400">📈 Progressivo</span>' : ''}
                </div>
            </div>
        `;
    },

    renderSavingsTab(container) {
        const savingsGoals = GoalsService.goals.filter(g => g.budget_type === 'savings' || g.type === 'security');
        container.innerHTML = `
            <div class="px-6">
                <h2 class="text-lg font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                    <span class="w-1 h-6 bg-green-500 rounded-full"></span>
                    Reservas e Economias
                </h2>
                ${savingsGoals.length === 0 ? `
                    <div class="bg-brand-surface-light rounded-2xl p-8 text-center">
                        <span class="text-4xl mb-4 block">💰</span>
                        <p class="text-brand-text-secondary">Nenhuma reserva cadastrada ainda.</p>
                    </div>
                ` : `
                    <div class="space-y-3">
                        ${savingsGoals.map(g => this.renderGoalCard(g)).join('')}
                    </div>
                `}
            </div>
        `;
    },

    async createPJTemplate() {
        try {
            const count = await GoalsService.createPJBudgetTemplate();
            Toast.show(`${count} categorias criadas com sucesso!`, 'success');
            this.renderTabContent();
        } catch (error) {
            console.error(error);
            Toast.show('Erro ao criar template: ' + error.message, 'error');
        }
    }
};



