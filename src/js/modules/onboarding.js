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
                <div class="flex-1 flex flex-col justify-center items-center text-center space-y-6 animate-fade-in-up">
                    <div class="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center text-5xl mb-4 shadow-custom">🚀</div>
                    <h2 class="text-3xl font-bold text-white">Bem-vindo ao Moneta</h2>
                    <p class="text-gray-400 text-lg max-w-sm">Vamos organizar o seu futuro. Responda a algumas perguntas rápidas para personalizar sua experiência.</p>
                    <button onclick="window.app.nextStep()" class="bg-brand-gold text-brand-darker font-bold py-4 px-10 rounded-xl text-lg shadow-glow-gold hover:scale-105 transition-transform">Começar Jornada</button>
                    <button onclick="window.app.skipOnboarding()" class="text-xs text-gray-500 font-bold hover:text-white uppercase tracking-widest mt-4">Pular (Configurar depois)</button>
                </div>
            `
        },
        // 1. Momento Atual
        {
            id: 'current_moment',
            render: () => `
                <div class="space-y-6 animate-fade-in-up">
                    <div class="text-center mb-8">
                        <div class="text-4xl mb-2">🤔</div>
                        <h3 class="text-2xl font-bold text-white">Como descreveria sua vida financeira hoje?</h3>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-3">
                        ${OnboardingModule._renderOption('moment', 'debt', 'Tenho dívidas a pagar', '💸')}
                        ${OnboardingModule._renderOption('moment', 'breaking_even', 'Pago as contas, mas não sobra', '⚖️')}
                        ${OnboardingModule._renderOption('moment', 'saving', 'Poupo regularmente', '🐖')}
                        ${OnboardingModule._renderOption('moment', 'optimizing', 'Quero otimizar investimentos', '🚀')}
                    </div>
                </div>
            `,
            validate: () => OnboardingModule._validateSelection('moment', 'current_financial_moment')
        },
        // 2. Objetivo Principal
        {
            id: 'main_goal',
            render: () => `
                <div class="space-y-6 animate-fade-in-up">
                    <div class="text-center mb-8">
                        <div class="text-4xl mb-2">🎯</div>
                        <h3 class="text-2xl font-bold text-white">Qual seu principal objetivo agora?</h3>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-3">
                        ${OnboardingModule._renderOption('goal', 'exit_debt', 'Sair das dívidas', '🔓')}
                        ${OnboardingModule._renderOption('goal', 'emergency_fund', 'Criar reserva de emergência', '🛡️')}
                        ${OnboardingModule._renderOption('goal', 'investing', 'Aprender a investir', '📈')}
                        ${OnboardingModule._renderOption('goal', 'control', 'Controlar gastos diários', '📝')}
                    </div>
                </div>
            `,
            validate: () => OnboardingModule._validateSelection('goal', 'main_financial_goal')
        },
        // 3. Nível de Conhecimento
        {
            id: 'knowledge',
            render: () => `
                <div class="space-y-6 animate-fade-in-up">
                    <div class="text-center mb-8">
                        <div class="text-4xl mb-2">📚</div>
                        <h3 class="text-2xl font-bold text-white">Qual seu nível de conhecimento?</h3>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-3">
                        ${OnboardingModule._renderOption('level', 'beginner', 'Iniciante (Começando agora)', '🌱')}
                        ${OnboardingModule._renderOption('level', 'intermediate', 'Intermédio (Já invisto algo)', '🌿')}
                        ${OnboardingModule._renderOption('level', 'advanced', 'Avançado (Carteira diversificada)', '🌳')}
                    </div>
                </div>
            `,
            validate: () => OnboardingModule._validateSelection('level', 'knowledge_level')
        },
        // 4. Básico (Renda)
        {
            id: 'basics',
            render: () => `
                <div class="space-y-6 animate-fade-in-up">
                    <div class="text-center mb-6">
                        <h3 class="text-2xl font-bold text-white">Para finalizar, alguns números 🔢</h3>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-brand-gold uppercase mb-2">Renda Mensal (Aprox.)</label>
                            <input type="number" id="onb-income" class="w-full bg-brand-bg border border-white/10 rounded-xl p-4 text-white text-lg focus:border-brand-gold outline-none" placeholder="Ex: 5000">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-brand-gold uppercase mb-2">Custo de Vida Mensal</label>
                            <input type="number" id="onb-cost" class="w-full bg-brand-bg border border-white/10 rounded-xl p-4 text-white text-lg focus:border-brand-gold outline-none" placeholder="Ex: 3000">
                            <p class="text-[10px] text-gray-500 mt-2">Isso ajuda a calcular sua reserva de segurança.</p>
                        </div>
                    </div>
                </div>
            `,
            validate: () => {
                const income = document.getElementById('onb-income').value;
                const cost = document.getElementById('onb-cost').value;
                if (!income || !cost) { window.Toast.show('Preencha os valores para continuar.', 'warning'); return false; }
                window.app.onbData.monthly_income = parseFloat(income);
                window.app.onbData.cost_of_living = parseFloat(cost);
                return true;
            }
        },
        // 5. Segurança (Reserva)
        {
            id: 'safety',
            render: () => `
                <div class="space-y-6 animate-fade-in-up">
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
                if (!window.app.onbData.emergency_months) window.app.onbData.emergency_months = 6;
                return true;
            }
        }
    ],

    // Helper functions for UI
    _renderOption(group, value, label, icon) {
        return `
            <label class="cursor-pointer relative group">
                <input type="radio" name="${group}" value="${value}" class="peer sr-only">
                <div class="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 peer-checked:bg-brand-gold/20 peer-checked:border-brand-gold peer-checked:shadow-glow-gold transition-all flex items-center space-x-4">
                    <span class="text-2xl grayscale group-hover:grayscale-0 peer-checked:grayscale-0">${icon}</span>
                    <span class="font-medium text-white">${label}</span>
                    <div class="w-4 h-4 rounded-full border border-white/30 ml-auto peer-checked:bg-brand-gold peer-checked:border-brand-gold"></div>
                </div>
            </label>
        `;
    },

    _validateSelection(groupName, dataKey) {
        const selected = document.querySelector(`input[name="${groupName}"]:checked`);
        if (!selected) {
            window.Toast.show('Por favor, selecione uma opção.', 'warning');
            return false;
        }
        window.app.onbData[dataKey] = selected.value;
        return true;
    },

    renderStep(stepIndex) {
        const container = document.getElementById('onb-content');
        if (!container) return;

        const step = this.steps[stepIndex];
        // Only render content, logic buttons handled globally or inside step html
        let html = step.render();

        // Add navigation if not intro
        if (step.id !== 'intro') {
            html += `
    < div class="mt-auto pt-8 flex justify-between items-center" >
                    <button onclick="window.app.prevStep()" class="text-gray-500 hover:text-white font-bold text-sm px-4">Voltar</button>
                    <button onclick="window.app.nextStep()" class="bg-white text-brand-darker font-bold py-3 px-8 rounded-full shadow hover:bg-gray-200 transition">
                        ${stepIndex === this.steps.length - 1 ? 'Finalizar' : 'Próximo'}
                    </button>
               </div >
    `;
        }

        container.innerHTML = html;
        this.currentStep = stepIndex;

        // Update progress
        const pct = ((stepIndex) / (this.steps.length - 1)) * 100;
        document.getElementById('onb-progress').style.width = `${pct}% `;
    },

    async finish() {
        // Save Everything
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const updates = {
                monthly_income: window.app.onbData.monthly_income,
                current_financial_moment: window.app.onbData.current_financial_moment,
                main_financial_goal: window.app.onbData.main_financial_goal,
                knowledge_level: window.app.onbData.knowledge_level,
                emergency_fund_target_months: window.app.onbData.emergency_months || 6, // Default fallback
                has_emergency_fund: window.app.onbData.has_emergency_fund || false,
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
            Toast.show('Erro ao salvar: ' + e.message, 'error');
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
