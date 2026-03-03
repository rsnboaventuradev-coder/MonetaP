import { SettingsService } from '../services/settings.service.js';
import { SupabaseService } from '../services/supabase.service.js';
import { Toast } from '../utils/toast.js';
import { CurrencyMask } from '../utils/mask.js';

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
                <div class="px-6 pt-8 pb-4 sticky top-0 z-20 bg-brand-bg/80 backdrop-blur-xl">
                     <p class="text-xs text-brand-text-secondary font-bold uppercase tracking-widest mb-1 opacity-80">Ajustes do Sistema</p>
                     <h1 class="text-3xl font-black text-brand-text-primary tracking-tight">Configurações</h1>
                </div>

                <!-- TABS SCROLLER -->
                <div class="px-6 pb-2 overflow-x-auto hide-scrollbar sticky top-[88px] z-10 bg-brand-bg/80 backdrop-blur-xl">
                    <div class="flex gap-1 p-1 bg-brand-surface-light/50 border border-brand-border/50 rounded-2xl w-max">
                        ${this.renderTabButton('categories', 'Categorias')}
                        ${this.renderTabButton('profile', 'Perfil & Fiscal')}
                        ${this.renderTabButton('banking', 'Contas & Cartões')}
                        ${this.renderTabButton('recurring', 'Recorrências')}
                        ${this.renderTabButton('params', 'Parâmetros')}
                    </div>
                </div>

                <!-- CONTENT AREA -->
                <div class="px-6 flex-1 pt-4">
                    ${this.renderContent(profile)}
                </div>
            </div>
            
            <!-- GLOBAL TOAST NOTIFICATION -->
            <div id="settings-toast" class="fixed top-6 left-1/2 -translate-x-1/2 bg-brand-green border border-brand-green/20 text-brand-darker px-8 py-4 rounded-2xl shadow-2xl transform -translate-y-24 transition-all duration-500 z-[9999] font-black tracking-tight backdrop-blur flex items-center gap-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                <span>Salvo com sucesso!</span>
            </div>
        `;

        // Initialize masks after render
        setTimeout(() => CurrencyMask.initAll(), 100);

        this.attachListeners();
    },

    renderTabButton(id, label) {
        const isActive = this.activeTab === id;
        const activeClass = 'bg-brand-surface text-brand-gold shadow-sm ring-1 ring-brand-border';
        const inactiveClass = 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface/50';
        return `
            <button class="relative whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${isActive ? activeClass : inactiveClass}"
                data-tab="${id}">
                ${label}
                ${isActive ? '<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-gold"></div>' : ''}
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
        const categories = SettingsService.categories || [];
        const incomes = categories.filter(c => c.type === 'INCOME');
        const expenses = categories.filter(c => c.type === 'EXPENSE');

        const renderCatItem = (c) => `
            <div class="group flex items-center justify-between p-4 bg-brand-surface-light/30 border border-brand-border/50 rounded-2xl hover:bg-brand-surface transition-all">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-brand-bg flex items-center justify-center text-lg shadow-inner">
                        ${c.type === 'INCOME' ? '🟢' : '🔴'}
                    </div>
                    <div>
                        <p class="text-brand-text-primary font-bold text-sm select-all">${c.name}</p>
                        <div class="text-[10px] flex gap-1 mt-1">
                            ${c.context === 'business' || c.context === 'both' ? '<span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold tracking-wider">PJ</span>' : ''}
                            ${c.context === 'personal' || c.context === 'both' ? '<span class="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold tracking-wider">PF</span>' : ''}
                        </div>
                    </div>
                </div>
                <button class="opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-all" onclick="SettingsModule.deleteCategory('${c.id}')">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        `;

        return `
            <div class="space-y-8 flex-1 pb-10">
                <!-- Add Form -->
                <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1">Nova Categoria</h3>
                        <p class="text-xs text-brand-text-secondary mb-5">Organize suas transações com categorias personalizadas.</p>
                        <form id="add-category-form" class="space-y-4">
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-secondary">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                                </span>
                                <input type="text" name="name" placeholder="Nome da Categoria..." class="w-full bg-brand-bg rounded-xl border border-brand-border pl-12 pr-4 py-4 text-brand-text-primary text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none transition-all placeholder:text-brand-text-secondary/50 font-bold tracking-wide" required>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <select name="type" class="bg-brand-bg rounded-xl border border-brand-border px-4 py-3.5 text-brand-text-primary text-sm outline-none focus:border-brand-gold transition-colors appearance-none font-bold text-center select-arrow-none style-none text-opacity-90">
                                    <option value="INCOME">🟢 Receita</option>
                                    <option value="EXPENSE">🔴 Despesa</option>
                                </select>
                                <select name="context" class="bg-brand-bg rounded-xl border border-brand-border px-4 py-3.5 text-brand-text-primary text-sm outline-none focus:border-brand-gold transition-colors appearance-none font-bold text-center select-arrow-none style-none text-opacity-90">
                                    <option value="personal">👤 Pessoal (PF)</option>
                                    <option value="business">💼 Empresa (PJ)</option>
                                    <option value="both">⚪ Ambos</option>
                                </select>
                            </div>
                            <button type="submit" class="w-full bg-brand-gold text-brand-darker font-black py-4 rounded-xl hover:scale-[1.02] shadow-lg shadow-brand-gold/20 transition-all uppercase tracking-widest text-xs mt-2">
                                Adicionar
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Lists -->
                <div class="space-y-6">
                    <div>
                        <h3 class="text-[10px] font-black text-green-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span> Receitas
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${incomes.length === 0 ? '<p class="text-brand-text-secondary text-sm italic">Nenhuma registrada.</p>' : ''}
                            ${incomes.map(renderCatItem).join('')}
                        </div>
                    </div>

                    <div>
                        <h3 class="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 mt-8 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span> Despesas
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            ${expenses.length === 0 ? '<p class="text-brand-text-secondary text-sm italic">Nenhuma registrada.</p>' : ''}
                            ${expenses.map(renderCatItem).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderProfileTab(profile) {
        return `
            <div class="space-y-8 flex-1 pb-10">
                <!-- Fiscal Data -->
                <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-blue-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span> Dados Fiscais
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6">Informações utilizadas para cálculo de impostos e análises patrimoniais.</p>
                        
                        <form id="profile-fiscal-form" class="space-y-5">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">CPF</label>
                                    <input type="text" name="cpf" value="${profile.cpf || ''}" placeholder="000.000.000-00" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-brand-text-secondary/30 font-bold tracking-widest">
                                </div>
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">CNPJ</label>
                                    <input type="text" name="cnpj" value="${profile.cnpj || ''}" placeholder="00.000.000/0000-00" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-brand-text-secondary/30 font-bold tracking-widest">
                                </div>
                            </div>
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Regime Tributário (Empresa principal)</label>
                                <select name="tax_regime" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                    <option value="" disabled ${!profile.tax_regime ? 'selected' : ''}>Selecione...</option>
                                    <option value="simples" ${profile.tax_regime === 'simples' ? 'selected' : ''}>Simples Nacional</option>
                                    <option value="lucro_presumido" ${profile.tax_regime === 'lucro_presumido' ? 'selected' : ''}>Lucro Presumido</option>
                                    <option value="carne_leao" ${profile.tax_regime === 'carne_leao' ? 'selected' : ''}>Carnê-Leão (PF)</option>
                                </select>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Theme Customization -->
                <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-brand-gold/10"></div>
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-6">
                            <div>
                                <h3 class="text-lg font-black text-brand-text-primary flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]"></span>Aparência
                                </h3>
                                <p class="text-xs text-brand-text-secondary mt-1">Personalize o tema do aplicativo</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between p-5 bg-brand-surface-light/30 rounded-2xl border border-brand-border/50 hover:bg-brand-surface transition-all group/item cursor-pointer" onclick="document.getElementById('theme-toggle').click()">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-full bg-brand-bg flex items-center justify-center shadow-inner group-hover/item:scale-110 transition-transform">
                                    <svg class="w-6 h-6 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-brand-text-primary tracking-wide">Modo Escuro</p>
                                    <p class="text-[10px] text-brand-text-secondary">Reduz fadiga visual e economiza bateria</p>
                                </div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
                                <input type="checkbox" id="theme-toggle" class="sr-only peer">
                                <div class="w-14 h-7 bg-brand-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-gold/50 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-gold shadow-inner"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Tab Visibility Customization -->
                <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-purple-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
                            Acesso às Abas
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6">Oculte recursos que não se alinham a sua organização no momento.</p>
                        
                        <div class="space-y-3" id="tab-visibility-container">
                            ${this.renderTabToggles(profile.hidden_tabs || [])}
                        </div>
                    </div>
                </div>

                <!-- Pro-labore Automation -->
                <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-green-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                            Pró-Labore Automático
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6 leading-relaxed">
                            O app criará automaticamente uma <strong>Saída na PJ</strong> e uma <strong>Entrada na PF</strong> todo mês neste dia, usando o valor especificado.
                        </p>
                        
                        <form id="profile-prolabore-form" class="grid grid-cols-3 gap-5">
                            <div class="col-span-2 relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Valor Mensal (R$)</label>
                                <input type="text" name="pro_labore_amount" data-currency="true" value="${CurrencyMask.format(profile.pro_labore_amount ? (profile.pro_labore_amount * 100).toString() : '0')}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none transition-all font-bold tracking-widest text-right">
                            </div>
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Dia</label>
                                <input type="number" min="1" max="31" name="pro_labore_day" value="${profile.pro_labore_day || 5}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none transition-all font-bold tracking-widest text-center">
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Action Button -->
                <button id="save-profile-btn" class="w-full bg-brand-gold text-brand-darker font-black py-5 rounded-2xl shadow-lg shadow-brand-gold/30 hover:shadow-brand-gold/50 hover:scale-[1.01] active:scale-[0.98] transition-all uppercase tracking-widest text-sm relative overflow-hidden group">
                    <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span class="relative z-10">Salvar Alterações de Perfil</span>
                </button>

                <!-- Danger Zone -->
                <div class="bg-red-500/5 border border-red-500/20 rounded-3xl p-6 relative overflow-hidden mt-12">
                     <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWxsPSdub25lJy8+PGxpbmUgeDE9JzAnIHkxPScxMDAnIHgyPScxMDAnIHkyPScwJyBzdHJva2U9J3JnYmEoMjM5LCA2OCwgNjgsIDAuMSknIHN0cm9rZS13aWR0aD0nMicvPjwvc3ZnPg==')] opacity-50 z-0 pointer-events-none"></div>
                     <div class="relative z-10 flex flex-col items-center">
                        <div class="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-3">
                            <span class="text-xl">⚠️</span>
                        </div>
                        <h3 class="text-sm font-black text-red-500 uppercase tracking-widest mb-2">Zona de Perigo Extremo</h3>
                        <p class="text-xs text-red-400/80 text-center mb-5 max-w-sm">Esta ação apagará absolutamente TODOS os dados da sua conta para recomeçar o sistema do zero. É <b>irreversível</b>.</p>
                        
                        <button onclick="SettingsModule.clearAllData()" class="px-8 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 font-bold py-3 rounded-xl transition-all text-xs border border-red-500/30 uppercase tracking-widest shadow-lg shadow-red-500/10 hover:shadow-red-500/30 active:scale-95">
                            Realizar Hard Reset
                        </button>
                     </div>
                </div>
            </div>
        `;
    },

    renderBankingTab() {
        const accounts = SettingsService.accounts || [];
        const cards = SettingsService.cards || [];

        return `
            <div class="space-y-8 flex-1 pb-10">
                 <!-- ACCOUNTS -->
                 <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-blue-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span> Contas Bancárias
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6">Contas para vinculação às suas transações de entrada e saída.</p>
                        
                        <form id="add-account-form" class="flex gap-3 mb-6">
                            <div class="flex-1 relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Nome da Instituição</label>
                                <input type="text" name="name" placeholder="Ex: Itaú, Nubank PJ" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-brand-text-secondary/30 font-bold" required>
                            </div>
                            <div class="w-32 relative hidden md:block">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Tipo</label>
                                <select name="type" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-10">
                                    <option value="checking">Corrente</option>
                                    <option value="investment">Investimento</option>
                                </select>
                            </div>
                            <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-xl font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm w-14 flex items-center justify-center">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/></svg>
                            </button>
                        </form>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            ${accounts.length === 0 ? '<p class="text-brand-text-secondary text-sm italic col-span-full">Nenhuma conta cadastrada.</p>' : ''}
                            ${accounts.map(a => `
                                <div class="group flex items-center justify-between p-4 bg-brand-surface-light/30 border border-brand-border/50 rounded-2xl hover:bg-brand-surface transition-all">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-brand-bg flex items-center justify-center text-xl shadow-inner border border-brand-border/30">
                                            🏦
                                        </div>
                                        <div>
                                            <p class="text-brand-text-primary font-bold text-sm select-all">${a.name}</p>
                                            <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest">${a.type === 'investment' ? 'Investimentos' : 'Corrente'}</p>
                                        </div>
                                    </div>
                                    <button class="opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-all" onclick="SettingsModule.deleteAccount('${a.id}')">
                                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                 <!-- CARDS -->
                 <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-purple-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span> Cartões de Crédito
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6">Cartões usados para centralizar despesas no débito/crédito.</p>
                        
                        <form id="add-card-form" class="space-y-4 mb-6">
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Nome do Cartão</label>
                                <input type="text" name="name" placeholder="Ex: C6 Carbon" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-brand-text-secondary/30 font-bold" required>
                            </div>
                            <div class="flex gap-3">
                                <div class="flex-1 relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Dia Fecha.</label>
                                    <input type="number" min="1" max="31" name="closing_day" placeholder="Ex: 5" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all font-bold tracking-widest text-center" required>
                                </div>
                                <div class="flex-1 relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Dia Venc.</label>
                                    <input type="number" min="1" max="31" name="due_day" placeholder="Ex: 10" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all font-bold tracking-widest text-center" required>
                                </div>
                                <button type="submit" class="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-xl font-black shadow-lg shadow-purple-500/20 active:scale-95 transition-all text-sm w-14 flex items-center justify-center">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/></svg>
                                </button>
                            </div>
                        </form>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            ${cards.length === 0 ? '<p class="text-brand-text-secondary text-sm italic col-span-full">Nenhum cartão cadastrado.</p>' : ''}
                            ${cards.map(c => `
                                <div class="group relative p-5 bg-gradient-to-br from-brand-surface-light border border-brand-border/50 rounded-2xl overflow-hidden hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/5 transition-all">
                                    <!-- Card design elements -->
                                    <div class="absolute -right-4 -top-8 w-24 h-24 bg-brand-gold/10 rounded-full blur-2xl"></div>
                                    <div class="absolute -left-4 -bottom-8 w-24 h-24 bg-purple-500/10 rounded-full blur-xl"></div>
                                    <div class="absolute top-4 right-5 opacity-40">
                                        <svg width="30" height="20" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#eb001b"/><circle cx="28" cy="12" r="12" fill="#f79e1b" fill-opacity="0.8"/></svg>
                                    </div>
                                    
                                    <div class="relative z-10 flex flex-col justify-between h-full min-h-[5rem]">
                                        <div class="flex justify-between items-start">
                                            <div>
                                                <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest mb-1 opacity-80">Cartão de Crédito</p>
                                                <p class="text-brand-text-primary text-base font-black tracking-wide">${c.name}</p>
                                            </div>
                                        </div>
                                        
                                        <div class="flex justify-between items-end mt-4">
                                            <div class="flex gap-4">
                                                <div>
                                                    <p class="text-[9px] text-brand-text-secondary uppercase">Fecha</p>
                                                    <p class="text-xs font-bold text-brand-text-primary">Dia ${c.closing_day}</p>
                                                </div>
                                                <div>
                                                    <p class="text-[9px] text-brand-text-secondary uppercase">Vence</p>
                                                    <p class="text-xs font-bold text-brand-text-primary">Dia ${c.due_day}</p>
                                                </div>
                                            </div>
                                            <button class="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100" onclick="SettingsModule.deleteCard('${c.id}')">
                                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderParamsTab(profile) {
        return `
             <div class="space-y-8 flex-1 pb-10">
                <!-- Investment Params -->
                <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-purple-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
                            Perfil de Investimento
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6">Personaliza a rentabilidade e alocações recomendadas dos seus ativos.</p>
                        
                        <form id="profile-params-form" class="space-y-5">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Suitability</label>
                                    <select name="risk_profile" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                        <option value="conservative" ${profile.risk_profile === 'conservative' ? 'selected' : ''}>Conservador 🛡️</option>
                                        <option value="moderate" ${profile.risk_profile === 'moderate' ? 'selected' : ''}>Moderado ⚖️</option>
                                        <option value="bold" ${profile.risk_profile === 'bold' ? 'selected' : ''}>Arrojado 🚀</option>
                                    </select>
                                </div>
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Indexador Principal</label>
                                    <select name="benchmark_index" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                        <option value="cdi" ${profile.benchmark_index === 'cdi' ? 'selected' : ''}>CDI (100%)</option>
                                        <option value="ipca" ${profile.benchmark_index === 'ipca' ? 'selected' : ''}>IPCA</option>
                                        <option value="ibov" ${profile.benchmark_index === 'ibov' ? 'selected' : ''}>Ibovespa</option>
                                    </select>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Emergency Fund -->
                 <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-orange-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></span>
                            Estrutura de Reserva
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6 leading-relaxed">
                            Quantos meses do seu Custo de Vida formam a sua Reserva de Emergência?
                        </p>
                        <form id="profile-emergency-form" class="grid grid-cols-2 gap-5">
                             <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Meses (PF)</label>
                                <input type="number" min="1" max="24" name="emergency_fund_months_pf" value="${profile.emergency_fund_months_pf || 6}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all font-bold tracking-widest text-center" required>
                                <span class="absolute inset-y-0 right-4 flex items-center text-xs text-brand-text-secondary font-bold select-none pointer-events-none">meses</span>
                            </div>
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Meses (PJ)</label>
                                <input type="number" min="1" max="24" name="emergency_fund_months_pj" value="${profile.emergency_fund_months_pj || 12}" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all font-bold tracking-widest text-center" required>
                                <span class="absolute inset-y-0 right-4 flex items-center text-xs text-brand-text-secondary font-bold select-none pointer-events-none">meses</span>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Action Button -->
                <button onclick="SettingsModule.saveProfile()" class="w-full bg-brand-gold text-brand-darker font-black py-5 rounded-2xl shadow-lg shadow-brand-gold/30 hover:shadow-brand-gold/50 hover:scale-[1.01] active:scale-[0.98] transition-all uppercase tracking-widest text-sm relative overflow-hidden group">
                    <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span class="relative z-10">Salvar Parâmetros</span>
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
                    const amountInCents = CurrencyMask.unmask(fd.get('amount')); // Returns integer cents directly

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
                        if (key === 'pro_labore_amount') {
                            updates[key] = CurrencyMask.unmaskToFloat(val); // float Reais
                        } else {
                            updates[key] = parseFloat(val);
                        }
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
            <div class="space-y-8 flex-1 pb-10 animate-fade-in relative z-0">
                <!-- Add Form -->
                <div class="bg-brand-surface border border-brand-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-colors group-hover:bg-blue-500/10"></div>
                    <div class="relative z-10">
                        <h3 class="text-lg font-black text-brand-text-primary mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                            Nova Recorrência
                        </h3>
                        <p class="text-xs text-brand-text-secondary mb-6">Cadastre assinaturas, mensalidades e receitas previsíveis.</p>
                        
                        <form id="add-recurring-form" class="space-y-5">
                            <div class="relative">
                                <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Descrição</label>
                                <input type="text" name="description" placeholder="Ex: Netflix, Conta de Luz" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all placeholder:text-brand-text-secondary/30 font-bold" required>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-5">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Valor (R$)</label>
                                    <input type="text" name="amount" data-currency="true" placeholder="R$ 0,00" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all font-bold tracking-widest text-right" required>
                                </div>
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Dia do Mês</label>
                                    <input type="number" min="1" max="31" name="day_of_month" placeholder="1-31" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all font-bold tracking-widest text-center" required>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-5">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Tipo</label>
                                    <select name="type" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                        <option value="expense">🔴 Despesa</option>
                                        <option value="income">🟢 Receita</option>
                                    </select>
                                </div>
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-bold text-brand-text-secondary z-10">Contexto</label>
                                    <select name="context" class="w-full bg-brand-bg rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                        <option value="personal">👤 Pessoal (PF)</option>
                                        <option value="business">💼 Empresa (PJ)</option>
                                    </select>
                                </div>
                            </div>

                            <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all uppercase tracking-widest text-sm relative overflow-hidden group mt-2">
                                + Adicionar Recorrência
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Lists -->
                <div class="space-y-8 relative z-10">
                    <!-- PJ List -->
                    ${pjItems.length > 0 ? `
                        <div>
                            <h3 class="text-xs font-black text-brand-text-secondary uppercase tracking-widest mb-4 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-brand-border/50">
                                    <span class="text-white text-sm">💼</span>
                                </div>
                                Empresa (PJ) <span class="text-[10px] bg-brand-surface-light px-2 py-0.5 rounded-full font-medium ml-1">${pjItems.length}</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                ${pjItems.map(item => this.renderRecurringItem(item)).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- PF List -->
                    ${pfItems.length > 0 ? `
                        <div>
                            <h3 class="text-xs font-black text-brand-text-secondary uppercase tracking-widest mb-4 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-brand-border/50">
                                    <span class="text-white text-sm">👤</span>
                                </div>
                                Pessoal (PF) <span class="text-[10px] bg-brand-surface-light px-2 py-0.5 rounded-full font-medium ml-1">${pfItems.length}</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                ${pfItems.map(item => this.renderRecurringItem(item)).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${list.length === 0 ? `
                        <div class="text-center py-16 bg-brand-surface-light/30 border border-brand-border/50 rounded-3xl border-dashed">
                            <div class="w-20 h-20 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                                <span class="text-3xl">📅</span>
                            </div>
                            <h3 class="text-brand-text-primary text-lg font-black mb-2">Nenhuma recorrência</h3>
                            <p class="text-brand-text-secondary text-sm max-w-xs mx-auto">Adicione assinaturas, aluguéis e outras despesas ou receitas fixas para automatizar seu fluxo de caixa.</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderRecurringItem(item) {
        const isExpense = item.type === 'expense';
        const typeIcon = isExpense ? '🔴' : '🟢';
        const amount = parseFloat(item.amount) / 100; // Convert from cents
        const amountFormatted = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return `
            <div class="group flex items-center justify-between p-4 bg-brand-surface-light/30 border border-brand-border/50 rounded-2xl hover:bg-brand-surface hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-brand-bg outline outline-1 outline-brand-border flex items-center justify-center text-lg shadow-inner relative overflow-hidden">
                        ${typeIcon}
                        <div class="absolute bottom-0 inset-x-0 h-1 ${isExpense ? 'bg-red-500/30' : 'bg-green-500/30'}"></div>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-0.5">
                            <p class="text-brand-text-primary font-bold text-sm truncate max-w-[150px] md:max-w-[200px]" title="${item.description}">${item.description}</p>
                            ${!item.active ? '<span class="text-[9px] bg-brand-border text-brand-text-secondary px-2 py-0.5 rounded-full font-bold tracking-wider">INATIVA</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2 text-[10px]">
                            <span class="bg-brand-surface px-1.5 py-0.5 rounded border border-brand-border/50 text-brand-text-secondary font-bold font-mono">D${item.day_of_month.toString().padStart(2, '0')}</span>
                            <span class="${isExpense ? 'text-red-400' : 'text-green-400'} font-bold tracking-widest text-xs">R$ ${amountFormatted}</span>
                        </div>
                    </div>
                </div>
                <button class="opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-all" onclick="SettingsModule.deleteRecurring('${item.id}')" title="Excluir">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
            overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
            overlay.id = 'confirm-modal-overlay';
            overlay.style.zIndex = '9999';

            overlay.innerHTML = `
                <div class="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"></div>
                <div class="relative w-full max-w-sm bg-brand-surface md:border md:border-brand-border/60 rounded-[2rem] shadow-2xl animate-scale-in overflow-hidden flex flex-col mx-4 origin-bottom md:origin-center">
                    
                    <!-- Decorative line -->
                    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                    
                    <!-- Header -->
                    <div class="p-6 pb-4 border-b border-brand-border/50 shrink-0 text-center relative z-10">
                        <div class="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span class="text-red-500 text-2xl">⚠️</span>
                        </div>
                        <h3 class="text-xl font-black text-brand-text-primary tracking-tight">${title}</h3>
                    </div>

                    <!-- Body -->
                    <div class="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar text-center relative z-10">
                        <p class="text-sm text-brand-text-secondary whitespace-pre-line leading-relaxed font-bold">${message}</p>
                    </div>

                    <!-- Footer -->
                    <div class="p-5 border-t border-brand-border/50 bg-brand-bg/50 shrink-0 flex gap-3 relative z-10">
                        <button id="confirm-modal-cancel" class="flex-1 py-3.5 px-4 rounded-xl bg-brand-surface border border-brand-border/50 text-brand-text-primary font-black text-xs uppercase tracking-widest hover:bg-brand-surface-light transition-all active:scale-95">
                            Cancelar
                        </button>
                        <button id="confirm-modal-confirm" class="flex-1 py-3.5 px-4 rounded-xl bg-red-500 text-white font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/25 active:scale-95">
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

            // Handle overlay click to cancel
            overlay.querySelector('.bg-brand-bg\\/90').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
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
            { id: 'dashboard', icon: '📊', label: 'Dashboard', canHide: false, desc: 'Visão geral das finanças' },
            { id: 'wallet', icon: '💰', label: 'Carteira', canHide: true, desc: 'Gestão de contas e cartões' },
            { id: 'goals', icon: '🎯', label: 'Metas', canHide: true, desc: 'Acompanhamento de objetivos' },
            { id: 'investments', icon: '📈', label: 'Investimentos', canHide: true, desc: 'Carteira de ativos e aportes' },
            { id: 'settings', icon: '⚙️', label: 'Configurações', canHide: false, desc: 'Ajustes do sistema' }
        ];

        return allTabs.map(tab => {
            const isHidden = hiddenTabs.includes(tab.id);
            const isChecked = !isHidden; // Checkbox is for "visible", not "hidden"

            return `
                <div class="flex items-center justify-between p-4 bg-brand-surface-light/30 border border-brand-border/50 rounded-2xl hover:bg-brand-surface transition-all ${!tab.canHide ? 'opacity-70' : 'cursor-pointer'}" ${tab.canHide ? `onclick="const cb = this.querySelector('input[type=checkbox]'); cb.click();"` : ''}>
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-brand-bg flex items-center justify-center text-xl shadow-inner border border-brand-border/30">
                            ${tab.icon}
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-0.5">
                                <p class="text-sm font-bold text-brand-text-primary tracking-wide">${tab.label}</p>
                                ${!tab.canHide ? '<span class="text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-bold tracking-widest uppercase">Fixa</span>' : ''}
                            </div>
                            <p class="text-[10px] text-brand-text-secondary">${tab.desc}</p>
                        </div>
                    </div>
                    <label class="relative inline-flex items-center ${tab.canHide ? 'cursor-pointer' : 'cursor-not-allowed hidden'}" onclick="event.stopPropagation()">
                        <input 
                            type="checkbox" 
                            class="toggle-tab sr-only peer" 
                            data-tab="${tab.id}" 
                            ${isChecked ? 'checked' : ''}
                            ${!tab.canHide ? 'disabled' : ''}
                        >
                        <div class="w-14 h-7 bg-brand-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-gold/50 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-gold shadow-inner"></div>
                    </label>
                    ${!tab.canHide ? `
                        <div class="text-brand-gold opacity-50 pr-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        </div>
                    ` : ''}
                </div>
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



