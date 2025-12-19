import { TransactionService } from '../services/transaction.service.js';
import { InvestmentsService } from '../services/investments.service.js';
import { PartnersService } from '../services/partners.service.js';
import { GoalsService } from '../services/goals.service.js';
import { BudgetService } from '../services/budget.service.js';
import { SupabaseService } from '../services/supabase.service.js';

export const DashboardModule = {
    currentContext: 'personal', // 'personal' | 'business'
    chartInstances: {},

    async render() {
        const container = document.getElementById('main-content');

        // Ensure all data is ready
        await Promise.all([
            TransactionService.init(),
            InvestmentsService.init(),
            PartnersService.init(),
            GoalsService.init(),
            BudgetService.init()
        ]);

        await this.renderView(container);
    },

    async renderView(container) {
        // --- DATA PREPARATION ---
        const session = await SupabaseService.getSession();
        const user = session?.user;

        // Fetch Profile for Cost of Living
        let avgCostOfLiving = 5000; // Default
        if (user) {
            const { data: profile } = await SupabaseService.client
                .from('profiles')
                .select('monthly_income')
                .eq('id', user.id)
                .maybeSingle();

            if (profile && profile.monthly_income) {
                avgCostOfLiving = parseFloat(profile.monthly_income);
            }
        }

        const today = new Date();
        const balance = TransactionService.getBalance(); // Total (need to filter by context if separated)
        // For this version, 'getBalance' is total. If we want context specific balance, we'd need to filter txs.
        // Assuming 'getBalance' sums everything. Let's filter manually if needed.
        const allTxs = TransactionService.transactions;
        const contextTxs = this.currentContext === 'all' ? allTxs : allTxs.filter(t => t.context === this.currentContext);

        const contextBalance = contextTxs.reduce((acc, tx) => {
            return tx.type === 'income' ? acc + parseFloat(tx.amount) : acc - parseFloat(tx.amount);
        }, 0);

        // DRE (Profit of the Month)
        const dre = TransactionService.getFinancialStatement(today.getMonth(), today.getFullYear(), this.currentContext);

        // Next 7 Days
        const next7Days = TransactionService.getNext7DaysFlow(this.currentContext);

        // BI: Partner Ranking (Income only)
        const partners = PartnersService.partners;
        const partnerRanking = partners.map(p => {
            const total = allTxs
                .filter(t => t.partner_id === p.id && t.type === 'income')
                .reduce((acc, t) => acc + parseFloat(t.amount), 0);
            return { name: p.name, total, color: p.color };
        }).sort((a, b) => b.total - a.total).slice(0, 3); // Top 3

        // Long Term: Indices
        // GIF
        const gifVal = InvestmentsService.calculateGIF(avgCostOfLiving);

        // ARCA (Asset Allocation)
        const arca = InvestmentsService.calculateARCA();

        // Emergency Fund Progress
        const emergencyFundGoal = GoalsService.goals.find(g => g.name.toLowerCase().includes('emergência') || g.type === 'safety');
        const emergencyProgress = emergencyFundGoal ? (emergencyFundGoal.current_amount / emergencyFundGoal.target_amount) * 100 : 0;

        // Operations: Lab Bills
        // Find expenses with category 'Laboratório' or similar keywords and status 'pending'
        const pendingLabBills = allTxs.filter(tx =>
            tx.type === 'expense' &&
            tx.status === 'pending' &&
            (tx.description.toLowerCase().includes('lab') || tx.description.toLowerCase().includes('protético') || (tx.classification === 'laboratorio'))
        );
        const labBillsTotal = pendingLabBills.reduce((acc, tx) => acc + parseFloat(tx.amount), 0);


        // ... existing renderView content ...

        // --- HTML CONSTRUCTION ---
        container.innerHTML = `
            <div class="flex flex-col min-h-full bg-brand-bg safe-area-top pb-24 space-y-6">
                
                <!-- 1. HEADER & TOGGLE -->
                <div class="px-6 pt-6 flex justify-between items-center bg-brand-bg sticky top-0 z-20 pb-4 border-b border-white/5 backdrop-blur-md">
                    <div>
                        <p class="text-xs text-gray-400 font-medium uppercase tracking-wider">Dashboard</p>
                        <h1 class="text-2xl font-bold text-white leading-none mt-1">Visão Geral</h1>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="document.body.classList.toggle('privacy-active')" class="text-gray-400 hover:text-white transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <!-- Context Toggle -->
                        <div class="flex bg-brand-surface rounded-full p-1 border border-white/5">
                            <button onclick="window.app.toggleDashboardContext('personal')" 
                                class="px-3 py-1.5 rounded-full text-xs font-bold transition-all ${this.currentContext === 'personal' ? 'bg-brand-gold text-brand-darker shadow-lg shadow-brand-gold/20' : 'text-gray-400 hover:text-white'}">
                                PF
                            </button>
                            <button onclick="window.app.toggleDashboardContext('business')" 
                                class="px-3 py-1.5 rounded-full text-xs font-bold transition-all ${this.currentContext === 'business' ? 'bg-brand-green text-brand-darker shadow-lg shadow-brand-green/20' : 'text-gray-400 hover:text-white'}">
                                PJ
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2. LIQUID CASH (The "Hoje") -->
                <div class="px-6 space-y-4">
                    <!-- Balance Card -->
                    <div class="bg-gradient-to-br from-brand-surface to-brand-surface-light rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden">
                         <div class="relative z-10">
                            <p class="text-gray-400 text-xs font-medium mb-1">Saldo em Conta</p>
                            <h2 class="text-4xl font-black text-white tracking-tight">R$ ${contextBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                            
                            <!-- DRE Mini-Widget -->
                            <div class="mt-6 flex gap-4 border-t border-white/5 pt-4">
                                <div class="flex-1">
                                    <p class="text-[10px] text-gray-400 uppercase">Receita Mês</p>
                                    <p class="text-brand-green-light font-bold text-sm">+ ${dre.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                <div class="flex-1 border-l border-white/5 pl-4">
                                    <p class="text-[10px] text-gray-400 uppercase">Lucro Líquido</p>
                                    <p class="${dre.profit >= 0 ? 'text-white' : 'text-brand-red'} font-bold text-sm">
                                        ${dre.profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                         </div>
                    </div>

                    <!-- Next 7 Days Cashflow -->
                    <div class="bg-brand-surface/50 rounded-2xl p-4 border border-white/5">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-xs text-gray-300 font-bold uppercase tracking-wider">Fluxo 7 Dias</h3>
                            <span class="text-[10px] ${next7Days.totalReceivable - next7Days.totalPayable >= 0 ? 'text-brand-green' : 'text-brand-red'} font-bold">
                                Líq: ${(next7Days.totalReceivable - next7Days.totalPayable).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div class="flex justify-between gap-2 overflow-x-auto pb-2 scrollbar-none">
                            ${next7Days.flow.map(day => `
                                <div class="flex flex-col items-center min-w-[3rem] p-2 rounded-xl ${day.net < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'} border">
                                    <span class="text-[10px] text-gray-400 font-bold mb-1">${day.dayName}</span>
                                    <span class="text-xs font-bold text-white">${day.date.getDate()}</span>
                                    ${day.net !== 0 ? `
                                        <span class="text-[9px] mt-1 ${day.net > 0 ? 'text-brand-green' : 'text-brand-red'}">
                                            ${day.net > 0 ? '•' : ''}${Math.abs(day.net).toLocaleString('pt-BR', { notation: 'compact' })}
                                        </span>
                                    ` : '<span class="text-[9px] mt-1 text-gray-600">-</span>'}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- 3. BUSINESS INTELLIGENCE (Partner Ranking) - Only for PJ/All -->
                ${this.currentContext !== 'personal' ? `
                <div class="px-6">
                    <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <span class="w-1 h-4 bg-brand-gold rounded-full"></span>
                        Ranking de Receita
                    </h3>
                    <div class="space-y-3">
                        ${partnerRanking.map((p, i) => `
                            <div class="mb-2">
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-gray-300 font-medium">${i + 1}. ${p.name}</span>
                                    <span class="text-white font-bold">${p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                                <div class="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                    <div class="h-full rounded-full" style="width: ${(p.total / (partnerRanking[0].total || 1)) * 100}%; background-color: ${p.color}"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 4. LONG TERM METRICS (The "Amanhã") -->
                <div class="px-6">
                    <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <span class="w-1 h-4 bg-purple-500 rounded-full"></span>
                        Liberdade Financeira
                    </h3>
                    <div class="grid grid-cols-2 gap-3">
                        <!-- GIF -->
                        <div class="bg-brand-surface/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                            <span class="text-2xl font-black text-white">${gifVal.toFixed(0)}%</span>
                            <span class="text-[10px] text-gray-400 uppercase font-bold mt-1">Grau de Indep.</span>
                            <div class="w-full bg-gray-800 h-1 mt-2 rounded-full overflow-hidden">
                                <div class="bg-purple-500 h-full" style="width: ${Math.min(gifVal, 100)}%"></div>
                            </div>
                        </div>
                        <!-- Emergency Fund -->
                        <div class="bg-brand-surface/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                            <span class="text-2xl font-black text-white">${emergencyProgress.toFixed(0)}%</span>
                            <span class="text-[10px] text-gray-400 uppercase font-bold mt-1">Reserva Emerg.</span>
                            <div class="w-full bg-gray-800 h-1 mt-2 rounded-full overflow-hidden">
                                <div class="bg-blue-500 h-full" style="width: ${Math.min(emergencyProgress, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 5. OPERATIONS & ALERTS -->
                ${pendingLabBills.length > 0 ? `
                <div class="px-6">
                    <div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h4 class="text-red-400 font-bold text-sm">Boletos Laboratório</h4>
                                <p class="text-xs text-gray-400">${pendingLabBills.length} pendentes</p>
                            </div>
                        </div>
                        <span class="text-white font-bold text-sm">${labBillsTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
                ` : ''}

                <!-- 6. QUICK ACTIONS (Sticky Bottom/FAB style) -->
                <div class="px-6 grid grid-cols-2 gap-4">
                    <button onclick="window.app.openTransactionModal('income')" 
                        class="bg-brand-surface border border-white/10 hover:bg-brand-surface-light p-4 rounded-2xl flex items-center gap-3 transition group active:scale-95">
                        <div class="w-10 h-10 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center group-hover:scale-110 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <div class="text-left">
                            <p class="text-white font-bold text-sm">Novo</p>
                            <p class="text-[10px] text-gray-400">Lançamento</p>
                        </div>
                    </button>
                     <button onclick="window.app.openTransactionModal('income', { description: 'Recebimento Clínica' })" 
                        class="bg-brand-surface border border-white/10 hover:bg-brand-surface-light p-4 rounded-2xl flex items-center gap-3 transition group active:scale-95">
                        <div class="w-10 h-10 rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center group-hover:scale-110 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                            </svg>
                        </div>
                        <div class="text-left">
                            <p class="text-white font-bold text-sm">Vincular</p>
                            <p class="text-[10px] text-gray-400">Receita</p>
                        </div>
                    </button>
                </div>

                <!-- MODAL (Integrated for Quick Actions) -->
                ${this.renderModalID()}
            </div>
        `;

        this.addModalListeners(container);
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
                } catch (error) {
                    alert('Erro: ' + error.message);
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

