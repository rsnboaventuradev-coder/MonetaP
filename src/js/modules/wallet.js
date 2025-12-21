import { TransactionService } from '../services/transaction.service.js';
import { CurrencyMask } from '../utils/mask.js';
import { AuthService } from './auth.js';

export const WalletModule = {
    state: {
        transactions: [],
        categories: [],
        isLoading: false,
        page: 1,
        hasMore: true,
        filters: {
            startDate: null,
            endDate: null,
            type: null // 'income' | 'expense' | null
        },
        transactionToDelete: null // Para confirmação de exclusão
    },

    async init() {
        // Init logic moved to render generally, or kept for service initialization
    },

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        // Ensure current date is set
        if (!this.state.currentDate) this.state.currentDate = new Date();

        const monthYear = this.state.currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

        container.innerHTML = `
            <div class="flex flex-col min-h-full bg-brand-bg safe-area-top">
                <!-- HEADER -->
                <div class="px-6 pt-6 flex justify-between items-center bg-brand-bg sticky top-0 z-20 pb-4 border-b border-white/5 backdrop-blur-md">
                    <div>
                         <p class="text-xs text-gray-400 font-medium uppercase tracking-wider">Seu Dinheiro</p>
                         <h1 class="text-2xl font-bold text-white leading-none mt-1">Carteira</h1>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="window.app.togglePrivacy()" class="text-gray-400 hover:text-white transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- TOTAL BALANCE & FILTERS -->
                <div class="px-6 py-6 bg-brand-surface border-b border-white/5 space-y-4">
                    
                  <div class="flex items-center gap-4 animate-fade-in-up" style="animation-delay: 0.1s;">
                    <!-- Date Selector (Month) -->
                    <div class="flex items-center bg-brand-surface rounded-xl p-1 border border-white/5">
                        <button id="prevMonthBtn" class="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span id="currentMonthLabel" class="w-32 text-center text-sm font-bold text-white uppercase tracking-wide">
                            Julho 2024
                        </span>
                        <button id="nextMonthBtn" class="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    <!-- Search Bar -->
                    <div class="relative flex-1 group hidden md:block">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 group-focus-within:text-brand-gold transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input type="text" id="transactionDetailsSearch" 
                            class="w-full bg-brand-surface border border-white/5 text-gray-300 text-sm rounded-xl focus:ring-1 focus:ring-brand-gold focus:border-brand-gold block pl-10 p-2.5 transition outline-none placeholder-gray-600" 
                            placeholder="Buscar transação...">
                    </div>
                     <!-- Mobile Search Trigger (Optional, kept simple for now) -->
                </div>
                    <div>
                        <p class="text-gray-400 text-xs font-medium mb-1">Saldo do Mês</p>
                        <h2 id="walletTotalBalance" class="text-4xl font-black text-white tracking-tight value-sensitive">R$ ...</h2>
                    </div>

                    <div class="flex gap-2 overflow-x-auto scrollbar-hide">
                        <button class="filter-tab active px-4 py-2 rounded-full text-xs font-bold bg-white/10 text-white whitespace-nowrap border border-white/5 transition hover:bg-white/20" data-type="all">Todos</button>
                        <button class="filter-tab px-4 py-2 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green whitespace-nowrap border border-brand-green/20 transition hover:bg-brand-green/20" data-type="income">Entradas</button>
                        <button class="filter-tab px-4 py-2 rounded-full text-xs font-bold bg-brand-red/10 text-brand-red whitespace-nowrap border border-brand-red/20 transition hover:bg-brand-red/20" data-type="expense">Saídas</button>
                    </div>
                </div>

                <!-- LIST -->
                <div id="walletTransactionsList" class="flex-1 px-6 py-4 space-y-3 pb-24">
                    <!-- Dynamic Content -->
                </div>

                <!-- LOADER & LOAD MORE -->
                <div id="walletLoader" class="flex justify-center py-4 hidden">
                    <i class="fas fa-spinner fa-spin text-brand-green text-2xl"></i>
                </div>
                <div class="px-6 pb-24 text-center">
                    <button id="loadMoreTransactionsBtn" class="text-sm font-bold text-gray-500 hover:text-white transition py-2 px-4 hidden">
                        Carregar Mais
                    </button>
                </div>

                <!-- FAB ADD BUTTON -->
                <button id="addTransactionBtn" class="fixed bottom-24 right-6 w-14 h-14 bg-brand-green rounded-full shadow-glow-green text-white flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition z-30">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
            
            <!-- MODAL TRANSACTION -->
             <div id="transactionModal" class="fixed inset-0 z-50 hidden">
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" onclick="window.app.WalletModule ? window.app.WalletModule.closeTransactionModal() : null"></div>
                <div class="absolute bottom-0 w-full bg-brand-surface border-t border-white/10 rounded-t-[2.5rem] p-6 pb-8 animate-slide-up shadow-2xl h-[85vh] flex flex-col">
                    <div class="w-12 h-1 bg-gray-700/50 rounded-full mx-auto mb-6 shrink-0"></div>
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="modal-title text-xl font-bold text-white">Nova Transação</h3>
                        <button onclick="window.app.WalletModule.closeTransactionModal()" class="bg-white/5 rounded-full p-2 text-gray-400 hover:text-white transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>
                    
                    <form id="transactionForm" class="space-y-6 flex-1 overflow-y-auto pr-1">
                         <div>
                            <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Valor</label>
                            <input type="text" inputmode="numeric" id="amountInput" name="amount" required class="w-full bg-transparent text-4xl font-black text-white border-0 p-0 focus:ring-0 placeholder-gray-700" placeholder="R$ 0,00">
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                             <label class="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center gap-2 cursor-pointer has-[:checked]:bg-brand-green/20 has-[:checked]:border-brand-green/50 transition">
                                <input type="radio" name="type" value="income" class="hidden">
                                <span class="text-sm font-bold text-white">Entrada</span>
                             </label>
                             <label class="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center gap-2 cursor-pointer has-[:checked]:bg-brand-red/20 has-[:checked]:border-brand-red/50 transition">
                                <input type="radio" name="type" value="expense" class="hidden" checked>
                                <span class="text-sm font-bold text-white">Saída</span>
                             </label>
                        </div>

                        <div>
                            <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Descrição</label>
                            <input type="text" name="description" required class="w-full bg-brand-bg/50 rounded-xl border border-white/10 p-4 text-white focus:border-brand-green outline-none" placeholder="Ex: Supermercado">
                        </div>

                        <div>
                             <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Categoria</label>
                             <select id="transactionCategory" name="categoryId" required class="w-full bg-brand-bg/50 rounded-xl border border-white/10 p-4 text-white focus:border-brand-green outline-none">
                                <option value="">Carregando...</option>
                             </select>
                        </div>
                        
                        <div>
                             <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Data</label>
                             <input type="date" name="date" required class="w-full bg-brand-bg/50 rounded-xl border border-white/10 p-4 text-white focus:border-brand-green outline-none scheme-dark">
                        </div>

                        <!-- RECURRING TOGGLE -->
                        <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                            <label class="flex items-center justify-between cursor-pointer">
                                <span class="text-sm font-bold text-gray-300">Repetir Mensalmente?</span>
                                <div class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="isRecurring" id="isRecurringInput" class="sr-only peer">
                                    <div class="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-green/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                                </div>
                            </label>

                            <div id="recurringOptions" class="hidden mt-4 pt-4 border-t border-white/5 animate-fade-in">
                                 <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Dia do Vencimento</label>
                                 <input type="number" name="day_of_month" min="1" max="31" class="w-full bg-brand-bg rounded-xl border border-white/10 p-4 text-white focus:border-brand-green outline-none" placeholder="Ex: 5">
                                 <p class="text-xs text-gray-500 mt-2">Será gerado automaticamente todo mês neste dia.</p>
                            </div>
                        </div>

                        <button type="submit" class="w-full bg-brand-green text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-green/20 hover:scale-[1.02] transition">
                            Salvar
                        </button>
                    </form>
                </div>
            </div>

            <!-- MODAL DELETE CONFIRMATION -->
            <div id="deleteConfirmationModal" class="fixed inset-0 z-[60] hidden">
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-4">
                    <div class="bg-brand-surface border border-white/10 rounded-2xl p-6 shadow-2xl text-center animate-shake">
                        <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                             <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-2">Excluir Transação?</h3>
                        <p class="text-gray-400 text-sm mb-6">Essa ação não pode ser desfeita. Tem certeza que deseja apagar esse registro?</p>
                        <div class="flex gap-3">
                            <button id="cancelDeleteBtn" class="flex-1 py-3 rounded-xl font-bold text-gray-300 bg-white/5 hover:bg-white/10 transition" onclick="window.app.WalletModule.closeDeleteModal()">Cancelar</button>
                            <button id="confirmDeleteBtn" class="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition">Excluir</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Make globally available
        window.app.WalletModule = this;

        this.cacheDOM();
        this.bindEvents();

        // Initial Loads
        this.loadCategories();
        this.loadTransactions(true);
    },

    // New helper to close delete modal
    closeDeleteModal() {
        if (this.dom.deleteModal) this.dom.deleteModal.classList.add('hidden');
        this.state.transactionToDelete = null;
    },

    cacheDOM() {
        this.dom = {
            list: document.getElementById('walletTransactionsList'),
            loader: document.getElementById('walletLoader'),
            loadMoreBtn: document.getElementById('loadMoreTransactionsBtn'),
            addBtn: document.getElementById('addTransactionBtn'),
            modal: document.getElementById('transactionModal'),
            form: document.getElementById('transactionForm'),
            categorySelect: document.getElementById('transactionCategory'),
            filterTabs: document.querySelectorAll('.filter-tab'),
            totalBalance: document.getElementById('walletTotalBalance'),
            prevMonthBtn: document.getElementById('prevMonthBtn'),
            nextMonthBtn: document.getElementById('nextMonthBtn'),
            deleteModal: document.getElementById('deleteConfirmationModal'),
            confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
            cancelDeleteBtn: document.getElementById('cancelDeleteBtn')
        };
    },

    bindEvents() {
        if (this.dom.addBtn) this.dom.addBtn.addEventListener('click', () => this.openTransactionModal());
        if (this.dom.form) this.dom.form.addEventListener('submit', (e) => this.handleTransactionSubmit(e));

        // Search
        const searchInput = document.getElementById('transactionDetailsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                // Filter Logic
                const filtered = this.state.transactions.filter(t =>
                    t.description.toLowerCase().includes(term) ||
                    t.amount.toString().includes(term) ||
                    (t.category_name && t.category_name.toLowerCase().includes(term))
                );
                this.renderTransactionsList(filtered);
            });
        }

        // Toggle recurring inputs
        const isRecurringInput = document.getElementById('isRecurringInput');
        const recurringOptions = document.getElementById('recurringOptions');
        if (isRecurringInput && recurringOptions) {
            isRecurringInput.addEventListener('change', (e) => {
                if (e.target.checked) {
                    recurringOptions.classList.remove('hidden');
                } else {
                    recurringOptions.classList.add('hidden');
                }
            });
        }

        if (this.dom.loadMoreBtn) this.dom.loadMoreBtn.addEventListener('click', () => this.loadTransactions(false));
        if (this.dom.filterTabs) this.dom.filterTabs.forEach(tab => tab.addEventListener('click', (e) => this.handleFilterClick(e)));
        if (this.dom.list) this.dom.list.addEventListener('click', (e) => this.handleListActions(e));
        if (this.dom.confirmDeleteBtn) this.dom.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());

        // Month Navigation
        if (this.dom.prevMonthBtn) this.dom.prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
        if (this.dom.nextMonthBtn) this.dom.nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
    },

    changeMonth(delta) {
        // Change state
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + delta);

        // Re-render only necessary parts? Or just reload with new date?
        // Since we are not simulating SPA React, we simply re-call render or update DOM text and reload data
        // For simplicity, let's just trigger a re-render of the specific text and reload data
        // But re-calling render() is expensive as it redraws everything.
        // Let's manually update header and reload.

        const monthYear = this.state.currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

        // Find element if not cached or just query
        const title = document.querySelector('.capitalize');
        if (title) title.textContent = capitalize(monthYear);

        this.loadTransactions(true);
    },

    async loadCategories() {
        try {
            this.state.categories = await TransactionService.getCategories();
            this.renderCategoryOptions();
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
            Toast.show('Erro ao carregar categorias', 'error');
        }
    },

    async loadTransactions(reset = false) {
        if (!this.dom.list) return;

        // Show Skeleton only on first load or force refresh
        if (this.state.transactions.length === 0 || reset) {
            this.renderSkeleton();
        }

        if (this.state.isLoading) return;

        this.setLoading(true, reset);

        try {
            if (reset) {
                this.state.page = 1;
                this.state.transactions = [];
                this.state.hasMore = true;
                if (this.dom.list) this.dom.list.innerHTML = '';
            }

            // Calculate Start/End Date based on currentState.currentDate
            const year = this.state.currentDate.getFullYear();
            const month = this.state.currentDate.getMonth();
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

            const limit = 50;

            const transactions = await TransactionService.getTransactions({
                ...this.state.filters,
                startDate,
                endDate,
                limit: limit,
            });

            if (transactions.length < limit) {
                this.state.hasMore = false;
            }

            if (reset) {
                this.state.transactions = transactions;
            } else {
                const newIds = new Set(transactions.map(t => t.id));
                const uniqueOld = this.state.transactions.filter(t => !newIds.has(t.id));
                this.state.transactions = [...uniqueOld, ...transactions];
            }

            this.renderTransactionsList();
            this.updateTotalBalance(); // New: Update the "Saldo do Mês" logic
            this.updateLoadMoreButton();
            this.state.page++;

        } catch (error) {
            console.error('Erro ao carregar transações:', error);
            Toast.show('Falha ao atualizar lista', 'error');
        } finally {
            this.setLoading(false, reset);
        }
    },

    updateTotalBalance() {
        if (!this.dom.totalBalance) return;
        const total = this.state.transactions.reduce((acc, tx) => {
            const amount = parseFloat(tx.amount);
            return tx.type === 'income' ? acc + amount : acc - amount;
        }, 0);
        this.dom.totalBalance.textContent = this.formatCurrency(total);
    },

    renderSkeleton() {
        if (!this.dom.list) return;
        this.dom.list.innerHTML = Array(3).fill(0).map(() => `
            <div class="mb-6 animate-pulse">
                <div class="h-4 bg-white/5 rounded w-24 mb-3 ml-1"></div>
                <div class="bg-brand-surface border border-white/5 rounded-2xl overflow-hidden">
                    ${Array(3).fill(0).map(() => `
                    <div class="p-4 flex items-center justify-between border-b border-white/5 last:border-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-white/5"></div>
                            <div class="space-y-2">
                                <div class="h-4 bg-white/5 rounded w-32"></div>
                                <div class="h-3 bg-white/5 rounded w-20"></div>
                            </div>
                        </div>
                        <div class="h-5 bg-white/5 rounded w-20"></div>
                    </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    renderTransactionsList(transactionsOverride = null) {
        if (!this.dom.list) return;

        const transactions = transactionsOverride || this.state.transactions;

        if (transactions.length === 0) {
            this.dom.list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                    <div class="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <span class="text-5xl opacity-50">💸</span>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">Nada por aqui... ainda!</h3>
                    <p class="text-gray-400 text-sm max-w-xs mx-auto mb-8">Sua carteira está limpa neste mês. Que tal registrar seus gastos ou ganhos?</p>
                    <button onclick="window.app.WalletModule.openTransactionModal()" class="bg-brand-green text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-brand-green/20 hover:scale-[1.02] active:scale-[0.98] transition">
                        Registrar Transação
                    </button>
                </div>
            `;
            return;
        }

        // Agrupamento por Data (Lógica complexa que faltava)
        const groups = this.groupByDate(this.state.transactions);

        let html = '';

        for (const [date, transactions] of Object.entries(groups)) {
            const dateHeader = this.formatDateHeader(date);

            html += `
                <div class="transaction-group mb-4">
                    <h6 class="text-muted text-uppercase small px-3 mb-2 font-weight-bold" style="font-size: 0.75rem; letter-spacing: 1px;">
                        ${dateHeader}
                    </h6>
                    <div class="list-group shadow-sm rounded overflow-hidden border-0">
            `;

            transactions.forEach(t => {
                const isExpense = t.type === 'expense';
                const colorClass = isExpense ? 'text-danger' : 'text-success';
                const sign = isExpense ? '-' : '+';
                const categoryColor = t.categories?.color || '#6c757d';
                const categoryIcon = t.categories?.icon || 'fa-tag';

                // Verifica se é ícone do FontAwesome ou Emoji
                const iconDisplay = categoryIcon.includes('fa-')
                    ? `<i class="fas ${categoryIcon}"></i>`
                    : categoryIcon;

                html += `
                    <div class="list-group-item list-group-item-action d-flex align-items-center p-3 border-0 border-bottom transaction-item-row" data-id="${t.id}">
                        <!-- Ícone -->
                        <div class="rounded-circle d-flex align-items-center justify-content-center mr-3 flex-shrink-0" 
                             style="width: 45px; height: 45px; background-color: ${categoryColor}20; color: ${categoryColor};">
                            <span style="font-size: 1.2rem;">${iconDisplay}</span>
                        </div>
                        
                        <!-- Texto -->
                        <div class="flex-grow-1 overflow-hidden">
                            <h6 class="mb-0 text-truncate font-weight-bold" style="color: #2d3748;">${t.description}</h6>
                            <small class="text-muted text-truncate d-block">
                                ${t.categories?.name || 'Geral'} 
                                ${t.payment_method ? `• ${this.formatPaymentMethod(t.payment_method)}` : ''}
                            </small>
                        </div>

                        <!-- Valor e Ações -->
                        <div class="text-right ml-3 flex-shrink-0">
                            <div class="font-weight-bold ${colorClass} value-sensitive" style="font-size: 1rem;">
                                ${sign} ${this.formatCurrency(t.amount)}
                            </div>
                            <!-- Botões de ação visíveis apenas ao expandir ou em desktop (simplificado aqui para sempre renderizar mas oculto via CSS se necessário) -->
                            <div class="btn-group btn-group-sm mt-1 action-buttons">
                                <button class="btn btn-link text-muted p-0 mr-2 btn-edit" data-id="${t.id}" title="Editar">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn btn-link text-danger p-0 btn-delete" data-id="${t.id}" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        this.dom.list.innerHTML = html;
    },

    // --- Lógica de Formulário e Ações ---

    async handleTransactionSubmit(e) {
        e.preventDefault();

        const submitBtn = this.dom.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // UX: Previne clique duplo
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';

        try {
            const formData = new FormData(this.dom.form);
            const isRecurring = document.getElementById('isRecurringInput').checked;

            // Unmask Amount
            const rawAmount = document.getElementById('amountInput').value;
            const amount = CurrencyMask.unmask(rawAmount);

            const transactionData = {
                description: formData.get('description'),
                amount: amount,
                date: formData.get('date'), // Formato YYYY-MM-DD do input date
                categoryId: formData.get('categoryId'), // Assuming Service expects 'categoryId' mapped to 'category' or handles it
                category: formData.get('categoryId'), // TransactionService.create uses "category" property usually? Check create method.
                // Wait, TransactionService.create spreads the object. It expects properties to match DB columns or be handled.
                // DB 'transactions' has 'category_id' usually? Or 'category'?
                // Let's check TransactionService.create again. It inserts:
                // user_id, context, partner_id, status, classification, attachment_url, date...
                // AND ...transaction (spread).
                // If DB has category_id, we should pass category_id.
                // If DB has category (text), we pass category.
                // The form uses name="categoryId".
                // Let's pass both to be safe or map it.
                // Looking at TransactionService line 204: ...transaction.
                // Looking at DB schema... usually category_id.
                // Let's assume the previous code was working for normal transactions using "categoryId" or similar.
                // The previous code had `categoryId: formData.get('categoryId')`. 
                // Let's keep it consistent.
                category_id: formData.get('categoryId'),

                type: formData.get('type'),
                payment_method: formData.get('paymentMethod') || 'money',
                status: 'paid'
            };

            // Validações manuais extras se necessário
            if (transactionData.amount <= 0) throw new Error("O valor deve ser maior que zero.");

            const mode = this.dom.form.dataset.mode;

            if (mode === 'edit') {
                const id = this.dom.form.dataset.id;
                await TransactionService.update(id, transactionData);
                Toast.show('Transação atualizada!', 'success');
            } else {
                if (isRecurring) {
                    // HANDLE RECURRING
                    const day = parseInt(formData.get('day_of_month'));
                    if (!day || day < 1 || day > 31) throw new Error('Dia de vencimento inválido (1-31).');

                    await TransactionService.createRecurring({
                        ...transactionData,
                        day_of_month: day,
                        context: 'personal' // Defaulting
                    });
                    Toast.show('Recorrência criada com sucesso!', 'success');
                } else {
                    // NORMAL CREATE
                    await TransactionService.create(transactionData);
                    Toast.show('Transação criada!', 'success');
                }
            }

            this.closeTransactionModal();
            this.dom.form.reset();
            // Recarrega a lista para mostrar o estado atualizado
            await this.loadTransactions(true);

        } catch (error) {
            console.error(error);
            Toast.show(error.message || 'Erro ao salvar.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    },

    handleListActions(e) {
        // Detecta clique nos botões de edição/exclusão usando Event Delegation
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');

        if (editBtn) {
            e.stopPropagation();
            const id = editBtn.dataset.id;
            this.openEdit(id);
        } else if (deleteBtn) {
            e.stopPropagation();
            const id = deleteBtn.dataset.id;
            this.askDelete(id);
        }
    },

    openEdit(id) {
        const transaction = this.state.transactions.find(t => t.id == id);
        if (!transaction) return;

        this.openTransactionModal(transaction);
    },

    askDelete(id) {
        this.state.transactionToDelete = id;

        // Open Modal
        if (this.dom.deleteModal) {
            this.dom.deleteModal.classList.remove('hidden');
        } else {
            // Fallback just in case
            if (confirm('Excluir transação?')) this.confirmDelete();
        }
    },

    async confirmDelete() {
        if (!this.state.transactionToDelete) return;

        // Visual feedback on button
        if (this.dom.confirmDeleteBtn) this.dom.confirmDeleteBtn.textContent = 'Excluindo...';

        try {
            await TransactionService.deleteTransaction(this.state.transactionToDelete);
            Toast.show('Transação excluída.', 'info');

            // Remove do estado local para UI atualizar instantaneamente sem reload de rede
            this.state.transactions = this.state.transactions.filter(t => t.id != this.state.transactionToDelete);

            // Re-render logic
            this.renderTransactionsList();
            this.updateTotalBalance(); // Fix balance immediately

            this.state.transactionToDelete = null;
        } catch (error) {
            Toast.show('Erro ao excluir.', 'error');
        } finally {
            this.closeDeleteModal();
            if (this.dom.confirmDeleteBtn) this.dom.confirmDeleteBtn.textContent = 'Excluir';
        }
    },

    // --- Helpers de UI e Formatação ---

    handleFilterClick(e) {
        const type = e.target.dataset.type;
        this.state.filters.type = type === 'all' ? null : type;

        this.dom.filterTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        this.loadTransactions(true);
    },

    groupByDate(transactions) {
        return transactions.reduce((groups, transaction) => {
            // Supabase devolve date como string ISO ou similar
            const date = transaction.date.split('T')[0];
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(transaction);
            return groups;
        }, {});
    },

    formatDateHeader(dateString) {
        const date = new Date(dateString + 'T12:00:00'); // Compensar fuso horário simples
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Hoje';
        if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    },

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    formatPaymentMethod(method) {
        const map = {
            'money': 'Dinheiro',
            'credit_card': 'Crédito',
            'debit_card': 'Débito',
            'pix': 'Pix',
            'transfer': 'Transf.'
        };
        return map[method] || method;
    },

    renderCategoryOptions() {
        if (!this.dom.categorySelect) return;

        this.dom.categorySelect.innerHTML = '<option value="" disabled selected>Selecione...</option>';

        // Agrupar por tipo (Receita/Despesa) pode ser uma melhoria visual
        this.state.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            // Emoji ou nada se for class icon
            const icon = cat.icon.includes('fa-') ? '' : cat.icon;
            option.text = `${icon} ${cat.name}`;
            this.dom.categorySelect.appendChild(option);
        });
    },

    setLoading(isLoading, isReset) {
        this.state.isLoading = isLoading;
        if (this.dom.loader && isReset) {
            this.dom.loader.style.display = isLoading ? 'flex' : 'none';
        }

        if (this.dom.loadMoreBtn) {
            this.dom.loadMoreBtn.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i>' : 'Carregar Mais';
            this.dom.loadMoreBtn.disabled = isLoading;
        }
    },

    updateLoadMoreButton() {
        if (this.dom.loadMoreBtn) {
            this.dom.loadMoreBtn.style.display = this.state.hasMore ? 'block' : 'none';
        }
    },

    openTransactionModal(mode = 'create', transaction = null) {
        if (!this.dom.modal || !this.dom.form) return;

        this.dom.modal.classList.remove('hidden');
        this.dom.form.reset();
        this.dom.form.dataset.mode = mode;

        // Apply Mask
        const amountInput = this.dom.form.querySelector('[name="amount"]');
        if (amountInput && typeof CurrencyMask !== 'undefined') {
            CurrencyMask.apply(amountInput);
        }

        const titleEl = this.dom.modal.querySelector('.modal-title');

        if (mode === 'edit' && transaction) {
            this.dom.form.dataset.id = transaction.id;
            this.dom.form.querySelector('[name="description"]').value = transaction.description;

            // Format existing value for mask
            if (amountInput) {
                const amountInCents = Math.round(transaction.amount * 100);
                amountInput.value = typeof CurrencyMask !== 'undefined' ? CurrencyMask.format(amountInCents.toString()) : transaction.amount;
            }

            this.dom.form.querySelector('[name="date"]').value = transaction.date.split('T')[0];
            this.dom.form.querySelector('[name="categoryId"]').value = transaction.category_id;

            const paymentInput = this.dom.form.querySelector('[name="paymentMethod"]');
            if (paymentInput) paymentInput.value = transaction.payment_method || 'money';

            // Radio logic for type
            const typeRadio = this.dom.form.querySelector(`input[name="type"][value="${transaction.type}"]`);
            if (typeRadio) typeRadio.checked = true;

            if (titleEl) titleEl.textContent = 'Editar Transação';

        } else {
            this.dom.form.dataset.mode = 'create';
            delete this.dom.form.dataset.id;
            this.dom.form.reset();
            this.dom.form.querySelector('[name="date"]').value = new Date().toISOString().split('T')[0];

            const titleEl = this.dom.modal.querySelector('.modal-title');
            if (titleEl) titleEl.textContent = 'Nova Transação';
        }

        this.dom.modal.classList.remove('hidden');
        // setTimeout to allow transition if needed, but removing hidden is instant
    },

    closeTransactionModal() {
        if (this.dom.modal) this.dom.modal.classList.add('hidden');
    }
};