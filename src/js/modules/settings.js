import { SettingsService } from '../services/settings.service.js';
import { SupabaseService } from '../services/supabase.service.js';

export const SettingsModule = {
    activeTab: 'categories', // 'categories' | 'profile' | 'banking' | 'params'

    async init() {
        await SettingsService.init();
    },

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        // Fetch user profile for Profile tab
        const session = await SupabaseService.getSession();
        const user = session?.user;
        let profile = {};
        if (user) {
            const { data } = await SupabaseService.client
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            profile = data || {};
        }

        container.innerHTML = `
            <div class="flex flex-col min-h-full bg-brand-bg safe-area-top pb-24 space-y-4">
                
                <!-- HEADER -->
                <div class="px-6 pt-6 sticky top-0 z-20 bg-brand-bg/95 backdrop-blur-md pb-4 border-b border-white/5">
                     <p class="text-xs text-gray-400 font-medium uppercase tracking-wider">Ajustes</p>
                     <h1 class="text-2xl font-bold text-white leading-none mt-1">Configurações</h1>
                </div>

                <!-- TABS SCROLLER -->
                <div class="px-6 overflow-x-auto scrollbar-none">
                    <div class="flex gap-2">
                        ${this.renderTabButton('categories', 'Categorias')}
                        ${this.renderTabButton('profile', 'Perfil & Fiscal')}
                        ${this.renderTabButton('banking', 'Contas & Cartões')}
                        ${this.renderTabButton('recurring', 'Recorrências')}
                        ${this.renderTabButton('params', 'Parâmetros')}
                    </div>
                </div>

                <!-- CONTENT AREA -->
                <div class="px-6 flex-1">
                    ${this.renderContent(profile)}
                </div>
            </div>
            
            <!-- GLOBAL TOAST NOTIFICATION (Simple Implementation or use existing if any) -->
            <div id="settings-toast" class="fixed top-6 left-1/2 -translate-x-1/2 bg-brand-green/90 text-white px-6 py-3 rounded-full shadow-lg transform -translate-y-20 transition-transform duration-300 z-50 font-bold backdrop-blur">
                Salvo com sucesso!
            </div>
        `;

        this.attachListeners();
    },

    renderTabButton(id, label) {
        const isActive = this.activeTab === id;
        return `
            <button class="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${isActive ? 'bg-brand-gold text-brand-darker shadow-lg shadow-brand-gold/20' : 'bg-white/5 text-gray-400 border border-white/5'}"
                data-tab="${id}">
                ${label}
            </button>
        `;
    },

    renderContent(profile) {
        switch (this.activeTab) {
            case 'categories': return this.renderCategoriesTab();
            case 'profile': return this.renderProfileTab(profile);
            case 'banking': return this.renderBankingTab();
            case 'recurring': return this.renderRecurringTab();
            case 'params': return this.renderParamsTab(profile);
            default: return '';
        }
    },

    renderCategoriesTab() {
        const categories = SettingsService.categories;
        return `
            <div class="space-y-6 animate-fade-in">
                <!-- Add Form -->
                <div class="bg-brand-surface rounded-2xl p-4 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-3">Nova Categoria</h3>
                    <form id="add-category-form" class="space-y-3">
                        <input type="text" name="name" placeholder="Nome (ex: Clínica A)" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm focus:border-brand-gold outline-none" required>
                        <div class="flex gap-2">
                            <select name="type" class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm outline-none">
                                <option value="income">Receita</option>
                                <option value="expense">Despesa</option>
                            </select>
                            <select name="context" class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm outline-none">
                                <option value="personal">Pessoal</option>
                                <option value="business">Empresa</option>
                                <option value="both">Ambos</option>
                            </select>
                        </div>
                        <button type="submit" class="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition text-sm">
                            + Adicionar
                        </button>
                    </form>
                </div>

                <!-- List -->
                <div>
                    <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Existentes</h3>
                    <div class="space-y-2">
                        ${categories.length === 0 ? '<p class="text-gray-500 text-sm">Nenhuma categoria criada.</p>' : ''}
                        ${categories.map(c => `
                            <div class="flex items-center justify-between p-3 bg-brand-surface/50 rounded-xl border border-white/5">
                                <div>
                                    <p class="text-white font-medium text-sm">${c.name}</p>
                                    <p class="text-[10px] text-gray-400 capitalize">${c.type === 'income' ? '🟢 Receita' : '🔴 Despesa'} • ${c.context === 'business' ? '💼 PJ' : (c.context === 'personal' ? '👤 PF' : 'Ambos')}</p>
                                </div>
                                <button class="text-red-400 hover:text-red-300 p-2" onclick="SettingsModule.deleteCategory('${c.id}')">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    renderProfileTab(profile) {
        return `
            <div class="space-y-6 animate-fade-in">
                <!-- Fiscal Data -->
                <div class="bg-brand-surface rounded-2xl p-5 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-blue-500 rounded-full"></span>
                        Dados Fiscais
                    </h3>
                    <form id="profile-fiscal-form" class="space-y-4">
                        <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">CPF (Pessoa Física)</label>
                            <input type="text" name="cpf" value="${profile.cpf || ''}" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm focus:border-blue-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">CNPJ (Pessoa Jurídica)</label>
                            <input type="text" name="cnpj" value="${profile.cnpj || ''}" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm focus:border-blue-500 outline-none">
                        </div>
                         <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Regime Tributário</label>
                            <select name="tax_regime" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm outline-none">
                                <option value="" disabled ${!profile.tax_regime ? 'selected' : ''}>Selecione...</option>
                                <option value="simples" ${profile.tax_regime === 'simples' ? 'selected' : ''}>Simples Nacional</option>
                                <option value="lucro_presumido" ${profile.tax_regime === 'lucro_presumido' ? 'selected' : ''}>Lucro Presumido</option>
                                <option value="carne_leao" ${profile.tax_regime === 'carne_leao' ? 'selected' : ''}>Carnê-Leão (PF)</option>
                            </select>
                        </div>
                    </form>
                </div>

                <!-- Pro-labore Automation -->
                <div class="bg-brand-surface rounded-2xl p-5 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-green-500 rounded-full"></span>
                        Pró-Labore Automático
                    </h3>
                    <p class="text-xs text-gray-400 mb-4 leading-relaxed">
                        O app irá criar automaticamente uma <strong>Saída na PJ</strong> e uma <strong>Entrada na PF</strong> todo mês.
                    </p>
                    <form id="profile-prolabore-form" class="space-y-4">
                        <div class="flex gap-4">
                            <div class="flex-1">
                                <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Valor Mensal</label>
                                <input type="number" step="0.01" name="pro_labore_amount" value="${profile.pro_labore_amount || 0}" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm focus:border-green-500 outline-none">
                            </div>
                            <div class="w-1/3">
                                <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Dia</label>
                                <input type="number" min="1" max="31" name="pro_labore_day" value="${profile.pro_labore_day || 5}" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm focus:border-green-500 outline-none">
                            </div>
                        </div>
                    </form>
                </div>

                 <button onclick="SettingsModule.saveProfile()" class="w-full bg-brand-gold text-brand-darker font-bold py-4 rounded-xl shadow-lg shadow-brand-gold/20 active:scale-[0.98] transition">
                    Salvar Alterações
                </button>
            </div>
        `;
    },

    renderBankingTab() {
        const accounts = SettingsService.accounts;
        const cards = SettingsService.cards;

        return `
            <div class="space-y-6 animate-fade-in">
                 <!-- ACCOUNTS -->
                <div class="bg-brand-surface rounded-2xl p-4 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-3">Contas Bancárias</h3>
                    <form id="add-account-form" class="flex gap-2 mb-4">
                         <input type="text" name="name" placeholder="Nome (ex: Itaú PJ)" class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none" required>
                         <select name="type" class="w-24 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none">
                            <option value="checking">Corrente</option>
                            <option value="investment">Invest.</option>
                         </select>
                         <button type="submit" class="bg-white/10 p-3 rounded-xl text-white font-bold">+</button>
                    </form>

                    <div class="space-y-2">
                        ${accounts.map(a => `
                            <div class="flex items-center justify-between p-3 bg-brand-bg rounded-xl border border-white/5">
                                <span class="text-xs text-white font-bold">${a.name}</span>
                                <button class="text-red-400 text-xs" onclick="SettingsModule.deleteAccount('${a.id}')">Excluir</button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                 <!-- CARDS -->
                <div class="bg-brand-surface rounded-2xl p-4 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-3">Cartões de Crédito</h3>
                     <form id="add-card-form" class="space-y-3 mb-4">
                         <input type="text" name="name" placeholder="Nome (ex: Inter Black)" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none" required>
                         <div class="flex gap-2">
                             <input type="number" name="closing_day" placeholder="Dia Fech." class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none" required>
                             <input type="number" name="due_day" placeholder="Dia Venc." class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none" required>
                             <button type="submit" class="bg-white/10 p-3 rounded-xl text-white font-bold w-12">+</button>
                         </div>
                    </form>

                     <div class="space-y-2">
                        ${cards.map(c => `
                            <div class="flex items-center justify-between p-3 bg-brand-bg rounded-xl border border-white/5">
                                <div>
                                    <p class="text-xs text-white font-bold">${c.name}</p>
                                    <p class="text-[10px] text-gray-400">Fecha dia ${c.closing_day} • Vence dia ${c.due_day}</p>
                                </div>
                                <button class="text-red-400 text-xs" onclick="SettingsModule.deleteCard('${c.id}')">Excluir</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    renderParamsTab(profile) {
        return `
             <div class="space-y-6 animate-fade-in">
                <!-- Investment Params -->
                <div class="bg-brand-surface rounded-2xl p-5 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-purple-500 rounded-full"></span>
                        Investimentos
                    </h3>
                    <form id="profile-params-form" class="space-y-4">
                        <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Perfil de Risco (Suitability)</label>
                            <select name="risk_profile" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm outline-none">
                                <option value="conservative" ${profile.risk_profile === 'conservative' ? 'selected' : ''}>Conservador</option>
                                <option value="moderate" ${profile.risk_profile === 'moderate' ? 'selected' : ''}>Moderado</option>
                                <option value="bold" ${profile.risk_profile === 'bold' ? 'selected' : ''}>Arrojado</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Indexador de Referência</label>
                            <select name="benchmark_index" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm outline-none">
                                <option value="cdi" ${profile.benchmark_index === 'cdi' ? 'selected' : ''}>CDI (100%)</option>
                                <option value="ipca" ${profile.benchmark_index === 'ipca' ? 'selected' : ''}>IPCA</option>
                                <option value="ibov" ${profile.benchmark_index === 'ibov' ? 'selected' : ''}>Ibovespa</option>
                            </select>
                        </div>
                    </form>
                </div>

                <!-- Emergency Fund -->
                 <div class="bg-brand-surface rounded-2xl p-5 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-orange-500 rounded-full"></span>
                        Reserva de Emergência (Metas)
                    </h3>
                    <p class="text-xs text-gray-400 mb-4 leading-relaxed">
                        Quantos meses do seu Custo de Vida você quer guardar?
                    </p>
                    <form id="profile-emergency-form" class="space-y-4">
                        <div class="flex gap-4">
                             <div class="flex-1">
                                <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Meses (PF)</label>
                                <input type="number" name="emergency_fund_months_pf" value="${profile.emergency_fund_months_pf || 6}" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm focus:border-orange-500 outline-none">
                            </div>
                            <div class="flex-1">
                                <label class="block text-[10px] text-gray-400 font-bold uppercase mb-1">Meses (PJ)</label>
                                <input type="number" name="emergency_fund_months_pj" value="${profile.emergency_fund_months_pj || 12}" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-sm focus:border-orange-500 outline-none">
                            </div>
                        </div>
                    </form>
                </div>
                
                <button onclick="SettingsModule.saveProfile()" class="w-full bg-brand-gold text-brand-darker font-bold py-4 rounded-xl shadow-lg shadow-brand-gold/20 active:scale-[0.98] transition">
                    Salvar Parâmetros
                </button>
            </div>
        `;
    },

    attachListeners() {
        const container = document.getElementById('main-content');
        if (!container) return;

        // Tab Switching
        container.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activeTab = e.target.dataset.tab;
                this.render();
            });
        });

        // Add Category Form
        const addCatForm = document.getElementById('add-category-form');
        if (addCatForm) {
            addCatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(addCatForm);
                try {
                    await SettingsService.createCategory({
                        name: formData.get('name'),
                        type: formData.get('type'),
                        context: formData.get('context')
                    });
                    this.render(); // Re-render to show new item
                } catch (err) { alert(err.message); }
            });
        }

        // Add Account Form
        const addAccForm = document.getElementById('add-account-form');
        if (addAccForm) {
            addAccForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(addAccForm);
                try {
                    await SettingsService.createAccount({
                        name: formData.get('name'),
                        type: formData.get('type')
                    });
                    this.render();
                } catch (err) { alert(err.message); }
            });
        }

        // Add Card Form
        const addCardForm = document.getElementById('add-card-form');
        if (addCardForm) {
            addCardForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(addCardForm);
                try {
                    await SettingsService.createCard({
                        name: formData.get('name'),
                        closing_day: parseInt(formData.get('closing_day')),
                        due_day: parseInt(formData.get('due_day'))
                    });
                    this.render();
                } catch (err) { alert(err.message); }
            });
        }

        // Add Recurring Form
        const addRecForm = document.getElementById('add-recurring-form');
        if (addRecForm) {
            addRecForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(addRecForm);
                const { data: { user } } = await SupabaseService.getSession();

                try {
                    await SupabaseService.client.from('recurring_transactions').insert({
                        user_id: user.id,
                        description: fd.get('description'),
                        amount: parseFloat(fd.get('amount')),
                        day_of_month: parseInt(fd.get('day_of_month')),
                        type: fd.get('type'),
                        context: fd.get('context'),
                        active: true
                    });
                    this.render();
                } catch (err) { alert(err.message); }
            });
        }
    },

    async saveProfile() {
        const forms = ['profile-fiscal-form', 'profile-prolabore-form', 'profile-params-form', 'profile-emergency-form'];
        let updates = {};

        forms.forEach(fid => {
            const form = document.getElementById(fid);
            if (form) {
                const fd = new FormData(form);
                for (let [key, val] of fd.entries()) {
                    // Check if number
                    if (['pro_labore_amount', 'pro_labore_day', 'emergency_fund_months_pf', 'emergency_fund_months_pj'].includes(key)) {
                        updates[key] = parseFloat(val);
                    } else {
                        updates[key] = val;
                    }
                }
            }
        });

        try {
            await SettingsService.updateProfile(updates);
            this.showToast();
        } catch (e) {
            alert('Erro ao salvar: ' + e.message);
        }
    },

    deleteCategory(id) {
        if (confirm('Remover categoria?')) SettingsService.deleteCategory(id).then(() => this.render()).catch(e => alert(e.message));
    },
    deleteAccount(id) {
        if (confirm('Remover conta?')) SettingsService.deleteAccount(id).then(() => this.render()).catch(e => alert(e.message));
    },
    deleteCard(id) {
        if (confirm('Remover cartão?')) SettingsService.deleteCard(id).then(() => this.render()).catch(e => alert(e.message));
    },

    async renderRecurringTab() {
        // Fetch recurring items directly
        const { data: items } = await SupabaseService.client.from('recurring_transactions').select('*').order('day_of_month');
        const list = items || [];

        return `
            <div class="space-y-6 animate-fade-in">
                 <div class="bg-brand-surface rounded-2xl p-4 border border-white/5">
                    <h3 class="text-sm font-bold text-white mb-3">Nova Recorrência</h3>
                    <form id="add-recurring-form" class="space-y-3">
                         <input type="text" name="description" placeholder="Descrição (ex: Aluguel)" class="w-full bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none" required>
                         <div class="flex gap-2">
                            <input type="number" step="0.01" name="amount" placeholder="Valor" class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none" required>
                            <input type="number" min="1" max="31" name="day_of_month" placeholder="Dia" class="w-20 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none" required>
                        </div>
                        <div class="flex gap-2">
                             <select name="type" class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none">
                                <option value="expense">Despesa</option>
                                <option value="income">Receita</option>
                            </select>
                            <select name="context" class="flex-1 bg-brand-bg rounded-xl border border-white/10 p-3 text-white text-xs outline-none">
                                <option value="business">PJ</option>
                                <option value="personal">PF</option>
                            </select>
                        </div>
                        <button type="submit" class="w-full bg-white/10 p-3 rounded-xl text-white font-bold text-xs hover:bg-white/20 transition">
                            + Adicionar Recorrência
                        </button>
                    </form>
                </div>
                 
                <div class="space-y-2">
                    ${list.length === 0 ? '<p class="text-gray-500 text-xs">Nenhuma recorrência cadastrada.</p>' : ''}
                    ${list.map(item => `
                        <div class="flex items-center justify-between p-3 bg-brand-surface/50 rounded-xl border border-white/5">
                            <div>
                                <p class="text-white font-bold text-xs">${item.description}</p>
                                <p class="text-[10px] text-gray-400">Todo dia ${item.day_of_month} • R$ ${parseFloat(item.amount).toLocaleString('pt-BR')}</p>
                            </div>
                            <button class="text-red-400 p-2" onclick="SettingsModule.deleteRecurring('${item.id}')">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async deleteRecurring(id) {
        if (confirm('Excluir esta regra de recorrência?')) {
            await SupabaseService.client.from('recurring_transactions').delete().eq('id', id);
            this.render();
        }
    },

    showToast() {
        const toast = document.getElementById('settings-toast');
        if (toast) {
            toast.classList.remove('-translate-y-20');
            toast.classList.add('translate-y-6');
            setTimeout(() => {
                toast.classList.remove('translate-y-6');
                toast.classList.add('-translate-y-20');
            }, 3000);
        }
    }
};

// Expose globally
window.SettingsModule = SettingsModule;
