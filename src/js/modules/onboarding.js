import { supabase } from '../services/supabase.service.js';
import { GoalsService } from '../services/goals.service.js';
import { SettingsService } from '../services/settings.service.js';

import { Toast } from '../utils/toast.js';
import { AccountsService } from '../services/accounts.service.js';
import { CurrencyMask } from '../utils/mask.js';

export const OnboardingModule = {
    data: {
        type: null, // 'PF' or 'PJ'
        monthly_income: 0,
        cost_of_living: 0,
        current_balance: 0,
        age: 0,
        onboarding_progress: 'identity', // 'identity', 'snapshot', 'completed'
        step_accounts_completed: false
    },

    // Status tracking for UI
    status: {
        identity: 'active', // active, completed, locked
        snapshot: 'locked',
        refinement: 'locked',
        investments: 'locked'
    },

    async init() {
        console.log('Onboarding: Checking status...');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch current status
        const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed, onboarding_progress, type, cost_of_living, current_balance, age, step_accounts_completed')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile || !profile.onboarding_completed) {
            // Restore progress state
            if (profile?.onboarding_progress) {
                this.data.onboarding_progress = profile.onboarding_progress;
            }
            if (profile?.type) {
                this.data.type = profile.type;
            }

            this.updateStatusMap();
            // this.renderDashboard(); // Blocking overlay removed in favor of Carousel Widget
        } else {
            console.log('Onboarding: Completed previously.');
        }
    },

    updateStatusMap() {
        // Sync with real data from Services if available
        const hasAccounts = AccountsService?.accounts?.length > 0;
        // const hasGoals = GoalsService?.goals?.length > 0; // If GoalsService is available

        const p = this.data.onboarding_progress;

        // Reset defaults
        this.status = { identity: 'active', snapshot: 'locked', refinement: 'locked', investments: 'locked', credit_cards: 'locked', accounts: 'active' };

        // 1. Accounts
        if (hasAccounts || this.data.step_accounts_completed) {
            this.status.accounts = 'completed';
            this.status.identity = 'active'; // Unlock next
        } else {
            this.status.accounts = 'active';
        }

        // 2. Identity
        if (this.status.accounts === 'completed') {
            if (p === 'snapshot' || p === 'completed' || this.data.onboarding_completed) {
                this.status.identity = 'completed';
                this.status.snapshot = 'active';
            } else {
                this.status.identity = 'active';
            }
        }

        // 3. Snapshot / Goals
        if (this.status.identity === 'completed') {
            if (p === 'completed' || this.data.onboarding_completed) {
                this.status.snapshot = 'completed'; // Goals/Snapshot done
                this.status.credit_cards = 'active';
            } else {
                this.status.snapshot = 'active';
            }
        }

        // 4. Credit Cards
        if (this.status.snapshot === 'completed') {
            this.status.credit_cards = 'active';
        }
    },




    renderCarouselWidget(containerId) {
        // Ensure status is up to date before render
        this.updateStatusMap();

        const container = document.getElementById(containerId);
        if (!container) return;

        // Force display block to ensure visibility if it was hidden previously
        container.style.display = 'block';

        // Check if everything is ABSOLUTELY done and user doesn't want to see it?
        // For now, allow it to remain visible or maybe user can minimize it.
        // We will keep it visible to check status marks.

        container.innerHTML = `
            <div class="mb-2 pr-6 flex justify-between items-end">
                <h3 class="text-lg font-bold text-brand-text-primary">Próximos passos</h3>
                <span class="text-xs text-brand-text-secondary mb-1">Passo ${this.getCompletedCount()} de 4</span>
            </div>
            
            <div class="flex overflow-x-auto gap-4 pb-6 pt-2 px-1 snap-x snap-mandatory hide-scrollbar">
                <!-- CARD 1: SALDO (Contas) -->
                ${this._renderCarouselCard('accounts', 'Informe seu saldo', 'Definir contas e reserva de emergência.', '💰', '1 de 4')}

                <!-- CARD 2: RENDA -->
                ${this._renderCarouselCard('identity', 'Registre sua renda', 'Adicione sua principal fonte de renda.', '💵', '2 de 4')}

                <!-- CARD 3: GASTOS (Metas) -->
                ${this._renderCarouselCard('snapshot', 'Adicione metas', 'Crie seus primeiros objetivos.', '📉', '3 de 4')}

                <!-- CARD 4: CARTÕES (Faturas) -->
                ${this._renderCarouselCard('credit_cards', 'Cadastre seus cartões', 'Gerencie faturas e pagamentos.', '💳', '4 de 4')}
            </div>
        `;

        this.addCardListeners();
    },

    getCompletedCount() {
        let count = 0;
        if (this.status.accounts === 'completed') count++;
        if (this.status.identity === 'completed') count++;
        if (this.status.snapshot === 'completed') count++; // Mapping snapshot to "Gastos Recorrentes" for simplicity or create new logic
        if (this.status.credit_cards === 'completed') count++;
        return count;
    },

    _renderCarouselCard(stepKey, title, desc, icon, stepLabel) {
        const state = this.status[stepKey] || 'locked';
        const isCompleted = state === 'completed';
        const isActive = state === 'active';

        let cardBg = 'bg-brand-surface';
        let borderClass = 'border-brand-border';
        let opacity = '';
        let buttonClass = 'bg-brand-bg text-brand-text-primary';
        let btnIcon = 'chevron-right';

        if (isActive) {
            cardBg = 'bg-brand-surface ring-2 ring-brand-gold/20';
            borderClass = 'border-brand-gold';
            buttonClass = 'bg-brand-gold text-white shadow-glow-gold';
        } else if (isCompleted) {
            opacity = 'opacity-80';
            borderClass = 'border-green-500/30';
            cardBg = 'bg-green-50/50 dark:bg-green-900/10';
            buttonClass = 'bg-green-500 text-white';
            btnIcon = 'check';
        } else {
            // Locked or future
            opacity = 'opacity-60 grayscale-[0.5]';
        }

        return `
            <div id="card-${stepKey}" class="min-w-[260px] max-w-[260px] snap-center flex flex-col p-5 rounded-2xl border ${borderClass} ${cardBg} ${opacity} relative group transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                
                 ${isActive ? `<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gold text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm uppercase tracking-wide">Atual</div>` : ''}

                <div class="flex justify-between items-start mb-4">
                    <div class="w-10 h-10 rounded-full bg-brand-surface-light flex items-center justify-center text-xl shadow-sm">
                        ${icon}
                    </div>
                    <span class="text-[10px] font-bold text-brand-text-secondary bg-brand-bg px-2 py-1 rounded-lg border border-brand-border">
                        ${stepLabel}
                    </span>
                </div>

                <h4 class="font-bold text-brand-text-primary text-base mb-1 leading-tight">${title}</h4>
                <p class="text-xs text-brand-text-secondary leading-relaxed mb-6 flex-1">${desc}</p>

                <div class="flex items-center justify-between mt-auto">
                    <span class="text-[10px] font-medium text-brand-text-secondary flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        2 min
                    </span>
                    <button class="w-8 h-8 rounded-xl ${buttonClass} flex items-center justify-center transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            ${isCompleted
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />'
            }
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    addCardListeners() {
        const accountsCard = document.getElementById('card-accounts');
        const identityCard = document.getElementById('card-identity');
        const snapshotCard = document.getElementById('card-snapshot'); // Metas
        const creditCard = document.getElementById('card-credit_cards'); // Cartões

        // 1. Accounts -> Navigate to Investments (as requested)
        if (accountsCard) {
            accountsCard.onclick = () => {
                window.app.navigateTo('investments');
            };
        }

        // 2. Identity -> Navigate to Settings (Partners/Income Sources)
        if (identityCard && this.status.identity === 'active') { // Keep active check for modals
            identityCard.onclick = () => window.app.navigateTo('settings');
        }

        // 3. Snapshot (Metas) -> Navigate to Goals
        if (snapshotCard) {
            snapshotCard.onclick = () => {
                window.app.navigateTo('goals');
            };
        }

        // 4. Credit Cards -> Navigate to Wallet
        if (creditCard) {
            creditCard.onclick = () => {
                window.app.navigateTo('wallet');
            }
        }
    },

    // --- STEP 1: IDENTITY ---
    openIdentityModal() {
        const container = document.getElementById('onb-action-area');
        container.innerHTML = `
            <div class="bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 rounded-3xl p-8 animate-fade-in-up shadow-xl transition-all">
                <h2 class="text-2xl font-bold text-text-primary_light dark:text-text-primary_dark mb-6 text-center">Como você vai usar o Moneta?</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <!-- OPTION 1: PF -->
                    <button onclick="window.app.selectIdentity('PF')" class="identity-opt p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand-500 hover:bg-brand-500/5 transition group text-left relative overflow-hidden h-full">
                        <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">👤</div>
                        <h3 class="text-xl font-bold text-text-primary_light dark:text-text-primary_dark mb-2">Pessoa Física</h3>
                        <p class="text-sm text-text-secondary_light dark:text-text-secondary_dark">Controle gastos pessoais, salário, lazer e investimentos.</p>
                        <div class="absolute top-4 right-4 w-6 h-6 rounded-full border border-slate-400 group-hover:border-brand-500" id="check-PF"></div>
                    </button>

                     <!-- OPTION 2: HYBRID -->
                    <button onclick="window.app.selectIdentity('Hybrid')" class="identity-opt p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand-500 hover:bg-brand-500/5 transition group text-left relative overflow-hidden h-full">
                        <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">💎</div>
                        <h3 class="text-xl font-bold text-text-primary_light dark:text-text-primary_dark mb-2">Híbrido</h3>
                        <p class="text-sm text-text-secondary_light dark:text-text-secondary_dark">Unifique finanças pessoais e da empresa (MEI/Autônomo).</p>
                        <div class="absolute top-4 right-4 w-6 h-6 rounded-full border border-slate-400 group-hover:border-brand-500" id="check-Hybrid"></div>
                    </button>

                    <!-- OPTION 3: PJ -->
                    <button onclick="window.app.selectIdentity('PJ')" class="identity-opt p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand-500 hover:bg-brand-500/5 transition group text-left relative overflow-hidden h-full">
                        <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🏢</div>
                        <h3 class="text-xl font-bold text-text-primary_light dark:text-text-primary_dark mb-2">Pessoa Jurídica</h3>
                        <p class="text-sm text-text-secondary_light dark:text-text-secondary_dark">Gerencie fluxo de caixa, pró-labore e despesas da empresa.</p>
                        <div class="absolute top-4 right-4 w-6 h-6 rounded-full border border-slate-400 group-hover:border-brand-500" id="check-PJ"></div>
                    </button>
                </div>

                <div class="text-center">
                    <button onclick="window.app.confirmIdentity()" class="bg-brand-500 text-white font-bold py-3 px-10 rounded-xl shadow-lg hover:bg-brand-600 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed" id="btn-confirm-identity" disabled>Confirmar</button>
                </div>
            </div>
        `;
    },

    async handleIdentitySelection(type) {
        this.data.type = type;

        // Visual update
        document.querySelectorAll('.identity-opt').forEach(el => {
            el.classList.remove('ring-2', 'ring-brand-gold', 'bg-brand-gold/10');
            el.querySelector('[id^="check-"]').className = 'absolute top-4 right-4 w-6 h-6 rounded-full border border-gray-500';
            el.querySelector('[id^="check-"]').innerHTML = '';
        });

        const selectedBtn = document.querySelector(`.identity-opt[onclick*="${type}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('ring-2', 'ring-brand-gold', 'bg-brand-gold/10');
            const check = selectedBtn.querySelector('[id^="check-"]');
            check.className = 'absolute top-4 right-4 w-6 h-6 rounded-full bg-brand-gold border-brand-gold flex items-center justify-center';
            check.innerHTML = '<span class="text-brand-darker text-xs font-bold">✓</span>';
        }

        document.getElementById('btn-confirm-identity').disabled = false;
    },

    async submitIdentity() {
        const btn = document.getElementById('btn-confirm-identity');
        btn.innerHTML = '<span class="animate-pulse">Salvando...</span>';
        btn.disabled = true;

        try {
            // Call Edge Function
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding/identity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ type: this.data.type })
            });

            if (!response.ok) throw new Error('Failed to update identity');
            const result = await response.json();

            // Store locally and update UI
            this.data.onboarding_progress = 'snapshot';
            this.updateStatusMap();
            this.renderDashboard();

        } catch (error) {
            console.error(error);
            Toast.show('Erro ao salvar: ' + error.message, 'error');
            btn.innerText = 'Tentar Novamente';
            btn.disabled = false;
        }
    },


    // --- STEP 2: SNAPSHOT (RAIO-X) ---
    openSnapshotModal() {
        const container = document.getElementById('onb-action-area');
        container.innerHTML = `
            <div class="bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 rounded-3xl p-8 animate-fade-in-up shadow-xl transition-all">
                <h2 class="text-2xl font-bold text-text-primary_light dark:text-text-primary_dark mb-2 text-center">Raio-X Financeiro</h2>
                <p class="text-center text-text-secondary_light dark:text-text-secondary_dark mb-8">Preencha com estimativas para calibrarmos suas metas.</p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                     <div class="md:col-span-2">
                        <label class="block text-xs font-bold text-accent-gold uppercase mb-2">Profissão / Vínculo</label>
                        <div class="relative">
                            <select id="inp-profession" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-accent-gold outline-none transition-colors appearance-none cursor-pointer">
                                <option value="CLT">CLT (Carteira Assinada)</option>
                                <option value="Servidor Público">Servidor Público</option>
                                <option value="Autônomo">Autônomo</option>
                                <option value="Dentista">Dentista / Profissional de Saúde</option>
                                <option value="Empresário">Empresário</option>
                                <option value="Freelancer">Freelancer</option>
                                <option value="Outros">Outros</option>
                            </select>
                            <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-text-secondary_light dark:text-text-secondary_dark">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-accent-gold uppercase mb-2">Renda Mensal (Média)</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark"></span>
                            <input type="text" id="inp-income" data-currency="true" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-accent-gold outline-none transition-colors" placeholder="R$ 0,00">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-red-500 dark:text-red-400 uppercase mb-2">Despesa Mensal (Custo de Vida)</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark"></span>
                            <input type="text" id="inp-cost" data-currency="true" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-accent-gold outline-none transition-colors" placeholder="R$ 0,00">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase mb-2">Reserva Atual (Disponível)</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark"></span>
                            <input type="text" id="inp-balance" data-currency="true" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-accent-success outline-none transition-colors" placeholder="R$ 0,00">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-blue-500 dark:text-blue-400 uppercase mb-2">Sua Idade</label>
                        <div class="relative">
                            <input type="number" id="inp-age" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-blue-400 outline-none transition-colors" placeholder="Ex: 30">
                        </div>
                    </div>
                </div>

                 <div class="text-center">
                    <button onclick="window.app.calculateSnapshot()" class="bg-accent-gold text-white font-bold py-3 px-10 rounded-xl shadow-lg hover:scale-105 transition-transform">Calcular Viabilidade</button>
                </div>
            </div>
        `;
        setTimeout(() => CurrencyMask.initAll(), 100);
    },

    async submitSnapshot() {
        const income = CurrencyMask.unmaskToFloat(document.getElementById('inp-income').value);
        const cost = CurrencyMask.unmaskToFloat(document.getElementById('inp-cost').value);
        const balance = CurrencyMask.unmaskToFloat(document.getElementById('inp-balance').value);
        const age = parseInt(document.getElementById('inp-age').value);
        const profession = document.getElementById('inp-profession').value;

        if (!income || !cost || isNaN(balance) || !age) {
            Toast.show('Preencha os valores para continuar.', 'warning');
            return;
        }

        this.data.monthly_income = income;
        this.data.cost_of_living = cost;
        this.data.current_balance = balance;
        this.data.age = age;
        this.data.profession = profession; // Store locally just in case

        // Show Animation / Chart
        this.renderSnapshotResult(income, cost, profession);
    },

    renderSnapshotResult(income, cost, profession) {
        const container = document.getElementById('onb-action-area');

        // --- RISK ANALYSIS LOGIC (Mirror Backend) ---
        const highRisk = ['Autônomo', 'Empresário', 'Dentista', 'Freelancer', 'Profissional Liberal'];
        // Partial match works too if we want, but explicit is safer.
        // Value from select: 'Dentista' maps to 'Dentista'.

        let multiplier = 6;
        if (highRisk.includes(profession) || profession.includes('Dentista')) {
            multiplier = 12;
        }

        const idealEmergency = cost * multiplier;
        const currentCapacity = income - cost;
        const monthsToGoal = currentCapacity > 0 ? (idealEmergency / currentCapacity).toFixed(1) : '∞';

        container.innerHTML = `
            <div class="bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 rounded-3xl p-8 animate-fade-in-up shadow-xl transition-all">
                <h2 class="text-2xl font-bold text-text-primary_light dark:text-text-primary_dark mb-6 text-center">Análise Preliminar</h2>
                
                <div class="flex flex-col md:flex-row items-end justify-center gap-12 h-64 mb-8 px-8">
                    <!-- Bar 1: Custo Vida -->
                    <div class="flex flex-col items-center w-24 group">
                        <span class="mb-2 text-text-primary_light dark:text-text-primary_dark font-bold">R$ ${cost}</span>
                        <div class="w-full bg-red-100 dark:bg-red-900/30 rounded-t-xl relative overflow-hidden h-0 animate-grow-bar" style="height: 40%">
                            <div class="absolute bottom-0 w-full bg-red-400 h-full opacity-80"></div>
                        </div>
                        <span class="mt-2 text-xs text-text-secondary_light dark:text-text-secondary_dark uppercase">Custo Mensal</span>
                    </div>

                    <!-- Bar 2: Capacidade -->
                    <div class="flex flex-col items-center w-24 group">
                        <span class="mb-2 text-text-primary_light dark:text-text-primary_dark font-bold">R$ ${currentCapacity > 0 ? currentCapacity : 0}</span>
                        <div class="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-t-xl relative overflow-hidden h-0 animate-grow-bar" style="height: ${currentCapacity > 0 ? '30%' : '5%'}">
                           <div class="absolute bottom-0 w-full bg-emerald-500 h-full opacity-80"></div>
                        </div>
                        <span class="mt-2 text-xs text-text-secondary_light dark:text-text-secondary_dark uppercase">Sobra Mensal</span>
                    </div>

                    <!-- Bar 3: Meta Reserva -->
                    <div class="flex flex-col items-center w-32 group">
                        <span class="mb-2 text-accent-gold font-bold">R$ ${idealEmergency}</span>
                        <div class="w-full bg-amber-100 dark:bg-amber-900/30 rounded-t-xl relative overflow-hidden h-0 animate-grow-bar border border-accent-gold/50" style="height: 100%">
                            <div class="absolute bottom-0 w-full bg-accent-gold h-full opacity-20"></div>
                            <div class="absolute bottom-0 w-full flex items-center justify-center h-full text-accent-gold text-xs font-bold">META ${multiplier}M</div>
                        </div>
                        <span class="mt-2 text-xs text-text-secondary_light dark:text-text-secondary_dark uppercase">Reserva Ideal</span>
                    </div>
                </div>

                <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 mb-8 text-center border border-slate-200 dark:border-slate-700">
                    <p class="text-text-secondary_light dark:text-text-secondary_dark">
                        Com sua capacidade atual, você levaria cerca de <strong class="text-accent-gold text-lg">${monthsToGoal} meses</strong> para montar sua reserva completa.
                    </p>
                </div>

                <div class="text-center">
                    <button onclick="window.app.confirmSnapshot()" class="bg-brand-500 text-white font-bold py-3 px-10 rounded-xl shadow-lg hover:bg-brand-600 transition-transform" id="btn-save-snapshot">
                        Salvar e Continuar
                    </button>
                </div>
            </div>
        `;

        // Add CSS for animation if needed or rely on Tailwind utility injection if configured, 
        // but simple JS height anim is safer here if tailwind config missing.
        // Using inline styles for height % but we need to trigger the transition.
        setTimeout(() => {
            // Already set styles inline, just basic render.
        }, 100);
    },

    async confirmSnapshotAndfinish() {
        const btn = document.getElementById('btn-save-snapshot');
        btn.innerHTML = '<span class="animate-pulse">Finalizando...</span>';
        btn.disabled = true;

        try {
            // Call Edge Function
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding/snapshot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    monthly_income: this.data.monthly_income,
                    cost_of_living: this.data.cost_of_living,
                    current_balance: this.data.current_balance,
                    age: this.data.age,
                    knowledge_level: 'beginner' // Default for this simplified flow
                })
            });

            if (!response.ok) throw new Error('Failed to save snapshot');

            this.status.snapshot = 'completed';
            this.status.refinement = 'active'; // Unlocks next step

            // Instead of reload, update UI locally to smooth transition
            this.data.onboarding_progress = 'completed';
            this.updateStatusMap();
            this.renderDashboard();

        } catch (error) {
            console.error(error);
            Toast.show('Erro: ' + error.message, 'error');
            btn.innerText = 'Tentar Novamente';
            btn.disabled = false;
        }
    },



    finishOnboarding() {
        window.location.reload();
    },

    // --- MINI WIDGET FOR REAL DASHBOARD ---
    renderMiniWidget() {
        // Only render if we are on the dashboard view
        if (window.app.currentView !== 'dashboard') return;

        const container = document.getElementById('mini-onboarding-container');
        if (!container) return;

        // Check what's pending
        const refinementsPending = this.status.refinement === 'active'; // Means verified but failed, or just active. 'active' means not done.
        // Actually status logic: 'active' if step_accounts_completed is false.

        // Investment logic
        const investmentsPending = this.status.investments !== 'not_applicable' &&
            (this.status.investments === 'active' || this.status.investments === 'safety_mode');
        // We don't really have a 'completed' state for investments yet in status map logic usually unless specifically tracked.
        // Assuming 'active'/'safety_mode' typically means "Available to interact".
        // Let's assume we want to nudge them to check it out.

        if (!refinementsPending && !investmentsPending) {
            container.innerHTML = ''; // Nothing to show
            return;
        }

        // Build messages
        let message = '';
        let buttonAction = '';
        let buttonText = '';
        let icon = '';
        let bgClass = 'bg-background-card_light dark:bg-background-card_dark border-slate-200 dark:border-slate-700';

        if (refinementsPending) {
            message = 'Configure suas contas e metas para desbloquear todo o potencial.';
            buttonAction = 'window.app.openRefinementModal()';
            buttonText = 'Finalizar Configuração';
            icon = '🚀';
            bgClass = 'bg-gradient-to-r from-accent-gold/10 to-transparent border-accent-gold/20'; // Highlight
        } else if (investmentsPending) {
            if (this.status.investments === 'safety_mode') {
                message = 'Sua reserva de emergência precisa de atenção.';
                buttonAction = 'window.app.openSafetyModal()';
                buttonText = 'Ver Recomendação';
                icon = '🛡️';
                bgClass = 'bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500/20';
            } else {
                message = 'Descubra sua alocação ideal de investimentos.';
                buttonAction = 'window.app.openInvestmentsModal()';
                buttonText = 'Ver Estratégia';
                icon = '📈';
                bgClass = 'bg-gradient-to-r from-accent-gold/10 to-transparent border-accent-gold/20';
            }
        }

        container.innerHTML = `
            <div class="${bgClass} border rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group">
                <div class="flex items-center gap-4 relative z-10">
                    <div class="text-2xl">${icon}</div>
                    <div>
                         <h3 class="text-sm font-bold text-text-primary_light dark:text-text-primary_dark">Complete seu Perfil</h3>
                         <p class="text-xs text-text-secondary_light dark:text-text-secondary_dark max-w-[200px] leading-tight">${message}</p>
                    </div>
                </div>
                <button onclick="${buttonAction}" class="relative z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-text-primary_light dark:text-text-primary_dark text-xs font-bold px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm whitespace-nowrap">
                    ${buttonText}
                </button>
                
                <!-- Glow effect -->
                <div class="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition"></div>
            </div>
        `;

        // We might need to handle the modal opening. 
        // Since openRefinementModal renders into #onb-action-area which does not exist in Real Dashboard...
        // WE NEED TO FIX openRefinementModal to render a MODAL (popup) instead of replacing content.
    },

    // --- STEP 3: REFINEMENT ---
    openRefinementModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[9999] hidden'; // Managed by class list, but here we append directly so remove hidden or handle show
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        modal.id = 'refinement-modal';

        modal.innerHTML = `
            <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" onclick="this.parentElement.remove()"></div>
            <div class="relative w-full max-w-4xl bg-brand-surface border border-brand-border rounded-t-2xl md:rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh] h-full md:h-auto fixed bottom-0 md:relative md:bottom-auto">
                
                <!-- Drag Handle -->
                <div class="w-12 h-1.5 bg-brand-surface-light rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>

                <!-- Header -->
                <div class="p-6 pb-4 border-b border-brand-border shrink-0 flex justify-between items-center">
                    <h2 class="text-xl font-bold text-brand-text-primary">Configuração Inicial</h2>
                    <button onclick="this.closest('.fixed').remove()" class="bg-brand-surface-light rounded-full p-2 text-brand-text-secondary hover:text-brand-text-primary transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <p class="text-center text-brand-text-secondary mb-8">Complete os itens abaixo para desbloquear seu painel.</p>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                         <!-- 1. ACCOUNTS -->
                         <button onclick="window.app.openAccountModal()" class="flex flex-col items-center justify-center p-6 bg-brand-bg border border-brand-border rounded-xl hover:border-brand-gold hover:bg-brand-gold/5 transition group h-full">
                            <div class="w-12 h-12 rounded-full bg-brand-surface-light flex items-center justify-center text-2xl mb-3 group-hover:bg-brand-gold group-hover:text-brand-darker transition-colors shadow-sm">🏦</div>
                            <span class="font-bold text-brand-text-primary">Contas Bancárias</span>
                            <span class="text-xs text-brand-text-secondary mt-1">Saldo inicial</span>
                         </button>

                         <!-- 2. CARDS -->
                         <button onclick="window.app.openCardModal()" class="flex flex-col items-center justify-center p-6 bg-brand-bg border border-brand-border rounded-xl hover:border-brand-gold hover:bg-brand-gold/5 transition group h-full">
                            <div class="w-12 h-12 rounded-full bg-brand-surface-light flex items-center justify-center text-2xl mb-3 group-hover:bg-brand-gold group-hover:text-brand-darker transition-colors shadow-sm">💳</div>
                            <span class="font-bold text-brand-text-primary">Cartão de Crédito</span>
                            <span class="text-xs text-brand-text-secondary mt-1">Limites</span>
                         </button>

                         <!-- 3. GOALS -->
                         <button onclick="window.app.openGoalModal()" class="flex flex-col items-center justify-center p-6 bg-brand-bg border border-brand-border rounded-xl hover:border-brand-gold hover:bg-brand-gold/5 transition group h-full">
                            <div class="w-12 h-12 rounded-full bg-brand-surface-light flex items-center justify-center text-2xl mb-3 group-hover:bg-brand-gold group-hover:text-brand-darker transition-colors shadow-sm">🎯</div>
                            <span class="font-bold text-brand-text-primary">Definir Metas</span>
                            <span class="text-xs text-brand-text-secondary mt-1">Sonhos</span>
                         </button>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-6 border-t border-brand-border bg-brand-surface shrink-0 text-center">
                    <button onclick="window.app.checkRefinement()" class="bg-brand-surface-light text-brand-text-primary font-bold py-3 px-10 rounded-xl hover:bg-brand-border transition-transform w-full md:w-auto">
                        Verificar Conclusão
                    </button>
                     <p class="text-[10px] text-brand-text-secondary mt-4 max-w-md mx-auto">Ao concluir, este card desaparecerá e você terá acesso completo ao dashboard.</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },



    // --- OPEN ACCOUNT MODAL (Delegated or Custom) ---
    openAccountModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        modal.id = 'account-onb-modal';

        modal.innerHTML = `
            <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" onclick="this.parentElement.remove()"></div>
            <div class="relative w-full max-w-md bg-brand-surface border border-brand-border rounded-t-2xl md:rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh] h-full md:h-auto fixed bottom-0 md:relative md:bottom-auto">
                
                <!-- Drag Handle -->
                <div class="w-12 h-1.5 bg-brand-surface-light rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>

                <!-- Header -->
                <div class="p-6 pb-4 border-b border-brand-border shrink-0 flex justify-between items-center">
                    <h3 class="text-xl font-bold text-brand-text-primary">Nova Conta</h3>
                    <button onclick="this.closest('.fixed').remove()" class="bg-brand-surface-light rounded-full p-2 text-brand-text-secondary hover:text-brand-text-primary transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
                
                <!-- Body -->
                <form id="onb-account-form" class="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                     <div>
                        <input type="text" name="name" placeholder="Nome da Conta (ex: Nubank)" class="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-brand-text-primary outline-none focus:border-brand-gold transition-colors font-medium placeholder-brand-text-secondary" required>
                     </div>
                     
                     <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-secondary"></span>
                        <input type="text" name="initial_balance" data-currency="true" placeholder="R$ 0,00" class="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-brand-text-primary outline-none focus:border-brand-gold transition-colors font-medium" required>
                     </div>

                     <div class="relative">
                        <select name="type" class="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-brand-text-primary outline-none focus:border-brand-gold transition-colors appearance-none font-medium">
                            <option value="checking">Conta Corrente</option>
                            <option value="savings">Poupança</option>
                            <option value="investment">Investimento</option>
                            <option value="cash">Carteira/Dinheiro</option>
                        </select>
                        <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-brand-text-secondary">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                     </div>
                     <div class="pb-24 md:pb-0"></div>
                </form>

                <!-- Footer -->
                <div class="p-6 border-t border-brand-border bg-brand-surface shrink-0 safe-area-bottom z-10 relative">
                     <button type="submit" form="onb-account-form" class="w-full bg-brand-gold text-brand-darker font-bold py-4 rounded-xl shadow-lg shadow-brand-gold/20 hover:bg-yellow-500 transition-all hover:scale-[1.02]">Salvar Conta</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        CurrencyMask.initAll();

        modal.querySelector('form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                // Use AccountsService to create account and update state automatically
                await AccountsService.create({
                    name: fd.get('name'),
                    type: fd.get('type'),
                    initial_balance: CurrencyMask.unmask(fd.get('initial_balance')), // Convert to cents
                    // color, icon etc. can be defaults if not present
                    color: '#10B981', // Default Green
                    include_in_total: true,
                    is_active: true
                });

                Toast.show('Conta adicionada!', 'success');
                modal.remove();
                this.checkRefinement();

            } catch (err) {
                console.error(err);
                Toast.show('Erro: ' + err.message, 'error');
            }
        };
    },

    openGoalModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        modal.id = 'goal-onb-modal';

        modal.innerHTML = `
            <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" onclick="this.parentElement.remove()"></div>
            <div class="relative w-full max-w-md bg-brand-surface border border-brand-border rounded-t-2xl md:rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh] h-full md:h-auto fixed bottom-0 md:relative md:bottom-auto">
                
                <!-- Drag Handle -->
                <div class="w-12 h-1.5 bg-brand-surface-light rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>

                <!-- Header -->
                <div class="p-6 pb-4 border-b border-brand-border shrink-0 flex justify-between items-center">
                    <h3 class="text-xl font-bold text-brand-text-primary">Nova Meta</h3>
                    <button onclick="this.closest('.fixed').remove()" class="bg-brand-surface-light rounded-full p-2 text-brand-text-secondary hover:text-brand-text-primary transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
                
                <!-- Body -->
                <form id="onb-goal-form" class="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                     <div>
                        <input type="text" name="name" placeholder="Nome da Meta (ex: Viagem)" class="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-brand-text-primary outline-none focus:border-brand-gold transition-colors font-medium placeholder-brand-text-secondary" required>
                     </div>
                     
                     <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-secondary"></span>
                        <input type="text" name="target_amount" data-currency="true" placeholder="R$ 0,00" class="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-brand-text-primary outline-none focus:border-brand-gold transition-colors font-medium" required>
                     </div>
                     
                     <div>
                        <label class="text-xs text-brand-text-secondary uppercase font-bold block mb-1">Data Limite</label>
                        <input type="date" name="deadline" class="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-brand-text-primary outline-none focus:border-brand-gold transition-colors font-medium" required>
                     </div>
                     <div class="pb-24 md:pb-0"></div>
                </form>

                <!-- Footer -->
                <div class="p-6 border-t border-brand-border bg-brand-surface shrink-0 safe-area-bottom z-10 relative">
                     <button type="submit" form="onb-goal-form" class="w-full bg-brand-gold text-brand-darker font-bold py-4 rounded-xl shadow-lg shadow-brand-gold/20 hover:bg-yellow-500 transition-all hover:scale-[1.02]">Criar Meta</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        CurrencyMask.initAll();

        modal.querySelector('form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                const { data: { user } } = await supabase.auth.getUser();

                const amount = CurrencyMask.unmask(fd.get('target_amount')); // Goals stores integer cents usually? verify.
                // Original was: Math.round(parseFloat(fd.get('target_amount')) * 100);
                // CurrencyMask.unmask returns cents integer. Perfect.

                const { error } = await supabase.from('goals').insert({
                    user_id: user.id,
                    name: fd.get('name'),
                    target_amount: amount,
                    current_amount: 0,
                    deadline: new Date(fd.get('deadline')).toISOString(),
                    status: 'active',
                    type: 'purchase' // Default
                });
                if (error) throw error;

                Toast.show('Meta criada!', 'success');
                modal.remove();
                this.checkRefinement();

            } catch (err) {
                Toast.show('Erro: ' + err.message, 'error');
            }
        };
    },

    async checkRefinement() {
        // Count accounts and goals
        const { data: { user } } = await supabase.auth.getUser();

        // Parallel checks
        const [{ count: accCount }, { count: goalCount }] = await Promise.all([
            supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
        ]);

        console.log('Checks:', { accCount, goalCount });

        if ((accCount || 0) >= 1 && (goalCount || 0) >= 1) {
            // Mark as complete!
            await supabase.from('profiles').update({ step_accounts_completed: true }).eq('id', user.id);
            this.data.step_accounts_completed = true;
            this.status.refinement = 'completed';

            Toast.show('Parabéns! Configuração inicial concluída.', 'success');
            this.renderDashboard(); // Re-render to show green check
        } else {
            const missing = [];
            if ((accCount || 0) < 1) missing.push('1 Conta Bancária');
            if ((goalCount || 0) < 1) missing.push('1 Meta');
            Toast.show(`Faltam itens: ${missing.join(', ')}`, 'warning');
        }
    },
    // --- STEP 4: INVESTMENTS (Logic) ---
    openSafetyModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';

        modal.innerHTML = `
            <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" onclick="this.parentElement.remove()"></div>
            <div class="relative w-full max-w-lg bg-brand-surface border border-brand-border rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col p-8 md:p-8 space-y-4">
                <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4 text-brand-text-secondary hover:text-brand-text-primary">✕</button>
                
                <div class="text-center space-y-4">
                    <div class="text-5xl mb-4">🛡️</div>
                    <h2 class="text-2xl font-bold text-brand-text-primary">Segurança Primeiro!</h2>
                    <p class="text-brand-text-secondary leading-relaxed">
                        Identificamos que sua reserva ainda está abaixo da meta recomendada de 6 meses de custo de vida.
                    </p>
                    <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 my-6 text-left">
                        <p class="text-blue-400 font-bold mb-1">Recomendação Moneta</p>
                        <p class="text-brand-text-secondary text-sm">
                            Foque 100% dos seus aportes em <strong>Renda Fixa com Liquidez Diária</strong> (Tesouro Selic ou CDB 100% CDI) até atingir sua meta.
                        </p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="bg-brand-surface-light text-brand-text-primary font-bold py-3 px-8 rounded-xl hover:bg-brand-border transition w-full">Entendi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    openInvestmentsModal() {
        // Disclaimer Modal First
        const disclaimer = document.createElement('div');
        disclaimer.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        disclaimer.innerHTML = `
            <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" onclick="this.parentElement.remove()"></div>
            <div class="relative w-full max-w-lg bg-brand-surface border border-brand-border rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col p-8 border-l-4 border-l-brand-gold">
                <h2 class="text-xl font-bold text-brand-gold mb-4 uppercase tracking-widest">Aviso Legal</h2>
                <div class="prose prose-invert text-sm text-brand-text-secondary mb-8 leading-relaxed">
                    <p>As sugestões a seguir são geradas por algoritmos baseados em regras gerais de mercado (ex: Regra dos 100) e <strong>NÃO constituem recomendação de investimento personalizada</strong>.</p>
                    <p>O Moneta não se responsabiliza por perdas financeiras. Consulte um consultor certificado CVM para recomendações específicas.</p>
                </div>
                <div class="flex gap-4">
                    <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-transparent border border-brand-border text-brand-text-secondary py-3 rounded-xl hover:bg-brand-surface-light font-medium transition">Cancelar</button>
                    <button onclick="this.closest('.fixed').remove(); window.app.showAllocation();" class="flex-1 bg-brand-gold text-brand-darker font-bold py-3 rounded-xl hover:opacity-90 shadow-lg shadow-brand-gold/10">Aceitar e Continuar</button>
                </div>
            </div>
        `;
        document.body.appendChild(disclaimer);
    },

    showAllocationTool() {
        const age = this.data.age || 30;
        let variablePct = 100 - age;

        // Safety Clamps
        if (variablePct > 80) variablePct = 80;
        if (variablePct < 10) variablePct = 10;

        const fixedPct = 100 - variablePct;

        const container = document.getElementById('onb-action-area');
        container.innerHTML = `
            <div class="bg-brand-surface border border-brand-border rounded-3xl p-8 animate-fade-in-up">
                <h2 class="text-2xl font-bold text-brand-text-primary mb-2 text-center">Sugestão de Alocação</h2>
                <p class="text-center text-brand-text-secondary mb-8">Baseado na sua idade (${age} anos) e perfil de acumulação.</p>

                <div class="flex items-center justify-center gap-2 mb-8 h-12">
                    <div style="width: ${fixedPct}%" class="h-full bg-blue-500 rounded-l-xl flex items-center justify-center text-white font-bold text-sm shadow-lg relative group cursor-help">
                        ${fixedPct}%
                        <div class="absolute bottom-full mb-2 bg-gray-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">Renda Fixa</div>
                    </div>
                    <div style="width: ${variablePct}%" class="h-full bg-brand-gold rounded-r-xl flex items-center justify-center text-brand-darker font-bold text-sm shadow-lg relative group cursor-help">
                        ${variablePct}%
                        <div class="absolute bottom-full mb-2 bg-gray-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">Renda Variável</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-6 mb-8 text-sm">
                    <div class="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <strong class="text-blue-400 block mb-2">Renda Fixa (${fixedPct}%)</strong>
                        <ul class="list-disc list-inside text-gray-400 space-y-1">
                            <li>Tesouro IPCA+</li>
                            <li>CDBs Pós-fixados</li>
                            <li>LCI/LCA</li>
                        </ul>
                    </div>
                    <div class="p-4 bg-brand-gold/10 rounded-xl border border-brand-gold/20">
                        <strong class="text-brand-gold block mb-2">Renda Variável (${variablePct}%)</strong>
                        <ul class="list-disc list-inside text-gray-400 space-y-1">
                            <li>Ações de Valor</li>
                            <li>Fundos Imobiliários</li>
                            <li>ETFs Neutros (IVVB11)</li>
                        </ul>
                    </div>
                </div>

                <div class="text-center">
                    <button onclick="window.app.finishOnboarding()" class="bg-brand-green text-brand-darker font-bold py-3 px-10 rounded-xl shadow-glow-green hover:scale-105 transition-transform">
                        Concluir Setup
                    </button>
                </div>
            </div>
        `;
        document.getElementById('onboarding-dashboard').scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    },
};

// Global Exposure
window.app = window.app || {};
window.app.selectIdentity = (t) => OnboardingModule.handleIdentitySelection(t);
window.app.confirmIdentity = () => OnboardingModule.submitIdentity();
window.app.calculateSnapshot = () => OnboardingModule.submitSnapshot();
window.app.confirmSnapshot = () => OnboardingModule.confirmSnapshotAndfinish();
window.app.updateStatusMap = () => OnboardingModule.updateStatusMap();
window.app.showAllocation = () => OnboardingModule.showAllocationTool();
window.app.openRefinementModal = () => OnboardingModule.openRefinementModal();
window.app.openAccountModal = () => OnboardingModule.openAccountModal();
window.app.openCardModal = () => OnboardingModule.openCardModal();
window.app.openGoalModal = () => OnboardingModule.openGoalModal();
window.app.checkRefinement = () => OnboardingModule.checkRefinement();

// Export for usage if needed elsewhere
window.OnboardingModule = OnboardingModule;



