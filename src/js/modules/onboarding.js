import { supabase } from '../services/supabase.service.js';
import { GoalsService } from '../services/goals.service.js';

export const OnboardingModule = {
    currentStep: 0,
    data: {
        monthly_income: 0,
        cost_of_living: 0,
        emergency_months: 6,
        knowledge_level: 'beginner',
        has_emergency_fund: false
    },

    async init() {
        // Check if onboarding is needed
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', user.id)
            .maybeSingle();

        if (profile && !profile.onboarding_completed) {
            this.renderWizard();
        }
    },

    renderWizard() {
        const overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.className = 'fixed inset-0 z-[100] bg-brand-bg flex items-center justify-center p-4 animate-fade-in';
        overlay.innerHTML = `
            <div class="bg-brand-surface border border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden relative">
                <!-- Progress Bar -->
                <div class="h-1 bg-white/5 w-full">
                    <div id="onb-progress" class="h-full bg-brand-gold transition-all duration-500" style="width: 0%"></div>
                </div>

                <div id="onb-content" class="p-8 min-h-[400px] flex flex-col">
                    <!-- Dynamic Content -->
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.renderStep(0);
    },

    steps: [
        {
            id: 'intro',
            render: () => `
                <div class="flex-1 flex flex-col justify-center items-center text-center space-y-6">
                    <div class="w-20 h-20 bg-brand-gold/10 rounded-full flex items-center justify-center text-4xl mb-4">🚀</div>
                    <h2 class="text-3xl font-bold text-white">Bem-vindo ao Moneta</h2>
                    <p class="text-gray-400 text-lg">Vamos calibrar sua experiência. Em poucos passos, vamos definir seu plano financeiro.</p>
                    <button onclick="window.app.nextStep()" class="bg-brand-gold text-brand-darker font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transition-transform">Começar</button>
                    <button onclick="window.app.skipOnboarding()" class="text-xs text-gray-500 font-bold hover:text-white uppercase tracking-widest mt-4">Pular (Configurar depois)</button>
                </div>
            `
        },
        {
            id: 'basics',
            render: () => `
                <div class="space-y-6">
                    <h3 class="text-2xl font-bold text-white mb-2">O Básico 🏡</h3>
                    <p class="text-gray-400">Para traçar a rota, precisamos saber onde você está.</p>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-brand-gold uppercase mb-2">Renda Mensal (Aprox.)</label>
                            <input type="number" id="onb-income" class="w-full bg-brand-bg border border-white/10 rounded-xl p-4 text-white text-lg focus:border-brand-gold outline-none" placeholder="Ex: 5000">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-brand-gold uppercase mb-2">Custo de Vida Mensal</label>
                            <input type="number" id="onb-cost" class="w-full bg-brand-bg border border-white/10 rounded-xl p-4 text-white text-lg focus:border-brand-gold outline-none" placeholder="Ex: 3000">
                            <p class="text-[10px] text-gray-500 mt-2">Quanto você gasta para manter seu padrão de vida hoje.</p>
                        </div>
                    </div>
                </div>
            `,
            validate: () => {
                const income = document.getElementById('onb-income').value;
                const cost = document.getElementById('onb-cost').value;
                if (!income || !cost) { alert('Preencha os valores para continuar.'); return false; }
                window.app.onbData.monthly_income = parseFloat(income);
                window.app.onbData.cost_of_living = parseFloat(cost);
                return true;
            }
        },
        {
            id: 'safety',
            render: () => `
                <div class="space-y-6">
                    <h3 class="text-2xl font-bold text-white mb-2">Segurança 🛡️</h3>
                    <p class="text-gray-400">Sua Reserva de Emergência é seu colchão. Quantos meses de custo de vida te deixariam tranquilo?</p>
                    
                    <div class="grid grid-cols-3 gap-3">
                        <button onclick="window.app.setMonths(3, this)" class="month-opt bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition text-center group">
                            <span class="block text-2xl font-bold text-white mb-1">3</span>
                            <span class="text-xs text-gray-400 group-hover:text-white uppercase">Meses</span>
                        </button>
                        <button onclick="window.app.setMonths(6, this)" class="month-opt bg-brand-gold/20 border border-brand-gold p-4 rounded-xl hover:bg-brand-gold/30 transition text-center group ring-2 ring-brand-gold ring-offset-2 ring-offset-[#111]">
                            <span class="block text-2xl font-bold text-brand-gold mb-1">6</span>
                            <span class="text-xs text-brand-gold/80 group-hover:text-white uppercase">Meses</span>
                        </button>
                        <button onclick="window.app.setMonths(12, this)" class="month-opt bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition text-center group">
                            <span class="block text-2xl font-bold text-white mb-1">12</span>
                            <span class="text-xs text-gray-400 group-hover:text-white uppercase">Meses</span>
                        </button>
                    </div>

                    <div class="pt-4">
                         <label class="flex items-center gap-3 p-4 bg-white/5 rounded-xl cursor-pointer">
                            <input type="checkbox" id="onb-has-fund" class="w-5 h-5 rounded border-gray-600 text-brand-gold focus:ring-brand-gold bg-gray-700">
                            <span class="text-sm text-gray-200">Já possuo esse valor investido em liquidez.</span>
                        </label>
                    </div>
                </div>
            `,
            validate: () => {
                const hasFund = document.getElementById('onb-has-fund').checked;
                window.app.onbData.has_emergency_fund = hasFund;
                return true;
            }
        },
        {
            id: 'expert',
            render: () => `
                <div class="space-y-6">
                    <h3 class="text-2xl font-bold text-white mb-2">Experiência 🧠</h3>
                    <p class="text-gray-400">Qual seu nível de conhecimento em investimentos (Ações, FIIs, Cripto)?</p>
                    
                    <div class="space-y-3">
                         <button onclick="window.app.setLevel('beginner', this)" class="lvl-opt w-full bg-brand-gold/20 border border-brand-gold p-4 rounded-xl flex items-center gap-4 text-left transition ring-2 ring-brand-gold ring-offset-2 ring-offset-[#111]">
                            <div class="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-brand-darker font-bold">🌱</div>
                            <div>
                                <strong class="block text-white">Iniciante</strong>
                                <span class="text-xs text-brand-gold/80">Estou aprendendo, foco em Renda Fixa.</span>
                            </div>
                        </button>
                         <button onclick="window.app.setLevel('intermediate', this)" class="lvl-opt w-full bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4 text-left hover:bg-white/10 transition">
                            <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">🌿</div>
                            <div>
                                <strong class="block text-white">Intermediário</strong>
                                <span class="text-xs text-gray-400">Já invisto em FIIs ou Ações, mas quero evoluir.</span>
                            </div>
                        </button>
                         <button onclick="window.app.setLevel('advanced', this)" class="lvl-opt w-full bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4 text-left hover:bg-white/10 transition">
                            <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">🌳</div>
                            <div>
                                <strong class="block text-white">Avançado</strong>
                                <span class="text-xs text-gray-400">Domino análise fundamentalista e alocação.</span>
                            </div>
                        </button>
                    </div>
                </div>
            `,
            validate: () => true
        }
    ],

    renderStep(stepIndex) {
        const container = document.getElementById('onb-content');
        if (!container) return;

        const step = this.steps[stepIndex];
        // Only render content, logic buttons handled globally or inside step html
        let html = step.render();

        // Add navigation if not intro
        if (step.id !== 'intro') {
            html += `
                <div class="mt-auto pt-8 flex justify-between items-center">
                    <button onclick="window.app.prevStep()" class="text-gray-500 hover:text-white font-bold text-sm px-4">Voltar</button>
                    <button onclick="window.app.nextStep()" class="bg-white text-brand-darker font-bold py-3 px-8 rounded-full shadow hover:bg-gray-200 transition">
                        ${stepIndex === this.steps.length - 1 ? 'Finalizar' : 'Próximo'}
                    </button>
               </div>
            `;
        }

        container.innerHTML = html;
        this.currentStep = stepIndex;

        // Update progress
        const pct = ((stepIndex) / (this.steps.length - 1)) * 100;
        document.getElementById('onb-progress').style.width = `${pct}%`;
    },

    async finish() {
        // Save Everything
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const updates = {
                monthly_income: window.app.onbData.monthly_income,
                // cost_of_living not stored in profile usually, but good for calibration. We will skip storing it directly in profile for now unless we add a column, or just assume it updates the dashboard avg calc if we persist it.
                // Actually, let's create a "Emergency Fund" Goal automatically based on this.
                knowledge_level: window.app.onbData.knowledge_level,
                emergency_fund_target_months: window.app.onbData.emergency_months,
                has_emergency_fund: window.app.onbData.has_emergency_fund,
                evolution_stage: window.app.onbData.has_emergency_fund ? 'accumulation' : 'security',
                onboarding_completed: true,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
            if (error) throw error;

            // Auto-create Goal
            if (!window.app.onbData.has_emergency_fund) {
                const targetAmount = window.app.onbData.cost_of_living * window.app.onbData.emergency_months;
                await supabase.from('goals').insert({
                    user_id: user.id,
                    name: 'Reserva de Emergência',
                    target_amount: targetAmount,
                    current_amount: 0,
                    type: 'safety',
                    deadline: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(), // 1 year default
                    status: 'active'
                });
            }

            document.getElementById('onboarding-overlay').remove();
            window.location.reload(); // Refresh to apply changes

        } catch (e) {
            console.error(e);
            alert('Erro ao salvar: ' + e.message);
        }
    }
};

// Global Helpers for the HTML interactions
window.app = window.app || {};
window.app.onbData = {};

window.app.nextStep = async () => {
    const step = OnboardingModule.steps[OnboardingModule.currentStep];
    if (step.validate && !step.validate()) return;

    if (OnboardingModule.currentStep < OnboardingModule.steps.length - 1) {
        OnboardingModule.renderStep(OnboardingModule.currentStep + 1);
    } else {
        await OnboardingModule.finish();
    }
};

window.app.prevStep = () => {
    if (OnboardingModule.currentStep > 0) {
        OnboardingModule.renderStep(OnboardingModule.currentStep - 1);
    }
};

window.app.skipOnboarding = async () => {
    if (confirm('Tem certeza? O modo "Pente Fino" ajuda a personalizar o app.')) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
        document.getElementById('onboarding-overlay').remove();
    }
};

window.app.setMonths = (m, btn) => {
    document.querySelectorAll('.month-opt').forEach(b => {
        b.className = 'month-opt bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition text-center group';
        b.querySelector('span:first-child').className = 'block text-2xl font-bold text-white mb-1';
        b.querySelector('span:last-child').className = 'text-xs text-gray-400 group-hover:text-white uppercase';
    });

    // Select clicked
    btn.className = 'month-opt bg-brand-gold/20 border border-brand-gold p-4 rounded-xl hover:bg-brand-gold/30 transition text-center group ring-2 ring-brand-gold ring-offset-2 ring-offset-[#111]';
    btn.querySelector('span:first-child').className = 'block text-2xl font-bold text-brand-gold mb-1';
    btn.querySelector('span:last-child').className = 'text-xs text-brand-gold/80 group-hover:text-white uppercase';

    window.app.onbData.emergency_months = m;
};

window.app.setLevel = (l, btn) => {
    document.querySelectorAll('.lvl-opt').forEach(b => {
        b.className = 'lvl-opt w-full bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4 text-left hover:bg-white/10 transition';
        b.querySelector('.w-10').className = 'w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold';
    });

    btn.className = 'lvl-opt w-full bg-brand-gold/20 border border-brand-gold p-4 rounded-xl flex items-center gap-4 text-left transition ring-2 ring-brand-gold ring-offset-2 ring-offset-[#111]';
    btn.querySelector('.w-10').className = 'w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-brand-darker font-bold';

    window.app.onbData.knowledge_level = l;
};
