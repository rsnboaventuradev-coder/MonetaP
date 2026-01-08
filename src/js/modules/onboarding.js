import { supabase } from '../services/supabase.service.js';
import { GoalsService } from '../services/goals.service.js';
import { SettingsService } from '../services/settings.service.js';
import { Toast } from '../utils/toast.js';

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
            this.renderDashboard();
        } else {
            console.log('Onboarding: Completed previously.');
        }
    },

    updateStatusMap() {
        const p = this.data.onboarding_progress;

        // Reset defaults
        this.status = { identity: 'locked', snapshot: 'locked', refinement: 'locked', investments: 'locked' };

        if (p === 'identity') {
            this.status.identity = 'active';
            this.status.snapshot = 'locked';
            this.status.refinement = 'locked';
        } else if (p === 'snapshot') {
            this.status.identity = 'completed';
            this.status.snapshot = 'active';
            this.status.refinement = 'locked';
        } else if (p === 'completed') {
            this.status.identity = 'completed';
            this.status.snapshot = 'completed';

            // Refinement is active until completed
            if (this.data.step_accounts_completed) {
                this.status.refinement = 'completed';
            } else {
                this.status.refinement = 'active';
            }

            // Check Investments Logic
            const target = (this.data.cost_of_living || 0) * 6;
            const balance = this.data.current_balance || 0;

            if (balance >= target && target > 0) {
                this.status.investments = 'active'; // Gold
            } else {
                this.status.investments = 'safety_mode'; // Blue/Info
            }
        }
    },

    renderDashboard() {
        // Create or get overlay
        let overlay = document.getElementById('onboarding-dashboard');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'onboarding-dashboard';
            overlay.className = 'fixed inset-0 z-[100] bg-background-light dark:bg-background-dark flex flex-col pt-10 px-4 animate-fade-in overflow-y-auto';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="max-w-7xl mx-auto w-full mb-10">
                <header class="text-center mb-12">
                     <div class="w-16 h-16 bg-accent-gold/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-custom border border-accent-gold/20">🚀</div>
                    <h1 class="text-4xl font-bold text-text-primary_light dark:text-text-primary_dark mb-4">Bem-vindo ao Moneta</h1>
                    <p class="text-text-secondary_light dark:text-text-secondary_dark text-lg max-w-2xl mx-auto">
                        Vamos configurar seu ambiente financeiro. Complete as missões abaixo para liberar seu dashboard.
                    </p>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                    <!-- Connector Lines (Visual Only, hidden on mobile) -->
                    <div class="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700 -z-10 -translate-y-1/2 transform"></div>

                    <!-- CARD 1: PERFIL -->
                    ${this._renderCard('identity', 'Perfil', 'Defina se você usará o app para fins Pessoais ou Empresariais.', '👤')}

                    <!-- CARD 2: RAIO-X -->
                    ${this._renderCard('snapshot', 'Raio-X', 'Estimativa de finanças atuais para traçarmos metas.', '📊')}

                    <!-- CARD 3: REFINAMENTO -->
                    ${this._renderCard('refinement', 'Refinamento', 'Ajustes finais para começar.', '✨')}

                    <!-- CARD 4: INVESTIMENTOS -->
                    ${this._renderCard('investments', 'Investimentos', 'Montagem de carteira baseada no seu momento.', '📈')}
                </div>
            </div>

            <!-- ACTION AREA / MODAL CONTAINER -->
            <div id="onb-action-area" class="max-w-4xl mx-auto w-full pb-20"></div>
        `;

        this.addCardListeners();
    },



    _renderCard(stepKey, title, desc, icon) {
        const state = this.status[stepKey]; // locked, active, completed, safety_mode
        const isLocked = state === 'locked';
        const isCompleted = state === 'completed';
        const isActive = state === 'active';
        const isSafety = state === 'safety_mode';

        let statusClasses = '';
        let iconBg = '';

        if (isLocked) {
            statusClasses = 'opacity-50 grayscale cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
            iconBg = 'bg-slate-200 dark:bg-slate-700 text-slate-400';
        } else if (isActive) {
            statusClasses = 'border-accent-gold shadow-lg shadow-accent-gold/10 hover:scale-105 cursor-pointer ring-1 ring-accent-gold/50 bg-background-card_light dark:bg-background-card_dark';
            iconBg = 'bg-accent-gold text-white';
        } else if (isCompleted) {
            statusClasses = 'border-accent-success bg-emerald-50 dark:bg-emerald-900/10 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20';
            iconBg = 'bg-accent-success text-white';
        } else if (isSafety) {
            statusClasses = 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 hover:scale-105 shadow-lg shadow-blue-500/20';
            iconBg = 'bg-blue-500 text-white';
        }

        return `
            <div id="card-${stepKey}" class="border rounded-2xl p-6 transition-all duration-300 relative overflow-hidden group h-full ${statusClasses}">
                <div class="flex flex-col items-center text-center space-y-4 relative z-10 h-full">
                    <div class="w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center text-2xl shadow-md mb-2 transition-colors">
                        ${isCompleted ? '✓' : icon}
                    </div>
                    <h3 class="text-lg font-bold text-text-primary_light dark:text-text-primary_dark">${title}</h3>
                    <p class="text-xs text-text-secondary_light dark:text-text-secondary_dark leading-relaxed">${desc}</p>
                    
                    <div class="mt-auto pt-4">
                        ${isActive ? `<span class="inline-block px-3 py-1 bg-accent-gold/10 text-accent-gold text-[10px] font-bold rounded-full uppercase tracking-wider animate-pulse">Disponível</span>` : ''}
                        ${isLocked ? `<span class="inline-block px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Bloqueado</span>` : ''}
                        ${isCompleted ? `<span class="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Concluído</span>` : ''}
                        ${isSafety ? `<span class="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Educativo</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    addCardListeners() {
        const identityCard = document.getElementById('card-identity');
        const snapshotCard = document.getElementById('card-snapshot');
        const refinementCard = document.getElementById('card-refinement');
        const invCard = document.getElementById('card-investments');

        if (identityCard && this.status.identity === 'active') {
            identityCard.onclick = () => this.openIdentityModal();
        }
        if (snapshotCard && this.status.snapshot === 'active') {
            snapshotCard.onclick = () => this.openSnapshotModal();
        }
        if (refinementCard && (this.status.refinement === 'active' || this.status.snapshot === 'completed')) {
            if (this.status.refinement === 'completed') {
                // Already done? maybe allowed to edit or just do nothing
            } else {
                refinementCard.onclick = () => this.openRefinementModal();
            }
        }
        if (invCard) {
            if (this.status.investments === 'active') {
                invCard.onclick = () => this.openInvestmentsModal();
            } else if (this.status.investments === 'safety_mode') {
                invCard.onclick = () => this.openSafetyModal();
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
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark">R$</span>
                            <input type="number" id="inp-income" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-accent-gold outline-none transition-colors" placeholder="0,00">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-red-500 dark:text-red-400 uppercase mb-2">Despesa Mensal (Custo de Vida)</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark">R$</span>
                            <input type="number" id="inp-cost" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-accent-gold outline-none transition-colors" placeholder="0,00">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase mb-2">Reserva Atual (Disponível)</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark">R$</span>
                            <input type="number" id="inp-balance" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-4 text-text-primary_light dark:text-text-primary_dark text-xl focus:border-accent-success outline-none transition-colors" placeholder="0,00">
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
    },

    async submitSnapshot() {
        const income = parseFloat(document.getElementById('inp-income').value);
        const cost = parseFloat(document.getElementById('inp-cost').value);
        const balance = parseFloat(document.getElementById('inp-balance').value);
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
        // Updated to be a proper Overlay Modal, not replacing page content
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-4xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onclick="this.closest('.fixed').remove()" class="absolute top-6 right-6 text-text-secondary_light dark:text-text-secondary_dark hover:text-text-primary_light dark:hover:text-text-primary_dark bg-slate-100 dark:bg-slate-800 rounded-full p-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                
                <h2 class="text-2xl font-bold text-text-primary_light dark:text-text-primary_dark mb-2 text-center">Configuração Inicial</h2>
                <p class="text-center text-text-secondary_light dark:text-text-secondary_dark mb-8">Complete os itens abaixo para desbloquear seu painel.</p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                     <!-- 1. ACCOUNTS -->
                     <button onclick="window.app.openAccountModal()" class="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-500 hover:bg-brand-500/5 transition group">
                        <div class="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-2xl mb-3 group-hover:bg-brand-500 group-hover:text-white transition-colors">🏦</div>
                        <span class="font-bold text-text-primary_light dark:text-text-primary_dark">Contas Bancárias</span>
                        <span class="text-xs text-text-secondary_light dark:text-text-secondary_dark mt-1">Saldo inicial</span>
                     </button>

                     <!-- 2. CARDS -->
                     <button onclick="window.app.openCardModal()" class="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-500 hover:bg-brand-500/5 transition group">
                        <div class="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-2xl mb-3 group-hover:bg-brand-500 group-hover:text-white transition-colors">💳</div>
                        <span class="font-bold text-text-primary_light dark:text-text-primary_dark">Cartão de Crédito</span>
                        <span class="text-xs text-text-secondary_light dark:text-text-secondary_dark mt-1">Limites</span>
                     </button>

                     <!-- 3. GOALS -->
                     <button onclick="window.app.openGoalModal()" class="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-500 hover:bg-brand-500/5 transition group">
                        <div class="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-2xl mb-3 group-hover:bg-brand-500 group-hover:text-white transition-colors">🎯</div>
                        <span class="font-bold text-text-primary_light dark:text-text-primary_dark">Definir Metas</span>
                        <span class="text-xs text-text-secondary_light dark:text-text-secondary_dark mt-1">Sonhos</span>
                     </button>
                </div>

                <div class="text-center">
                    <button onclick="window.app.checkRefinement()" class="bg-slate-200 dark:bg-slate-700 text-text-primary_light dark:text-text-primary_dark font-bold py-3 px-10 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-transform">
                        Verificar Conclusão
                    </button>
                     <p class="text-[10px] text-text-secondary_light dark:text-text-secondary_dark mt-4 max-w-md mx-auto">Ao concluir, este card desaparecerá e você terá acesso completo ao dashboard.</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    openAccountModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
                <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4 text-text-secondary_light dark:text-text-secondary_dark hover:text-text-primary_light dark:hover:text-text-primary_dark bg-slate-100 dark:bg-slate-800 rounded-full p-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h3 class="text-xl font-bold text-text-primary_light dark:text-text-primary_dark mb-6">Nova Conta</h3>
                
                <form id="onb-acc-form" class="space-y-4">
                     <input type="text" name="name" placeholder="Nome (ex: Nubank)" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                     
                     <div class="relative">
                         <select name="type" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors appearance-none cursor-pointer">
                            <option value="checking">Corrente</option>
                            <option value="investment">Investimento</option>
                            <option value="wallet">Carteira Física</option>
                         </select>
                         <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-text-secondary_light dark:text-text-secondary_dark">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                     </div>

                     <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark">R$</span>
                        <input type="number" step="0.01" name="balance" placeholder="Saldo Inicial" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                     </div>
                     
                     <button type="submit" class="w-full bg-accent-gold text-white font-bold py-3 rounded-xl hover:bg-amber-500 shadow-md transition-all hover:scale-[1.02] mt-2">Salvar</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                const acc = await SettingsService.createAccount({
                    name: fd.get('name'),
                    type: fd.get('type')
                });

                const balance = parseFloat(fd.get('balance'));
                if (balance > 0) {
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase.from('transactions').insert({
                        user_id: user.id,
                        description: 'Saldo Inicial',
                        amount: Math.round(balance * 100),
                        date: new Date().toISOString(),
                        type: 'income', // Treated as income for initial balance usually
                        account_id: acc.id,
                        is_paid: true
                    });
                }

                Toast.show('Conta criada!', 'success');
                modal.remove();
                this.checkRefinement(); // Check if ready

            } catch (err) {
                Toast.show('Erro: ' + err.message, 'error');
            }
        };
    },

    openCardModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
                <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4 text-text-secondary_light dark:text-text-secondary_dark hover:text-text-primary_light dark:hover:text-text-primary_dark bg-slate-100 dark:bg-slate-800 rounded-full p-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h3 class="text-xl font-bold text-text-primary_light dark:text-text-primary_dark mb-6">Novo Cartão</h3>
                
                <form id="onb-card-form" class="space-y-4">
                     <input type="text" name="name" placeholder="Nome (ex: XP Visa Infinite)" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                     <div class="flex gap-4">
                        <input type="number" name="closing_day" placeholder="Dia Fech." class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                        <input type="number" name="due_day" placeholder="Dia Venc." class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                     </div>
                     <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark">R$</span>
                        <input type="number" step="0.01" name="limit" placeholder="Limite (Opcional)" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors">
                     </div>
                     
                     <button type="submit" class="w-full bg-accent-gold text-white font-bold py-3 rounded-xl hover:bg-amber-500 shadow-md transition-all hover:scale-[1.02] mt-2">Salvar</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                await SettingsService.createCard({
                    name: fd.get('name'),
                    closing_day: parseInt(fd.get('closing_day')),
                    due_day: parseInt(fd.get('due_day')),
                    limit: parseFloat(fd.get('limit')) ? Math.round(parseFloat(fd.get('limit')) * 100) : null
                });

                Toast.show('Cartão criado!', 'success');
                modal.remove();
            } catch (err) {
                Toast.show('Erro: ' + err.message, 'error');
            }
        };
    },

    openGoalModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-background-card_light dark:bg-background-card_dark border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
                <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4 text-text-secondary_light dark:text-text-secondary_dark hover:text-text-primary_light dark:hover:text-text-primary_dark bg-slate-100 dark:bg-slate-800 rounded-full p-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h3 class="text-xl font-bold text-text-primary_light dark:text-text-primary_dark mb-6">Nova Meta</h3>
                
                <form id="onb-goal-form" class="space-y-4">
                     <input type="text" name="name" placeholder="Nome da Meta (ex: Viagem)" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                     
                     <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary_light dark:text-text-secondary_dark">R$</span>
                        <input type="number" step="0.01" name="target_amount" placeholder="Valor Alvo" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                     </div>
                     
                     <div>
                        <label class="text-xs text-text-secondary_light dark:text-text-secondary_dark uppercase font-bold block mb-1">Data Limite</label>
                        <input type="date" name="deadline" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-text-primary_light dark:text-text-primary_dark outline-none focus:border-accent-gold transition-colors" required>
                     </div>
                     
                     <button type="submit" class="w-full bg-accent-gold text-white font-bold py-3 rounded-xl hover:bg-amber-500 shadow-md transition-all hover:scale-[1.02] mt-2">Criar Meta</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('form').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                const { data: { user } } = await supabase.auth.getUser();

                const amount = Math.round(parseFloat(fd.get('target_amount')) * 100);

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
        modal.className = 'fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in';
        modal.innerHTML = `
            <div class="bg-brand-surface border border-brand-border rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
                <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                
                <div class="text-center space-y-4">
                    <div class="text-5xl mb-4">🛡️</div>
                    <h2 class="text-2xl font-bold text-white">Segurança Primeiro!</h2>
                    <p class="text-brand-text-secondary">
                        Identificamos que sua reserva ainda está abaixo da meta recomendada de 6 meses de custo de vida.
                    </p>
                    <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 my-6">
                        <p class="text-blue-300 font-medium">Recomendação Moneta</p>
                        <p class="text-gray-300 text-sm mt-2">
                            Foque 100% dos seus aportes em <strong>Renda Fixa com Liquidez Diária</strong> (Tesouro Selic ou CDB 100% CDI) até atingir sua meta.
                        </p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="bg-gray-700 text-white font-bold py-3 px-8 rounded-xl hover:bg-gray-600 transition">Entendi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    openInvestmentsModal() {
        // Disclaimer Modal First
        const disclaimer = document.createElement('div');
        disclaimer.className = 'fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-fade-in';
        disclaimer.innerHTML = `
            <div class="bg-brand-surface border border-brand-border rounded-3xl w-full max-w-lg p-8 shadow-2xl relative border-l-4 border-l-brand-gold">
                <h2 class="text-xl font-bold text-brand-gold mb-4 uppercase tracking-widest">Aviso Legal</h2>
                <div class="prose prose-invert text-sm text-brand-text-secondary mb-6">
                    <p>As sugestões a seguir são geradas por algoritmos baseados em regras gerais de mercado (ex: Regra dos 100) e <strong>NÃO constituem recomendação de investimento personalizada</strong>.</p>
                    <p>O Moneta não se responsabiliza por perdas financeiras. Consulte um consultor certificado CVM para recomendações específicas.</p>
                </div>
                <div class="flex gap-4">
                    <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-transparent border border-brand-border text-white py-3 rounded-xl hover:bg-white/5">Cancelar</button>
                    <button onclick="this.closest('.fixed').remove(); window.app.showAllocation();" class="flex-1 bg-brand-gold text-brand-darker font-bold py-3 rounded-xl hover:opacity-90">Aceitar e Continuar</button>
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



