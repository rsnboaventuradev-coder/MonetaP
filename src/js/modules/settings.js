import { SettingsService } from '../services/settings.service.js';
import { SupabaseService } from '../services/supabase.service.js';
import { Toast } from '../utils/toast.js';

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
            // Fetch main profile data (fiscal, pro-labore, etc)
            const { data: profileData } = await SupabaseService.client
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            // Fetch settings/hidden_tabs from user_profiles (use limit(1) for potential duplicates)
            const { data: userProfiles } = await SupabaseService.client
                .from('user_profiles')
                .select('hidden_tabs')
                .eq('user_id', user.id)
                .limit(1);
            const userProfileData = userProfiles?.[0] || null;

            profile = { ...(profileData || {}), ...(userProfileData || {}) };
        }

        container.innerHTML = `
            <div class="flex flex-col min-h-full bg-brand-bg safe-area-top pb-24 space-y-4">
                
                <!-- HEADER -->
                <div class="px-6 pt-6 sticky top-0 z-20 bg-brand-bg/95 backdrop-blur-md pb-4 border-b border-brand-border">
                     <p class="text-xs text-brand-text-secondary font-medium uppercase tracking-wider">Ajustes</p>
                     <h1 class="text-2xl font-bold text-brand-text-primary leading-none mt-1">Configurações</h1>
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
            <div id="settings-toast" class="fixed top-6 left-1/2 -translate-x-1/2 bg-brand-green/90 text-brand-text-primary px-6 py-3 rounded-full shadow-lg transform -translate-y-20 transition-transform duration-300 z-50 font-bold backdrop-blur">
                Salvo com sucesso!
            </div>
        `;

        this.attachListeners();
    },

    renderTabButton(id, label) {
        const isActive = this.activeTab === id;
        return `
            <button class="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${isActive ? 'bg-brand-gold text-brand-darker shadow-lg shadow-brand-gold/20' : 'bg-brand-surface-light text-brand-text-secondary border border-brand-border'}"
                data-tab="${id}">
                ${label}
            </button>
        `;
    },

    renderContent(profile) {
        // Safety check
        if (!profile) {
            return '<div class="p-6 text-center text-brand-text-secondary">Carregando perfil...</div>';
        }

        switch (this.activeTab) {
            case 'categories': return this.renderCategoriesTab();
            case 'profile': return this.renderProfileTab(profile);
            case 'banking': return this.renderBankingTab();
            case 'recurring': return this.renderRecurringTab();
            case 'params': return this.renderParamsTab(profile);
            default: return this.renderCategoriesTab();
        }
    },

    renderCategoriesTab() {
        const categories = SettingsService.categories;
        return `
            <div class="space-y-6 animate-fade-in">
                <!-- Add Form -->
                <div class="bg-brand-surface rounded-2xl p-4 border border-brand-border">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-3">Nova Categoria</h3>
                    <form id="add-category-form" class="space-y-3">
                        <input type="text" name="name" placeholder="Nome (ex: Clínica A)" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm focus:border-brand-gold outline-none" required>
                        <div class="flex gap-2">
                            <select name="type" class="flex-1 bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none">
                                <option value="income">Receita</option>
                                <option value="expense">Despesa</option>
                            </select>
                            <select name="context" class="flex-1 bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none">
                                <option value="personal">Pessoal</option>
                                <option value="business">Empresa</option>
                                <option value="both">Ambos</option>
                            </select>
                        </div>
                        <button type="submit" class="w-full bg-brand-surface-light hover:bg-white/20 text-brand-text-primary font-bold py-3 rounded-xl transition text-sm">
                            + Adicionar
                        </button>
                    </form>
                </div>

                <!-- List -->
                <div>
                    <h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3">Existentes</h3>
                    <div class="space-y-2">
                        ${categories.length === 0 ? '<p class="text-brand-text-secondary text-sm">Nenhuma categoria criada.</p>' : ''}
                        ${categories.map(c => `
                            <div class="flex items-center justify-between p-3 bg-brand-surface/50 rounded-xl border border-brand-border">
                                <div>
                                    <p class="text-brand-text-primary font-medium text-sm">${c.name}</p>
                                    <p class="text-[10px] text-brand-text-secondary capitalize">${c.type === 'income' ? '🟢 Receita' : '🔴 Despesa'} • ${c.context === 'business' ? '💼 PJ' : (c.context === 'personal' ? '👤 PF' : 'Ambos')}</p>
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
                <div class="bg-brand-surface rounded-2xl p-5 border border-brand-border shadow-card-sm hover:shadow-md transition-shadow">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-blue-500 rounded-full"></span>
                        Dados Fiscais
                    </h3>
                    <form id="profile-fiscal-form" class="space-y-4">
                        <div>
                            <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">CPF (Pessoa Física)</label>
                            <input type="text" name="cpf" value="${profile.cpf || ''}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm focus:border-blue-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">CNPJ (Pessoa Jurídica)</label>
                            <input type="text" name="cnpj" value="${profile.cnpj || ''}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm focus:border-blue-500 outline-none">
                        </div>
                         <div>
                            <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Regime Tributário</label>
                            <select name="tax_regime" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none">
                                <option value="" disabled ${!profile.tax_regime ? 'selected' : ''}>Selecione...</option>
                                <option value="simples" ${profile.tax_regime === 'simples' ? 'selected' : ''}>Simples Nacional</option>
                                <option value="lucro_presumido" ${profile.tax_regime === 'lucro_presumido' ? 'selected' : ''}>Lucro Presumido</option>
                                <option value="carne_leao" ${profile.tax_regime === 'carne_leao' ? 'selected' : ''}>Carnê-Leão (PF)</option>
                            </select>
                        </div>
                    </form>
                </div>

                <!-- Tab Visibility Customization -->
                <div class="bg-brand-surface rounded-2xl p-5 border border-brand-border shadow-card-sm hover:shadow-md transition-shadow">
                    <h3 class="text-lg font-bold text-brand-text-primary mb-2 flex items-center gap-2">
                        <svg class="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                        </svg>
                        Personalização de Abas
                    </h3>
                    <p class="text-sm text-brand-text-secondary mb-4">Oculte abas que você não utiliza no dia a dia</p>
                    
                    <div class="space-y-3" id="tab-visibility-container">
                        ${this.renderTabToggles(profile.hidden_tabs || [])}
                    </div>
                </div>

                </div>

                <!-- Theme Customization -->
                <div class="bg-brand-surface rounded-2xl p-5 border border-brand-border shadow-card-sm">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-lg font-bold text-brand-text-primary flex items-center gap-2">
                                <svg class="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
                                </svg>
                                Aparência
                            </h3>
                            <p class="text-sm text-brand-text-secondary mt-1">Personalize o tema do aplicativo</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between p-4 bg-brand-surface-light rounded-xl border border-brand-border hover:border-brand-gold/30 transition-all">
                         <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 flex items-center justify-center">
                                <svg class="w-6 h-6 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-brand-text-primary">Modo Escuro</p>
                                <p class="text-xs text-brand-text-secondary">Reduz fadiga visual e economiza bateria</p>
                            </div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="theme-toggle" class="sr-only peer">
                            <div class="w-14 h-7 bg-brand-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-gold/50 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-gold shadow-inner"></div>
                        </label>
                    </div>
                </div>

                <!-- Pro-labore Automation -->
                <div class="bg-brand-surface rounded-2xl p-5 border border-brand-border shadow-card-sm hover:shadow-md transition-shadow">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-green-500 rounded-full"></span>
                        Pró-Labore Automático
                    </h3>
                    <p class="text-xs text-brand-text-secondary mb-4 leading-relaxed">
                        O app irá criar automaticamente uma <strong>Saída na PJ</strong> e uma <strong>Entrada na PF</strong> todo mês.
                    </p>
                    <form id="profile-prolabore-form" class="space-y-4">
                        <div class="flex gap-4">
                            <div class="flex-1">
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Valor Mensal</label>
                                <input type="number" step="0.01" name="pro_labore_amount" value="${profile.pro_labore_amount || 0}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm focus:border-green-500 outline-none">
                            </div>
                            <div class="w-1/3">
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Dia</label>
                                <input type="number" min="1" max="31" name="pro_labore_day" value="${profile.pro_labore_day || 5}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm focus:border-green-500 outline-none">
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Danger Zone -->
                <div class="bg-red-500/10 rounded-2xl p-5 border border-red-500/20">
                    <h3 class="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                        <span class="w-1 h-4 bg-red-500 rounded-full"></span>
                        Zona de Perigo
                    </h3>
                    <p class="text-xs text-brand-text-secondary mb-4 leading-relaxed">
                        Use apenas para testes. Esta ação é <strong class="text-red-400">IRREVERSÍVEL</strong>.
                    </p>
                    <button onclick="SettingsModule.clearAllData()" class="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-3 rounded-xl transition text-sm border border-red-500/30">
                        🗑️ Limpar Todos os Dados de Teste
                    </button>
                </div>

                 <button id="save-profile-btn" class="w-full bg-brand-gold text-brand-darker font-bold py-4 rounded-xl shadow-lg shadow-brand-gold/20 active:scale-[0.98] transition">
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
                <div class="bg-brand-surface rounded-2xl p-4 border border-brand-border">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-3">Contas Bancárias</h3>
                    <form id="add-account-form" class="flex gap-2 mb-4">
                         <input type="text" name="name" placeholder="Nome (ex: Itaú PJ)" class="flex-1 bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-xs outline-none" required>
                         <select name="type" class="w-24 bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-xs outline-none">
                            <option value="checking">Corrente</option>
                            <option value="investment">Invest.</option>
                         </select>
                         <button type="submit" class="bg-brand-surface-light p-3 rounded-xl text-brand-text-primary font-bold">+</button>
                    </form>

                    <div class="space-y-2">
                        ${accounts.map(a => `
                            <div class="flex items-center justify-between p-3 bg-brand-bg rounded-xl border border-brand-border">
                                <span class="text-xs text-brand-text-primary font-bold">${a.name}</span>
                                <button class="text-red-400 text-xs" onclick="SettingsModule.deleteAccount('${a.id}')">Excluir</button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                 <!-- CARDS -->
                <div class="bg-brand-surface rounded-2xl p-4 border border-brand-border">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-3">Cartões de Crédito</h3>
                     <form id="add-card-form" class="space-y-3 mb-4">
                         <input type="text" name="name" placeholder="Nome (ex: Inter Black)" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-xs outline-none" required>
                         <div class="flex gap-2">
                             <input type="number" name="closing_day" placeholder="Dia Fech." class="flex-1 bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-xs outline-none" required>
                             <input type="number" name="due_day" placeholder="Dia Venc." class="flex-1 bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-xs outline-none" required>
                             <button type="submit" class="bg-brand-surface-light p-3 rounded-xl text-brand-text-primary font-bold w-12">+</button>
                         </div>
                    </form>

                     <div class="space-y-2">
                        ${cards.map(c => `
                            <div class="flex items-center justify-between p-3 bg-brand-bg rounded-xl border border-brand-border">
                                <div>
                                    <p class="text-xs text-brand-text-primary font-bold">${c.name}</p>
                                    <p class="text-[10px] text-brand-text-secondary">Fecha dia ${c.closing_day} • Vence dia ${c.due_day}</p>
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
                <div class="bg-brand-surface rounded-2xl p-5 border border-brand-border">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-purple-500 rounded-full"></span>
                        Investimentos
                    </h3>
                    <form id="profile-params-form" class="space-y-4">
                        <div>
                            <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Perfil de Risco (Suitability)</label>
                            <select name="risk_profile" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none">
                                <option value="conservative" ${profile.risk_profile === 'conservative' ? 'selected' : ''}>Conservador</option>
                                <option value="moderate" ${profile.risk_profile === 'moderate' ? 'selected' : ''}>Moderado</option>
                                <option value="bold" ${profile.risk_profile === 'bold' ? 'selected' : ''}>Arrojado</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Indexador de Referência</label>
                            <select name="benchmark_index" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none">
                                <option value="cdi" ${profile.benchmark_index === 'cdi' ? 'selected' : ''}>CDI (100%)</option>
                                <option value="ipca" ${profile.benchmark_index === 'ipca' ? 'selected' : ''}>IPCA</option>
                                <option value="ibov" ${profile.benchmark_index === 'ibov' ? 'selected' : ''}>Ibovespa</option>
                            </select>
                        </div>
                    </form>
                </div>

                <!-- Emergency Fund -->
                 <div class="bg-brand-surface rounded-2xl p-5 border border-brand-border">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-orange-500 rounded-full"></span>
                        Reserva de Emergência (Metas)
                    </h3>
                    <p class="text-xs text-brand-text-secondary mb-4 leading-relaxed">
                        Quantos meses do seu Custo de Vida você quer guardar?
                    </p>
                    <form id="profile-emergency-form" class="space-y-4">
                        <div class="flex gap-4">
                             <div class="flex-1">
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Meses (PF)</label>
                                <input type="number" name="emergency_fund_months_pf" value="${profile.emergency_fund_months_pf || 6}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm focus:border-orange-500 outline-none">
                            </div>
                            <div class="flex-1">
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Meses (PJ)</label>
                                <input type="number" name="emergency_fund_months_pj" value="${profile.emergency_fund_months_pj || 12}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm focus:border-orange-500 outline-none">
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
                    Toast.show('Categoria criada com sucesso!', 'success');
                    this.render(); // Re-render to show new item
                } catch (err) {
                    Toast.show('Erro ao criar categoria: ' + err.message, 'error');
                }
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
                    Toast.show('Conta criada com sucesso!', 'success');
                    this.render();
                } catch (err) {
                    Toast.show('Erro ao criar conta: ' + err.message, 'error');
                }
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
                    Toast.show('Cartão criado com sucesso!', 'success');
                    this.render();
                } catch (err) {
                    Toast.show('Erro ao criar cartão: ' + err.message, 'error');
                }
            });
        }

        // Hidden Tabs Toggles
        const visibilityContainer = document.getElementById('tab-visibility-container');
        if (visibilityContainer) {
            visibilityContainer.addEventListener('change', (e) => {
                if (e.target.dataset.tab) {
                    // Just visual feedback, saving happens on "Salvar Perfil"
                    // But we could auto-save if preferred. For now kept as bulk save.
                }
            });
        }

        // Theme Toggle (Immediate Effect)
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            // Set initial state
            const isDarkMode = document.documentElement.classList.contains('dark');
            themeToggle.checked = isDarkMode;

            themeToggle.addEventListener('change', (e) => {
                try {
                    const isDark = document.documentElement.classList.toggle('dark');
                    localStorage.setItem('theme', isDark ? 'dark' : 'light');
                    e.target.checked = isDark; // Ensure visual sync
                    Toast.show(`Modo ${isDark ? 'Escuro 🌙' : 'Claro ☀️'} ativado`, 'success');
                } catch (error) {
                    console.error('Theme toggle error:', error);
                    Toast.show('Erro ao alternar tema', 'error');
                }
            });
        } else {
            console.warn('Theme toggle element not found');
        }

        // Add Recurring Form
        const addRecForm = document.getElementById('add-recurring-form');
        if (addRecForm) {
            addRecForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(addRecForm);
                const { data: { user } } = await SupabaseService.getSession();

                try {
                    const amountInCents = Math.round(parseFloat(fd.get('amount')) * 100);

                    await SupabaseService.client.from('recurring_transactions').insert({
                        user_id: user.id,
                        description: fd.get('description'),
                        amount: amountInCents, // Store in cents
                        day_of_month: parseInt(fd.get('day_of_month')),
                        type: fd.get('type'),
                        context: fd.get('context'),
                        active: true
                    });
                    Toast.show('Recorrência criada com sucesso!', 'success');
                    this.render();
                } catch (err) {
                    Toast.show('Erro ao criar recorrência: ' + err.message, 'error');
                }
            });
        }

        // Save Profile Button
        const saveProfileBtn = document.getElementById('save-profile-btn');
        if (saveProfileBtn) {
            console.log('✅ Botão "Salvar Alterações" encontrado e listener anexado!');
            saveProfileBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('🖱️ Botão "Salvar Alterações" clicado!');
                console.log('🔍 Verificando SettingsModule.saveProfile:', typeof SettingsModule.saveProfile);
                try {
                    console.log('📞 Chamando SettingsModule.saveProfile()...');
                    const result = await SettingsModule.saveProfile();
                    console.log('📤 Resultado do saveProfile:', result);
                } catch (err) {
                    console.error('❌ Erro crítico ao chamar saveProfile:', err);
                    Toast.show('Erro interno ao salvar: ' + err.message, 'error');
                }
            });
        } else {
            console.warn('⚠️ Botão "Salvar Alterações" NÃO encontrado!');
        }

        // Tab Visibility Toggles - auto-save on change
        const toggleTabCheckboxes = container.querySelectorAll('.toggle-tab');
        toggleTabCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                console.log('🔀 Toggle tab changed:', e.target.dataset.tab, 'checked:', e.target.checked);
                try {
                    await SettingsModule.saveTabVisibility();
                } catch (err) {
                    console.error('Erro ao salvar visibilidade de abas:', err);
                }
            });
        });
    },

    async saveProfile() {
        console.log('💾 saveProfile() chamado!');

        const forms = ['profile-fiscal-form', 'profile-prolabore-form', 'profile-params-form', 'profile-emergency-form'];
        let updates = {};

        forms.forEach(fid => {
            const form = document.getElementById(fid);
            console.log(`Formulário ${fid}:`, form ? 'encontrado' : 'NÃO encontrado');

            if (form) {
                const fd = new FormData(form);
                for (let [key, val] of fd.entries()) {
                    console.log(`  Campo ${key}:`, val);
                    // Check if number
                    if (['pro_labore_amount', 'pro_labore_day', 'emergency_fund_months_pf', 'emergency_fund_months_pj'].includes(key)) {
                        updates[key] = parseFloat(val);
                    } else {
                        updates[key] = val;
                    }
                }
            }
        });

        console.log('📦 Updates coletados:', updates);

        try {
            console.log('🚀 Enviando para SettingsService...');
            await SettingsService.updateProfile(updates);
            console.log('✅ Perfil salvo com sucesso!');
            this.showToast();
        } catch (e) {
            console.error('❌ Erro ao salvar:', e);
            Toast.show('Erro ao salvar perfil: ' + e.message, 'error');
        }
    },

    async deleteCategory(id) {
        try {
            await SettingsService.deleteCategory(id);
            Toast.show('Categoria removida', 'success');
            this.render();
        } catch (e) {
            Toast.show('Erro ao remover categoria: ' + e.message, 'error');
        }
    },
    async deleteAccount(id) {
        try {
            await SettingsService.deleteAccount(id);
            Toast.show('Conta removida', 'success');
            this.render();
        } catch (e) {
            Toast.show('Erro ao remover conta: ' + e.message, 'error');
        }
    },
    async deleteCard(id) {
        try {
            await SettingsService.deleteCard(id);
            Toast.show('Cartão removido', 'success');
            this.render();
        } catch (e) {
            Toast.show('Erro ao remover cartão: ' + e.message, 'error');
        }
    },

    async renderRecurringTab() {
        // Fetch recurring items directly
        const { data: items } = await SupabaseService.client.from('recurring_transactions').select('*').order('day_of_month');
        const list = items || [];

        // Separate by context
        const pjItems = list.filter(i => i.context === 'business');
        const pfItems = list.filter(i => i.context === 'personal');

        return `
            <div class="space-y-6 animate-fade-in">
                <!-- Add Form -->
                <div class="bg-brand-surface rounded-2xl p-5 border border-brand-border">
                    <h3 class="text-sm font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                        <span class="w-1 h-4 bg-blue-500 rounded-full"></span>
                        Nova Recorrência
                    </h3>
                    <form id="add-recurring-form" class="space-y-3">
                        <input type="text" name="description" placeholder="Descrição (ex: Netflix, Aluguel)" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none focus:border-blue-500" required>
                        
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Valor (R$)</label>
                                <input type="number" step="0.01" name="amount" placeholder="0,00" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none focus:border-blue-500" required>
                            </div>
                            <div>
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Dia do Mês</label>
                                <input type="number" min="1" max="31" name="day_of_month" placeholder="1-31" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none focus:border-blue-500" required>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Tipo</label>
                                <select name="type" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none">
                                    <option value="expense">💸 Despesa</option>
                                    <option value="income">💰 Receita</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] text-brand-text-secondary font-bold uppercase mb-1">Contexto</label>
                                <select name="context" class="w-full bg-brand-bg rounded-xl border border-brand-border p-3 text-brand-text-primary text-sm outline-none">
                                    <option value="personal">👤 Pessoal (PF)</option>
                                    <option value="business">💼 Empresa (PJ)</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" class="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold py-3 rounded-xl transition text-sm border border-blue-500/30">
                            + Adicionar Recorrência
                        </button>
                    </form>
                </div>

                <!-- PJ List -->
                ${pjItems.length > 0 ? `
                    <div>
                        <h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span class="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 text-xs">💼</span>
                            Empresa (PJ) • ${pjItems.length} recorrência${pjItems.length !== 1 ? 's' : ''}
                        </h3>
                        <div class="space-y-2">
                            ${pjItems.map(item => this.renderRecurringItem(item)).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- PF List -->
                ${pfItems.length > 0 ? `
                    <div>
                        <h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span class="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 text-xs">👤</span>
                            Pessoal (PF) • ${pfItems.length} recorrência${pfItems.length !== 1 ? 's' : ''}
                        </h3>
                        <div class="space-y-2">
                            ${pfItems.map(item => this.renderRecurringItem(item)).join('')}
                        </div>
                    </div>
                ` : ''}

                ${list.length === 0 ? `
                    <div class="text-center py-12">
                        <div class="w-16 h-16 bg-brand-surface-light rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <p class="text-brand-text-secondary text-sm font-medium">Nenhuma recorrência cadastrada</p>
                        <p class="text-gray-600 text-xs mt-1">Adicione assinaturas, aluguéis e outras despesas/receitas fixas</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderRecurringItem(item) {
        const isExpense = item.type === 'expense';
        const typeIcon = isExpense ? '💸' : '💰';
        const typeColor = isExpense ? 'text-red-400' : 'text-green-400';
        const amount = parseFloat(item.amount) / 100; // Convert from cents

        return `
            <div class="flex items-center justify-between p-4 bg-brand-surface/50 rounded-xl border border-brand-border hover:border-brand-border transition">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm">${typeIcon}</span>
                        <p class="text-brand-text-primary font-bold text-sm">${item.description}</p>
                        ${!item.active ? '<span class="text-[10px] bg-gray-500/20 text-brand-text-secondary px-2 py-0.5 rounded-full">Inativa</span>' : ''}
                    </div>
                    <div class="flex items-center gap-3 text-[10px] text-brand-text-secondary">
                        <span>📅 Todo dia ${item.day_of_month}</span>
                        <span class="${typeColor} font-bold">R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <button class="text-red-400 hover:text-red-300 p-2 transition" onclick="SettingsModule.deleteRecurring('${item.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        `;
    },

    async deleteRecurring(id) {
        const confirmed = await this.showConfirmModal('Confirmar', 'Excluir esta regra de recorrência?');
        if (confirmed) {
            await SupabaseService.client.from('recurring_transactions').delete().eq('id', id);
            this.render();
        }
    },

    /**
     * Shows a custom confirmation modal and returns a Promise
     * @param {string} title - Modal title
     * @param {string} message - Modal message
     * @returns {Promise<boolean>} - True if confirmed, false if cancelled
     */
    showConfirmModal(title, message) {
        return new Promise((resolve) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
            overlay.id = 'confirm-modal-overlay';

            overlay.innerHTML = `
                <div class="bg-brand-surface rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
                    <h3 class="text-xl font-bold text-brand-text-primary mb-4">${title}</h3>
                    <p class="text-brand-text-secondary whitespace-pre-line mb-6">${message}</p>
                    <div class="flex gap-3">
                        <button id="confirm-modal-cancel" class="flex-1 py-3 px-4 rounded-xl bg-brand-bg text-brand-text-secondary font-medium hover:bg-brand-surface-light transition">
                            Cancelar
                        </button>
                        <button id="confirm-modal-confirm" class="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition">
                            Confirmar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Handle confirm
            document.getElementById('confirm-modal-confirm').addEventListener('click', () => {
                overlay.remove();
                resolve(true);
            });

            // Handle cancel
            document.getElementById('confirm-modal-cancel').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });

            // Handle overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(false);
                }
            });

            // Handle escape key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    overlay.remove();
                    document.removeEventListener('keydown', escHandler);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    },

    async clearAllData() {
        // First confirmation
        const confirmed = await this.showConfirmModal(
            '⚠️ ATENÇÃO',
            'Esta ação irá APAGAR TODOS OS SEUS DADOS!\n\n' +
            'Serão removidos:\n' +
            '• Todas as transações\n' +
            '• Todas as metas\n' +
            '• Todos os investimentos\n' +
            '• Todas as recorrências\n' +
            '• Categorias, contas e cartões personalizados\n\n' +
            'Esta ação é IRREVERSÍVEL!'
        );

        if (!confirmed) return;

        // Second confirmation
        const doubleConfirm = await this.showConfirmModal(
            '🚨 ÚLTIMA CONFIRMAÇÃO',
            'Tem CERTEZA ABSOLUTA que deseja apagar TODOS os seus dados?\n\n' +
            'Esta ação NÃO pode ser desfeita!'
        );

        if (!doubleConfirm) {
            Toast.show('Operação cancelada', 'info');
            return;
        }

        try {
            const session = await SupabaseService.getSession();
            const userId = session?.user?.id;
            if (!userId) throw new Error('Usuário não autenticado');

            Toast.show('Limpando dados... Aguarde...', 'info');

            // Delete all user data from all tables
            const tables = [
                'transactions',
                'goals',
                'investments',
                'recurring_transactions',
                'categories',
                'accounts',
                'credit_cards',
                'budget_allocations',
                'asset_analysis'
            ];

            for (const table of tables) {
                try {
                    await SupabaseService.client
                        .from(table)
                        .delete()
                        .eq('user_id', userId);
                    console.log(`✅ Cleared ${table}`);
                } catch (err) {
                    console.warn(`⚠️ Could not clear ${table}:`, err.message);
                }
            }

            // Clear local storage
            const keysToKeep = ['supabase.auth.token']; // Keep auth token
            Object.keys(localStorage).forEach(key => {
                if (!keysToKeep.some(k => key.includes(k))) {
                    localStorage.removeItem(key);
                }
            });

            Toast.show('✅ Todos os dados foram apagados!', 'success');

            // Reload app after 2 seconds
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Error clearing data:', error);
            Toast.show('Erro ao limpar dados: ' + error.message, 'error');
        }
    },

    renderTabToggles(hiddenTabs = []) {
        const allTabs = [
            { id: 'dashboard', icon: '', label: 'Dashboard', canHide: false },
            { id: 'wallet', icon: '', label: 'Carteira', canHide: true },
            { id: 'goals', icon: '', label: 'Metas', canHide: true },
            { id: 'reports', icon: '', label: 'Relatórios', canHide: true },
            { id: 'investments', icon: '', label: 'Investimentos', canHide: true },
            { id: 'settings', icon: '', label: 'Configurações', canHide: false }
        ];

        return allTabs.map(tab => {
            const isHidden = hiddenTabs.includes(tab.id);
            const isChecked = !isHidden; // Checkbox is for "visible", not "hidden"

            return `
                <label class="flex items-center justify-between p-3 bg-brand-surface-light rounded-xl cursor-pointer hover:bg-brand-surface-light transition ${!tab.canHide ? 'opacity-50 cursor-not-allowed' : ''}">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${tab.icon}</span>
                        <span class="text-sm font-medium text-brand-text-primary">${tab.label}</span>
                        ${!tab.canHide ? '<span class="text-[9px] bg-gray-500/20 text-brand-text-secondary px-2 py-0.5 rounded ml-2">Obrigatório</span>' : ''}
                    </div>
                    <input 
                        type="checkbox" 
                        class="toggle-tab w-5 h-5 rounded accent-brand-gold" 
                        data-tab="${tab.id}" 
                        ${isChecked ? 'checked' : ''}
                        ${!tab.canHide ? 'disabled' : ''}
                    >
                </label>
            `;
        }).join('');
    },

    async saveTabVisibility() {
        const checkboxes = document.querySelectorAll('.toggle-tab');
        const hiddenTabs = [];

        checkboxes.forEach(checkbox => {
            if (!checkbox.checked && !checkbox.disabled) {
                hiddenTabs.push(checkbox.dataset.tab);
            }
        });

        console.log('🗂️ Salvando visibilidade de abas:', hiddenTabs);

        try {
            const session = await SupabaseService.getSession();
            const user = session?.user;
            if (!user) return;

            // Use update first, fallback to insert if no rows affected
            const { data: updateResult, error: updateError } = await SupabaseService.client
                .from('user_profiles')
                .update({ hidden_tabs: hiddenTabs })
                .eq('user_id', user.id)
                .select();

            console.log('🔄 Update result:', updateResult, 'Error:', updateError);

            // If no rows were updated, insert a new row
            if (!updateError && (!updateResult || updateResult.length === 0)) {
                console.log('📝 No existing row, creating new one...');
                const { error: insertError } = await SupabaseService.client
                    .from('user_profiles')
                    .insert({ user_id: user.id, hidden_tabs: hiddenTabs });

                if (insertError) throw insertError;
            } else if (updateError) {
                throw updateError;
            }

            console.log('✅ Visibilidade de abas salva!');
            Toast.show('Preferências salvas!', 'success');

            // Update app navigation immediately
            if (window.app && window.app.renderNavigation) {
                window.app.renderNavigation();
            }

        } catch (error) {
            console.error('Error saving tab visibility:', error);
            Toast.show('Erro ao salvar preferências', 'error');
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



