import { InvestmentsService } from '../services/investments.service.js';
import { AnalysisService } from '../services/analysis.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { supabase } from '../services/supabase.service.js';

export const InvestmentsModule = {
    activeTab: 'resumo', // 'resumo', 'fixed', 'variable', 'crypto'
    userProfile: null,
    avgCostOfLiving: 0,
    listFilter: null, // 'stock', 'fii', 'crypto', 'fixed' - For ARCA interaction

    async render() {
        const container = document.getElementById('main-content');
        this.activeTab = this.activeTab || 'resumo';
        this.listFilter = null; // Reset filter on full render

        await InvestmentsService.init();
        await TransactionService.init();
        await this.fetchUserData();

        this.renderView(container);
        window.app.openAnalysisModal = this.openAnalysisModal.bind(this);
    },

    async fetchUserData() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('birth_date,monthly_income')
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
        const investments = InvestmentsService.investments;
        const totalEquity = InvestmentsService.calculateTotalEquity();
        const totalInvested = InvestmentsService.calculateTotalInvested();
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
            displayEquity = filteredInvestments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
            const displayInvested = filteredInvestments.reduce((acc, curr) => acc + (curr.quantity * curr.average_price), 0);
            displayProfit = displayEquity - displayInvested;
            displayProfitPercent = displayInvested > 0 ? (displayProfit / displayInvested) * 100 : 0;
        }

        const containerHTML = `
            <div class="h-full flex flex-col bg-brand-bg relative pb-24">
                <!-- Header -->
                <header class="pt-8 pb-4 px-4 bg-brand-bg/95 backdrop-blur-md sticky top-0 z-20 safe-area-top border-b border-white/5">
                    <h1 class="text-2xl font-bold text-white tracking-tight mb-4">Investimentos</h1>
                    
                    <!-- Tabs -->
                    <div class="flex space-x-2 overflow-x-auto pb-2 mb-4 custom-scrollbar">
                        ${this.renderTabButton('resumo', 'Resumo')}
                        ${this.renderTabButton('variable', '🚀 Ações & FIIs')}
                        ${this.renderTabButton('fixed', 'Renda Fixa')}
                        ${this.renderTabButton('crypto', '🌐 Cripto & Outros')}
                    </div>

                    <!-- Summary Card -->
                    <div class="bg-gradient-to-br from-brand-surface to-brand-surface-light border border-white/10 rounded-3xl p-5 shadow-lg relative overflow-hidden transition-all duration-300">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-2xl -mr-16 -mt-16"></div>
                        
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">
                            ${(this.activeTab === 'resumo' && !this.listFilter) ? 'Patrimônio Total' : 'Saldo da Seleção'}
                        </p>
                        <h2 class="text-3xl font-black text-white mb-2">R$ ${displayEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                        
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold ${displayProfit >= 0 ? 'text-brand-green' : 'text-brand-red'} bg-black/20 px-2 py-1 rounded-lg border border-white/5">
                                ${displayProfitPercent >= 0 ? '+' : ''}${displayProfitPercent.toFixed(2)}%
                            </span>
                            <span class="text-xs text-gray-400">
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
                        <div class="bg-brand-surface/30 border border-white/5 rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <span class="bg-green-500/10 text-green-400 p-1 rounded-lg">🔋</span>
                                    GIF (Independência)
                                </h3>
                                <span class="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full font-bold">${gifPercent.toFixed(1)}%</span>
                            </div>
                            <div class="relative h-32 w-full flex justify-center items-center">
                                <canvas id="gif-gauge-chart" class="relative z-10"></canvas>
                                <div class="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
                                    <p class="text-2xl font-black text-white">${gifPercent.toFixed(1)}%</p>
                                </div>
                            </div>
                            <p class="text-[10px] text-gray-500 text-center mt-2">Custo de Vida: R$ ${this.avgCostOfLiving.toFixed(0)}</p>
                        </div>

                         <!-- MENAGERIE (PNIF + ARCA) -->
                        <div class="bg-brand-surface/30 border border-white/5 rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up delay-100 flex flex-col gap-4">
                            
                            <!-- PNIF -->
                            <div>
                                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🏁 Meta PNIF (Regra 4%)</h3>
                                <div class="flex justify-between items-end mb-1">
                                    <span class="text-lg font-bold text-white">R$ ${totalEquity.toLocaleString('pt-BR', { notation: 'compact' })}</span>
                                    <span class="text-xs text-gray-400">Meta: R$ ${pnif.target.toLocaleString('pt-BR', { notation: 'compact' })}</span>
                                </div>
                                <div class="w-full bg-black/20 rounded-full h-3 overflow-hidden">
                                    <div class="bg-gradient-to-r from-blue-500 to-green-400 h-full rounded-full transition-all duration-1000" style="width: ${Math.min(100, pnif.progress)}%"></div>
                                </div>
                            </div>

                            <!-- ARCA Methodology (Clickable) -->
                            <div class="pt-4 border-t border-white/5">
                                 <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">🔺 Metodologia ARCA (Toque para Filtrar)</h3>
                                 <div class="grid grid-cols-4 gap-2">
                                    <!-- Ações -->
                                    <div class="arca-box bg-blue-500/5 border ${this.listFilter === 'stock' ? 'border-blue-500 bg-blue-500/20' : 'border-blue-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-blue-500/10 transition" data-filter="stock">
                                        <span class="text-[10px] text-blue-400 font-bold">Ações</span>
                                        <span class="text-sm font-bold text-white">${arca.percentages.a.toFixed(0)}%</span>
                                        <div class="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
                                            <div class="h-full bg-blue-500" style="width: ${Math.min(100, (arca.percentages.a / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                    <!-- Real Estate -->
                                    <div class="arca-box bg-orange-500/5 border ${this.listFilter === 'fii' ? 'border-orange-500 bg-orange-500/20' : 'border-orange-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-orange-500/10 transition" data-filter="fii">
                                        <span class="text-[10px] text-orange-400 font-bold">FIIs</span>
                                        <span class="text-sm font-bold text-white">${arca.percentages.r.toFixed(0)}%</span>
                                         <div class="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
                                            <div class="h-full bg-orange-500" style="width: ${Math.min(100, (arca.percentages.r / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                    <!-- Caixa -->
                                    <div class="arca-box bg-green-500/5 border ${this.listFilter === 'fixed' ? 'border-green-500 bg-green-500/20' : 'border-green-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-green-500/10 transition" data-filter="fixed">
                                        <span class="text-[10px] text-green-400 font-bold">Caixa</span>
                                        <span class="text-sm font-bold text-white">${arca.percentages.c.toFixed(0)}%</span>
                                         <div class="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
                                            <div class="h-full bg-green-500" style="width: ${Math.min(100, (arca.percentages.c / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                    <!-- Antifrágeis -->
                                    <div class="arca-box bg-purple-500/5 border ${this.listFilter === 'crypto' ? 'border-purple-500 bg-purple-500/20' : 'border-purple-500/20'} rounded-xl p-2 text-center flex flex-col items-center justify-between h-20 cursor-pointer hover:bg-purple-500/10 transition" data-filter="crypto">
                                        <span class="text-[10px] text-purple-400 font-bold">Antifrág.</span>
                                        <span class="text-sm font-bold text-white">${arca.percentages.alt.toFixed(0)}%</span>
                                         <div class="w-full h-1 bg-gray-700/50 rounded-full overflow-hidden">
                                            <div class="h-full bg-purple-500" style="width: ${Math.min(100, (arca.percentages.alt / 25) * 100)}%"></div>
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        </div>

                        <!-- Evolution Chart -->
                         <div class="bg-brand-surface/30 border border-white/5 rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up md:col-span-2">
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
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
                    ${this.activeTab === 'variable' ? `<div class="bg-brand-surface/30 border border-white/5 rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up"><h3 class="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">📊 Exposição por Setor</h3><div class="relative h-48 w-full"><canvas id="sector-chart"></canvas></div></div>` : ''}
                    ${this.activeTab === 'fixed' ? `<div class="bg-brand-surface/30 border border-white/5 rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up"><h3 class="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">📈 Rentabilidade (%)</h3><div class="relative h-48 w-full"><canvas id="fixed-yield-chart"></canvas></div></div>` : ''}

                    <!-- Asset Lists (Filtered) -->
                    ${this.listFilter ? `<h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest pl-2 mb-2 animate-fade-in">Filtrado por: ${this.getFilterName(this.listFilter)}</h3>` : ''}
                    
                    ${Object.keys(grouped).length > 0 ? Object.keys(grouped).map(type => this.renderAssetGroup(type, grouped[type])).join('') :
                '<div class="text-center text-gray-500 mt-10"><p>Nenhum ativo encontrado.</p></div>'}
                </div>

                <!-- FAB -->
                <button id="fab-add-asset" class="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 active:scale-95 transition z-20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
            ${this.renderModal()}
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

        if (fab) fab.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

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
                const formData = new FormData(form);
                const assetData = Object.fromEntries(formData.entries());
                const id = assetData.id;
                delete assetData.id;

                const numericFields = ['quantity', 'average_price', 'current_price', 'rate', 'dividend_yield', 'p_vp'];
                numericFields.forEach(field => {
                    if (assetData[field] === '' || assetData[field] === undefined) {
                        assetData[field] = null;
                    } else {
                        assetData[field] = parseFloat(assetData[field]);
                    }
                });

                if (assetData.type === 'crypto' && assetData.crypto_issuer) {
                    assetData.issuer = assetData.crypto_issuer;
                }
                delete assetData.crypto_issuer;

                // Cleanup irrelevant fields
                if (!['fixed_income', 'treasure', 'crypto'].includes(assetData.type)) assetData.issuer = null;
                if (!['fixed_income', 'treasure'].includes(assetData.type)) {
                    assetData.indexer = null; assetData.rate = null; assetData.maturity_date = assetData.maturity_date || null;
                }
                if (!['stock', 'fii'].includes(assetData.type)) {
                    assetData.sector = null; assetData.dividend_yield = null; assetData.p_vp = null;
                }
                if (!assetData.current_price) assetData.current_price = 0;

                try {
                    if (id) await InvestmentsService.update(id, assetData);
                    else await InvestmentsService.create(assetData);
                    closeModal();
                    this.render();
                } catch (error) {
                    console.error(error);
                    alert('Erro ao salvar: ' + error.message);
                }
            };
        }

        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                const id = document.getElementById('asset-id').value;
                if (confirm('Tem certeza que deseja excluir este ativo?')) {
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
            inputs['average_price'].value = asset.average_price;
            inputs['current_price'].value = asset.current_price;

            if (inputs['issuer']) inputs['issuer'].value = asset.issuer || '';
            const cryptoIssuerInput = inputs['crypto_issuer'];
            if (cryptoIssuerInput) cryptoIssuerInput.value = asset.type === 'crypto' ? (asset.issuer || '') : '';

            if (inputs['indexer']) inputs['indexer'].value = asset.indexer || 'CDI';
            if (inputs['rate']) inputs['rate'].value = asset.rate || '';
            if (inputs['maturity_date']) inputs['maturity_date'].value = asset.maturity_date || '';

            if (inputs['sector']) inputs['sector'].value = asset.sector || '';
            if (inputs['dividend_yield']) inputs['dividend_yield'].value = asset.dividend_yield || '';
            if (inputs['p_vp']) inputs['p_vp'].value = asset.p_vp || '';

            if (deleteBtn) deleteBtn.classList.remove('hidden');
            if (modal) modal.classList.remove('hidden');

            if (typeSelect) {
                typeSelect.value = asset.type;
                typeSelect.dispatchEvent(new Event('change'));
            }
        };
    },

    // --- Helper for rendering (needed as these were local before) ---
    renderAssetGroup(type, assets) {
        return `
            <div class="mb-6 animate-fade-in-up">
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pl-2">${this.getTypeName(type)}</h3>
                <div class="bg-black/20 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden shadow-lg">
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
        const classes = isActive ? 'bg-white text-brand-bg font-bold shadow-md' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10';
        return `<button class="px-4 py-2 rounded-full text-xs transition-all whitespace-nowrap investment-tab ${classes}" data-tab="${id}">${label}</button>`;
    },

    renderAssetItem(asset, index, total) {
        const totalValue = asset.quantity * asset.current_price;
        const investedValue = asset.quantity * asset.average_price;
        const gain = totalValue - investedValue;
        const gainPercent = investedValue > 0 ? (gain / investedValue) * 100 : 0;
        const isPos = gain >= 0;

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
        if (isFI) iconBox = asset.type === 'treasure' ? '🏛️' : '🏦';
        if (isCrypto) iconBox = '₿';

        return `
           <div class="relative group touch-manipulation cursor-pointer hover:bg-white/5 transition-colors duration-200 p-4 ${index !== (total - 1) ? 'border-b border-white/5' : ''}" onclick="window.app.editAsset('${asset.id}')">
               <div class="flex items-center justify-between">
                   <div class="flex items-center gap-4">
                       <div class="w-10 h-10 rounded-xl bg-brand-surface border border-white/5 flex items-center justify-center shrink-0 text-white font-bold text-xs ${isFI ? 'text-lg' : ''}">${iconBox}</div>
                       <div>
                           <span class="text-white font-bold text-sm block truncate max-w-[150px]">${asset.name}</span>
                           <span class="text-[10px] text-gray-400 font-medium block">${subText}</span>
                           ${isFI && asset.maturity_date ? `<span class="text-[9px] text-brand-gold bg-brand-gold/10 px-1.5 py-0.5 rounded inline-block mt-1">📅 ${new Date(asset.maturity_date).toLocaleDateString()}</span>` : ''}
                           ${isVI && asset.p_vp ? `<span class="text-[9px] ${asset.p_vp < 1 ? 'text-green-400 bg-green-500/10' : 'text-orange-400 bg-orange-500/10'} px-1.5 py-0.5 rounded inline-block mt-1">P/VP ${asset.p_vp}</span>` : ''}
                           ${isCrypto ? `<span class="text-[9px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded inline-block mt-1">⚡ Volátil</span>` : ''}
                       </div>
                   </div>
                   <div class="text-right flex items-center gap-3">
                       <div>
                           <span class="text-white font-bold text-sm block">R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           <div class="flex flex-col items-end">
                                <span class="text-[10px] font-bold ${isPos ? 'text-brand-green' : 'text-brand-red'}">${isPos ? '+' : ''}${gainPercent.toFixed(1)}%</span>
                           </div>
                       </div>
                       <button onclick="event.stopPropagation(); window.app.openAnalysisModal('${asset.id}', '${asset.name}')" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-brand-gold transition-colors" title="Análise do Cerrado">
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
                closeModal();
                alert('Análise salva com sucesso!');
            } catch (err) { alert(err.message); }
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
            <div id="analysis-modal" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in">
                <div class="absolute inset-0 bg-brand-bg/95 backdrop-blur-md" id="close-analysis-overlay"></div>
                <div class="relative bg-brand-surface border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl p-6 w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                    
                    <div class="flex justify-between items-center mb-6 shrink-0">
                         <div>
                            <p class="text-[10px] text-brand-gold uppercase tracking-widest font-bold">Diagrama do Cerrado</p>
                            <h3 class="text-xl font-bold text-white">${name}</h3>
                         </div>
                         <button class="bg-white/5 rounded-full p-2 text-gray-400 hover:text-white transition" id="close-analysis-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                        <!-- Chart Area -->
                        <div class="h-64 relative bg-black/20 rounded-2xl p-2 border border-white/5">
                            <canvas id="analysis-radar-chart"></canvas>
                        </div>

                        <!-- Form Area -->
                        <form id="analysis-form" class="space-y-5 pb-4">
                            ${criteria.map(c => `
                                <div>
                                    <div class="flex justify-between items-center mb-2">
                                        <div>
                                            <label class="block text-xs font-bold text-white">${c.label}</label>
                                            <p class="text-[9px] text-gray-400">${c.desc}</p>
                                        </div>
                                        <div class="value-bubble w-6 h-6 rounded-full bg-brand-gold text-brand-darker font-bold text-[10px] flex items-center justify-center">0</div>
                                    </div>
                                    <input type="range" name="${c.id}" min="0" max="5" value="0" step="1" class="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-gold">
                                    <div class="flex justify-between text-[8px] text-gray-500 font-bold uppercase mt-1">
                                        <span>Ruim</span>
                                        <span>Excelente</span>
                                    </div>
                                </div>
                            `).join('')}
                            
                            <button type="submit" class="w-full bg-brand-gold text-brand-darker font-bold py-3 rounded-xl shadow-lg shadow-brand-gold/20 sticky bottom-0">
                                Salvar Análise
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    renderModal() {
        return `
            <div id="asset-modal" class="fixed inset-0 z-50 hidden">
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity duration-300" id="close-asset-overlay"></div>
                <div class="absolute bottom-0 w-full bg-brand-surface border-t border-white/10 rounded-t-[2.5rem] p-6 pb-8 animate-slide-up shadow-2xl h-[85vh] flex flex-col">
                    <div class="w-12 h-1 bg-gray-700/50 rounded-full mx-auto mb-6 shrink-0"></div>
                    
                    <div class="flex justify-between items-center mb-4 shrink-0">
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                             📈 Novo Ativo
                        </h3>
                        <button class="bg-white/5 rounded-full p-2 text-gray-400 hover:text-white transition" id="close-asset-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <form id="asset-form" class="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1">
                        <input type="hidden" name="id" id="asset-id">
                        
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tipo de Ativo</label>
                            <select name="type" id="asset-type-select" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white appearance-none font-bold">
                                <option value="stock">Ação</option>
                                <option value="fii">Fundo Imobiliário (FII)</option>
                                <option value="fixed_income">Renda Fixa (CDB/LCI/LCA)</option>
                                <option value="treasure">Tesouro Direto</option>
                                <option value="crypto">Criptomoeda</option>
                            </select>
                        </div>

                        <!-- Common Fields -->
                        <div id="ticker-field">
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ticker / Símbolo</label>
                            <input type="text" name="ticker" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white uppercase placeholder-gray-600 font-bold" placeholder="EX: BTC, ETH">
                        </div>
                        
                        <div id="name-field">
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nome do Ativo</label>
                            <input type="text" name="name" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="Bitcoin">
                        </div>

                        <!-- Fixed Income Specifics -->
                        <div id="fixed-income-fields" class="hidden space-y-4 border-l-2 border-brand-gold/30 pl-4 my-2">
                             <div>
                                <label class="block text-xs font-bold text-brand-gold uppercase tracking-widest mb-2">Emissor</label>
                                <input type="text" name="issuer" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="Ex: Banco Inter, Tesouro Nacional">
                            </div>

                             <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-brand-gold uppercase tracking-widest mb-2">Indexador</label>
                                    <select name="indexer" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white appearance-none">
                                        <option value="CDI">CDI</option>
                                        <option value="IPCA">IPCA</option>
                                        <option value="PRE">Pré-fixado</option>
                                        <option value="SELIC">Selic</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-brand-gold uppercase tracking-widest mb-2">Taxa (%)</label>
                                    <input type="number" step="0.01" name="rate" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="Ex: 100">
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-xs font-bold text-brand-gold uppercase tracking-widest mb-2">Vencimento</label>
                                <input type="date" name="maturity_date" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white [color-scheme:dark]">
                            </div>
                        </div>

                        <!-- Variable Income Specifics -->
                        <div id="variable-income-fields" class="hidden space-y-4 border-l-2 border-blue-500/30 pl-4 my-2">
                             <div>
                                <label class="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Setor</label>
                                <input type="text" name="sector" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="Ex: Bancário, Energia">
                            </div>

                             <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Dividend Yield (%)</label>
                                    <input type="number" step="0.01" name="dividend_yield" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="Ex: 8.5">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">P/VP</label>
                                    <input type="number" step="0.01" name="p_vp" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="Ex: 1.05">
                                </div>
                            </div>
                        </div>

                         <!-- Crypto Specifics -->
                        <div id="crypto-fields" class="hidden space-y-4 border-l-2 border-purple-500/30 pl-4 my-2">
                             <div>
                                <label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Exchange / Wallet (Custódia)</label>
                                <input type="text" name="crypto_issuer" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="Ex: Binance, Ledger">
                            </div>
                        </div>

                        <!-- Values -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-green-500 uppercase tracking-widest mb-2">Quantidade</label>
                                <input type="number" step="any" name="quantity" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="0">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">Preço Médio</label>
                                <input type="number" step="any" name="average_price" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="0.00">
                            </div>
                        </div>

                        <div>
                             <label class="block text-xs font-bold text-white uppercase tracking-widest mb-2">Cotação Atual (R$)</label>
                             <input type="number" step="any" name="current_price" class="w-full bg-brand-bg/50 rounded-xl border border-white/5 p-3 text-white placeholder-gray-600" placeholder="0.00">
                             <p class="text-[10px] text-gray-500 mt-1">Atualize manualmente.</p>
                        </div>

                        <button type="submit" class="w-full bg-gradient-to-r from-brand-gold to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-brand-darker font-bold py-4 rounded-2xl transition mt-4 shadow-lg shadow-brand-gold/10">
                            Salvar Ativo
                        </button>
                         <button type="button" id="btn-delete-asset" class="hidden w-full bg-red-500/10 text-red-500 font-bold py-3 rounded-2xl transition mt-2 hover:bg-red-500/20">
                            Excluir Ativo
                        </button>
                    </form>
                </div>
            </div>
        `;
    }
};
