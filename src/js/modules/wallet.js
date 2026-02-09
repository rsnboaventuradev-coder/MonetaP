import { TransactionService } from '../services/transaction.service.js';
import { AccountsService } from '../services/accounts.service.js';
import { CurrencyMask } from '../utils/mask.js';
import { AuthService } from './auth.js';
import { HapticService } from '../services/haptics.service.js';
import { Toast } from '../utils/toast.js';
import { CategoryBudgetService } from '../services/category_budgets.service.js';
import { CreditCardService } from '../services/credit-card.service.js';
import Chart from 'chart.js/auto';

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
            type: null, // 'income' | 'expense' | null
            context: null // 'personal' | 'business' | null
        },
        transactionToDelete: null // Para confirmação de exclusão
    },

    unsubscribe: null,

    async init() {
        // State Guard
        if (window.app.currentView !== 'wallet') return;

        // Subscribe to TransactionService
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = TransactionService.subscribe((transactions) => {
            if (window.app.currentView !== 'wallet') return; // Guard
            this.state.transactions = transactions;
            if (document.getElementById('walletTransactionsList')) {
                this.renderTransactionsList();
                this.updateBalanceDisplay();
                this.renderSummaryCharts(); // Update charts on transaction change
            }
        });

        // Initial Fetch
        if (TransactionService.transactions.length === 0) {
            await TransactionService.init();
        } else {
            this.state.transactions = TransactionService.transactions;
        }

        // Initialize AccountsService
        await AccountsService.init();

        // Initialize CategoryBudgetService for budget alerts
        await CategoryBudgetService.init();
    },

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        // 1. Initial State Guard
        if (window.app.currentView !== 'wallet') return;

        // 2. Ensure current date
        if (!this.state.currentDate) this.state.currentDate = new Date();

        // 3. Render Interface (SHELL FIRST)
        const monthYear = this.state.currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

        container.innerHTML = `
        <div class="flex flex-col min-h-full bg-brand-bg safe-area-top">
            <!-- HEADER -->
            <div class="px-6 pt-6 flex justify-between items-center bg-brand-bg sticky top-0 z-20 pb-4 border-b border-brand-border backdrop-blur-md">
                <div>
                    <p class="text-xs text-brand-text-secondary font-medium uppercase tracking-wider">Seu Dinheiro</p>
                    <h1 class="text-2xl font-bold text-brand-text-primary leading-none mt-1">Carteira</h1>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="window.app.togglePrivacy()" class="text-brand-text-secondary hover:text-brand-text-primary transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- TOTAL BALANCE & FILTERS -->
            <div class="px-6 py-6 bg-brand-surface border-b border-brand-border space-y-4">

                <div class="flex items-center gap-4 animate-fade-in-up" style="animation-delay: 0.1s;">
                    <!-- Date Selector (Month) -->
                    <div class="flex items-center bg-brand-surface rounded-xl p-1 border border-brand-border">
                        <button id="prevMonthBtn" class="p-2 hover:bg-brand-surface-light rounded-lg text-brand-text-secondary hover:text-brand-text-primary transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span id="currentMonthLabel" class="w-32 text-center text-sm font-bold text-brand-text-primary uppercase tracking-wide">
                            Julho 2024
                        </span>
                        <button id="nextMonthBtn" class="p-2 hover:bg-brand-surface-light rounded-lg text-brand-text-secondary hover:text-brand-text-primary transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    <!-- Search Bar -->
                    <div class="relative flex-1 group hidden md:block">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-brand-text-secondary group-focus-within:text-brand-gold transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input type="text" id="transactionDetailsSearch"
                            class="w-full bg-brand-surface border border-brand-border text-brand-text-secondary text-sm rounded-xl focus:ring-1 focus:ring-brand-gold focus:border-brand-gold block pl-10 p-2.5 transition outline-none placeholder-gray-600"
                            placeholder="Buscar transação...">
                    </div>
                    <!-- Mobile Search Trigger (Optional, kept simple for now) -->
                </div>
                <div class="px-6 space-y-6 pt-6 mb-6">
                    <!-- View Toggler -->
                    <div class="bg-brand-surface-light p-1 rounded-xl flex gap-1">
                        <button onclick="window.app.WalletModule.switchView('transactions')" id="viewBtn-transactions" class="flex-1 py-2 rounded-lg text-sm font-bold bg-brand-gold text-brand-darker shadow-lg transition-all">
                            Transações
                        </button>
                        <button onclick="window.app.WalletModule.switchView('subscriptions')" id="viewBtn-subscriptions" class="flex-1 py-2 rounded-lg text-sm font-bold text-brand-text-secondary hover:text-brand-text-primary transition-all">
                            Assinaturas
                        </button>
                    </div>

                    <div>
                        <p class="text-brand-text-secondary text-xs font-medium mb-1">Saldo do Mês</p>
                        <h2 id="walletTotalBalance" class="text-4xl font-black text-brand-text-primary tracking-tight value-sensitive">R$ ...</h2>
                    </div>

                    <div id="filterTabsContainer" class="flex gap-2 overflow-x-auto scrollbar-hide">
                        <button class="filter-tab active px-4 py-2 rounded-full text-xs font-bold bg-brand-surface-light text-brand-text-primary whitespace-nowrap border border-brand-border transition hover:bg-white/20" data-type="all">Todos</button>
                        <button class="filter-tab px-4 py-2 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green whitespace-nowrap border border-brand-green/20 transition hover:bg-brand-green/20" data-type="income">Entradas</button>
                        <button class="filter-tab px-4 py-2 rounded-full text-xs font-bold bg-brand-red/10 text-brand-red whitespace-nowrap border border-brand-red/20 transition hover:bg-brand-red/20" data-type="expense">Saídas</button>
                        <button class="filter-tab px-4 py-2 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 whitespace-nowrap border border-blue-500/20 transition hover:bg-blue-500/20" data-context="personal">👤 PF</button>
                        <button class="filter-tab px-4 py-2 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 whitespace-nowrap border border-purple-500/20 transition hover:bg-purple-500/20" data-context="business">💼 PJ</button>
                    </div>
                </div>

                <!-- WALLET SUMMARY CHARTS -->
                <div id="walletSummaryCharts" class="px-6 py-4 space-y-4">
                    <!-- Quick Stats Cards -->
                    <div class="grid grid-cols-3 gap-3">
                        <div class="bg-brand-green/10 rounded-xl p-3 text-center border border-brand-green/20">
                            <p class="text-[10px] text-brand-text-secondary uppercase font-bold tracking-wide">Receitas</p>
                            <p id="walletTotalIncome" class="text-lg font-black text-brand-green value-sensitive">R$ 0</p>
                        </div>
                        <div class="bg-brand-red/10 rounded-xl p-3 text-center border border-brand-red/20">
                            <p class="text-[10px] text-brand-text-secondary uppercase font-bold tracking-wide">Despesas</p>
                            <p id="walletTotalExpenses" class="text-lg font-black text-brand-red value-sensitive">R$ 0</p>
                        </div>
                        <div class="bg-brand-gold/10 rounded-xl p-3 text-center border border-brand-gold/20">
                            <p class="text-[10px] text-brand-text-secondary uppercase font-bold tracking-wide">Saldo</p>
                            <p id="walletNetBalance" class="text-lg font-black text-brand-gold value-sensitive">R$ 0</p>
                        </div>
                    </div>
                    <!-- Charts Row -->
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Expense Categories Chart -->
                        <div class="bg-brand-surface rounded-2xl p-4 border border-brand-border">
                            <h4 class="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wide mb-3">Top Despesas</h4>
                            <div id="walletExpenseChartContainer" class="relative h-32">
                                <canvas id="walletExpenseChart"></canvas>
                            </div>
                        </div>
                        <!-- Income Sources Chart -->  
                        <div class="bg-brand-surface rounded-2xl p-4 border border-brand-border">
                            <h4 class="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wide mb-3">Top Receitas</h4>
                            <div id="walletIncomeChartContainer" class="relative h-32">
                                <canvas id="walletIncomeChart"></canvas>
                            </div>
                        </div>
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
                    <button id="loadMoreTransactionsBtn" class="text-sm font-bold text-brand-text-secondary hover:text-brand-text-primary transition py-2 px-4 hidden">
                        Carregar Mais
                    </button>
                </div>

                <!-- FAB ADD BUTTON -->
                <button id="addTransactionBtn" class="fixed bottom-24 right-6 w-14 h-14 bg-brand-green rounded-full shadow-glow-green text-brand-text-primary flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition z-30">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            <!-- MODAL TRANSACTION -->
            <div id="transactionModal" class="fixed inset-0 hidden" style="z-index: 9999;">
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity" onclick="window.app.WalletModule ? window.app.WalletModule.closeTransactionModal() : null"></div>
                <div class="fixed bottom-0 left-0 right-0 w-full bg-brand-surface border-t border-brand-border rounded-t-2xl md:rounded-2xl md:border p-0 shadow-2xl max-h-[90vh] flex flex-col md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:min-w-[600px] md:h-auto animate-slide-up md:animate-scale-in">
                    
                    <!-- Drag Handle (Mobile Only) -->
                    <div class="w-12 h-1.5 bg-brand-surface-light rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>

                    <!-- Header (Fixed) -->
                    <div class="p-6 pb-4 border-b border-brand-border flex justify-between items-center shrink-0">
                        <h3 class="modal-title text-xl font-bold text-brand-text-primary">Nova Transação</h3>
                        <button onclick="window.app.WalletModule.closeTransactionModal()" class="bg-brand-surface-light rounded-full p-2 text-brand-text-secondary hover:text-brand-text-primary transition">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>

                    <!-- Body (Scrollable) -->
                    <form id="transactionForm" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <div class="bg-[#27272a] rounded-xl p-4">
                            <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Valor</label>
                            <input type="text" inputmode="numeric" id="amountInput" name="amount" data-currency required class="w-full bg-transparent text-4xl font-black text-white border-0 p-0 focus:ring-0 placeholder-gray-500" placeholder="R$ 0,00">
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <label class="p-3 rounded-xl bg-brand-surface-light border border-brand-border flex items-center justify-center gap-2 cursor-pointer has-[:checked]:bg-brand-green/20 has-[:checked]:border-brand-green/50 transition">
                                <input type="radio" name="type" value="income" class="hidden">
                                    <span class="text-sm font-bold text-brand-text-primary">Entrada</span>
                            </label>
                            <label class="p-3 rounded-xl bg-brand-surface-light border border-brand-border flex items-center justify-center gap-2 cursor-pointer has-[:checked]:bg-brand-red/20 has-[:checked]:border-brand-red/50 transition">
                                <input type="radio" name="type" value="expense" class="hidden" checked>
                                    <span class="text-sm font-bold text-brand-text-primary">Saída</span>
                            </label>
                        </div>

                        <div>
                            <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Descrição</label>
                            <input type="text" name="description" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none placeholder-gray-400" placeholder="Ex: Supermercado">
                        </div>

                        <div>
                            <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Classificação</label>
                            <select id="transactionContext" name="context" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none">
                                <option value="personal">👤 Pessoal (PF)</option>
                                <option value="business">💼 Empresa (PJ)</option>
                            </select>
                            <p class="text-xs text-brand-text-secondary mt-2">Separe despesas pessoais e empresariais</p>
                        </div>

                        <div>
                            <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Categoria</label>
                            <select id="transactionCategory" name="categoryId" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none">
                                <option value="">Carregando...</option>
                            </select>
                            

                        </div>

                        <div>
                            <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Data da Compra</label>
                            <input type="date" name="date" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none scheme-dark">
                        </div>

                        <div>
                            <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Conta</label>
                            <select id="transactionAccount" name="account_id" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none">
                                <option value="">Carregando contas...</option>
                            </select>
                            <p class="text-xs text-brand-text-secondary mt-2">Selecione de onde o dinheiro saiu/entrou</p>
                        </div>



                        <!-- RECURRING TOGGLE -->
                        <div class="bg-brand-surface-light rounded-xl p-4 border border-brand-border">
                            <label class="flex items-center justify-between cursor-pointer">
                                <span class="text-sm font-bold text-brand-text-secondary">Repetir Mensalmente?</span>
                                <div class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="isRecurring" id="isRecurringInput" class="sr-only peer">
                                        <div class="w-11 h-6 bg-brand-surface-light rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-green/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                                </div>
                            </label>

                            <div id="recurringOptions" class="hidden mt-4 pt-4 border-t border-brand-border animate-fade-in">
                                <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Dia do Vencimento</label>
                                <input type="number" name="day_of_month" min="1" max="31" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none placeholder-gray-400" placeholder="Ex: 5">
                                    <p class="text-xs text-brand-text-secondary mt-2">Será gerado automaticamente todo mês neste dia.</p>
                            </div>
                        </div>

                        <!-- BILLING TOGGLE (Parcelado) -->
                        <div class="bg-brand-surface-light rounded-xl p-4 border border-brand-border">
                            <label class="flex items-center justify-between cursor-pointer">
                                <span class="text-sm font-bold text-brand-text-secondary">Compra Parcelada?</span>
                                <div class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="isInstallment" id="isInstallmentInput" class="sr-only peer">
                                        <div class="w-11 h-6 bg-brand-surface-light rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-green/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                                </div>
                            </label>

                            <div id="installmentOptions" class="hidden mt-4 pt-4 border-t border-brand-border animate-fade-in">
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Parcelas</label>
                                        <input type="number" name="installmentsCount" min="2" max="60" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none placeholder-gray-400" placeholder="Ex: 10">
                                    </div>
                                    <div>
                                         <label class="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Vencimento</label>
                                         <input type="number" name="installmentDay" min="1" max="31" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-white focus:border-brand-green outline-none placeholder-gray-400" placeholder="Dia (Opcional)">
                                    </div>
                                </div>
                                <p class="text-xs text-brand-text-secondary mt-2">O valor total será dividido pelo número de parcelas.</p>
                            </div>
                        </div>
                        
                        <!-- Extra padding for scroll safety -->
                        <div class="pb-32 md:pb-0"></div>
                    </form>

                    <!-- Footer (Fixed) -->
                    <div class="p-6 border-t border-brand-border bg-brand-surface rounded-b-2xl shrink-0 safe-area-bottom z-10 relative">
                        <button type="submit" form="transactionForm" class="w-full bg-brand-green text-brand-text-primary font-bold py-4 rounded-xl shadow-lg shadow-brand-green/20 hover:scale-[1.02] transition shrink-0">
                            Salvar
                        </button>
                    </div>
                </div>
            </div>

            <!-- MODAL DELETE CONFIRMATION -->
    <div id="deleteConfirmationModal" class="fixed inset-0 z-[60] hidden">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-4">
            <div class="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-2xl text-center animate-shake">
                <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h3 class="text-xl font-bold text-brand-text-primary mb-2">Excluir Transação?</h3>
                <p class="text-brand-text-secondary text-sm mb-6">Essa ação não pode ser desfeita. Tem certeza que deseja apagar esse registro?</p>
                <div class="flex gap-3">
                    <button id="cancelDeleteBtn" class="flex-1 py-3 rounded-xl font-bold text-brand-text-secondary bg-brand-surface-light hover:bg-brand-surface-light transition" onclick="window.app.WalletModule.closeDeleteModal()">Cancelar</button>
                    <button id="confirmDeleteBtn" class="flex-1 py-3 rounded-xl font-bold text-brand-text-primary bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition">Excluir</button>
                </div>
            </div>
        </div>
    </div>
`;

        // 4. Make globally available & Bind
        window.app.WalletModule = this;
        this.cacheDOM();
        this.bindEvents();

        try {
            // 5. Async Init (Fetch Data)
            await this.init();

            // Final Guard
            if (window.app.currentView !== 'wallet') return;

        } catch (error) {
            console.error('Wallet Render Error:', error);
            if (window.app.currentView === 'wallet') {
                Toast.show('Erro ao carregar carteira', 'error');
            }
        }
    },

    async init() {
        // Initial Loads
        // We await these to ensuring "State Guard" in render works efficiently
        await Promise.all([
            this.loadCategories(),
            this.loadAccounts(),
            this.loadTransactions(true)
        ]);
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
        if (this.dom.addBtn) {
            this.dom.addBtn.addEventListener('click', () => {
                if (this.currentView === 'subscriptions') {
                    // Open Modal prepopulated for recurring
                    this.openTransactionModal('create', null, true);
                } else {
                    this.openTransactionModal();
                }
            });
        }
        if (this.dom.form) {
            this.dom.form.addEventListener('submit', (e) => this.handleTransactionSubmit(e));

            // Listen for Type changes to filter categories
            const typeRadios = this.dom.form.querySelectorAll('input[name="type"]');
            typeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const newType = e.target.value; // 'income' or 'expense'
                    this.renderCategoryOptions(newType);
                });
            });

            // Listen for Context changes to filter categories (PF vs PJ)
            const contextSelect = this.dom.form.querySelector('select[name="context"]');
            if (contextSelect) {
                contextSelect.addEventListener('change', () => {
                    // We need current type to know if we should filter expense lists
                    const currentTypeRadio = this.dom.form.querySelector('input[name="type"]:checked');
                    const type = currentTypeRadio ? currentTypeRadio.value : 'expense';
                    this.renderCategoryOptions(type);
                });
            }
        }

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
        const isInstallmentInput = document.getElementById('isInstallmentInput');
        const installmentOptions = document.getElementById('installmentOptions');

        if (isRecurringInput && recurringOptions) {
            isRecurringInput.addEventListener('change', (e) => {
                if (e.target.checked) {
                    recurringOptions.classList.remove('hidden');
                    // Uncheck Installment
                    if (isInstallmentInput) {
                        isInstallmentInput.checked = false;
                        if (installmentOptions) installmentOptions.classList.add('hidden');
                    }
                } else {
                    recurringOptions.classList.add('hidden');
                }
            });
        }

        if (isInstallmentInput && installmentOptions) {
            isInstallmentInput.addEventListener('change', (e) => {
                if (e.target.checked) {
                    installmentOptions.classList.remove('hidden');
                    // Uncheck Recurring
                    if (isRecurringInput) {
                        isRecurringInput.checked = false;
                        if (recurringOptions) recurringOptions.classList.add('hidden');
                    }
                } else {
                    installmentOptions.classList.add('hidden');
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

    async loadAccounts() {
        const accountSelect = document.getElementById('transactionAccount');
        if (!accountSelect) return;

        try {
            const accounts = AccountsService.accounts.filter(a => a.is_active);

            if (accounts && accounts.length > 0) {
                accountSelect.innerHTML = `
                    <option value="">Selecione uma conta...</option>
                    ${accounts.map(acc => {
                    const icon = acc.icon || AccountsService.getTypeIcon(acc.type);
                    const balance = (acc.current_balance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    return `<option value="${acc.id}">${icon} ${acc.name} (R$ ${balance})</option>`;
                }).join('')}
                `;
            } else {
                accountSelect.innerHTML = '<option value="">Nenhuma conta cadastrada</option>';
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
            accountSelect.innerHTML = '<option value="">Erro ao carregar</option>';
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
            this.renderSummaryCharts(); // NEW: Update charts
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
        this.dom.totalBalance.textContent = this.formatCurrency(total / 100);
    },

    renderSkeleton() {
        if (!this.dom.list) return;
        this.dom.list.innerHTML = Array(3).fill(0).map(() => `
    < div class="mb-6 animate-pulse" >
                <div class="h-4 bg-brand-surface-light rounded w-24 mb-3 ml-1"></div>
                <div class="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
                    ${Array(3).fill(0).map(() => `
                    <div class="p-4 flex items-center justify-between border-b border-brand-border last:border-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-brand-surface-light"></div>
                            <div class="space-y-2">
                                <div class="h-4 bg-brand-surface-light rounded w-32"></div>
                                <div class="h-3 bg-brand-surface-light rounded w-20"></div>
                            </div>
                        </div>
                        <div class="h-5 bg-brand-surface-light rounded w-20"></div>
                    </div>
                    `).join('')}
                </div>
            </div >
    `).join('');
    },

    renderTransactionsList(transactionsOverride = null) {
        // Null Check
        if (!this.dom.list) return;

        const transactions = transactionsOverride || this.state.transactions;

        if (transactions.length === 0) {
            this.dom.list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                    <div class="w-24 h-24 bg-brand-surface-light rounded-full flex items-center justify-center mb-6">
                         <span class="text-4xl">💸</span>
                    </div>
                    <h3 class="text-xl font-bold text-brand-text-primary mb-2">Nada por aqui... ainda!</h3>
                    <p class="text-brand-text-secondary max-w-[250px] mb-6">Suas transações aparecerão aqui. Que tal começar agora?</p>
                    <button onclick="window.app.navigateTo('wallet'); document.querySelector('#wallet-add-btn')?.click()" class="px-6 py-3 bg-brand-gold text-brand-text-primary rounded-xl font-bold hover:bg-brand-gold-light transition shadow-glow-gold">
                        Registrar Transação
                    </button>
                </div>
            `;
            return;
        }

        // Group by Date
        const grouped = this.groupByDate(transactions);

        this.dom.list.innerHTML = `
            <!-- MOBILE VIEW (CARDS) -->
            <div class="md:hidden space-y-6">
                ${Object.entries(grouped).map(([date, items]) => `
                    <div class="animate-fade-in-up">
                        <h3 class="text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 ml-1 sticky top-0 bg-brand-bg/95 backdrop-blur py-2 z-10">${this.formatDateHeader(date)}</h3>
                        <div class="bg-brand-surface shadow-card-sm border border-brand-border rounded-2xl overflow-hidden">
                            ${items.map(t => this.renderTransactionItem(t)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- DESKTOP VIEW (TABLE) -->
            <div class="hidden md:block bg-brand-surface border border-brand-border rounded-2xl overflow-hidden shadow-sm animate-fade-in">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-brand-border bg-brand-surface-light/50">
                            <th class="p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider">Data</th>
                            <th class="p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider">Categoria / Descrição</th>
                            <th class="p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider">Conta</th>
                            <th class="p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider">Status</th>
                            <th class="p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider text-right">Valor</th>
                            <th class="p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-brand-border">
                        ${transactions.map(t => {
            const isExpense = t.type === 'expense';
            const colorClass = isExpense ? 'text-brand-red' : 'text-brand-green';
            const sign = isExpense ? '-' : '+';
            // Date formatting
            const dateObj = new Date(t.date);
            const day = dateObj.getDate().toString().padStart(2, '0');
            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const year = dateObj.getFullYear();

            // Category Icon
            const categoryColor = t.categories?.color || '#6c757d';
            const categoryIcon = t.categories?.icon || 'fa-tag';
            const iconDisplay = categoryIcon.includes('fa-') ? `<i class="fas ${categoryIcon}"></i>` : categoryIcon;

            return `
                                <tr class="hover:bg-brand-surface-light/50 transition duration-150 group">
                                    <td class="p-4 text-sm text-brand-text-secondary font-medium whitespace-nowrap">
                                        ${day}/${month}/${year}
                                    </td>
                                    <td class="p-4">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg" style="background-color: ${categoryColor}20; color: ${categoryColor};">
                                                ${iconDisplay}
                                            </div>
                                            <div>
                                                <p class="text-sm font-bold text-brand-text-primary text-ellipsis overflow-hidden">${t.description}</p>
                                                <p class="text-xs text-brand-text-secondary">${t.categories?.name || 'Geral'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="p-4">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-bold px-2 py-1 rounded bg-brand-bg border border-brand-border text-brand-text-secondary">
                                                ${t.accounts?.name || 'Conta'}
                                            </span>
                                            ${t.context === 'business' ? '<span class="text-[9px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold">PJ</span>' : ''}
                                        </div>
                                    </td>
                                    <td class="p-4">
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}">
                                            ${t.status === 'paid' ? 'Pago' : 'Pendente'}
                                        </span>
                                    </td>
                                    <td class="p-4 text-right">
                                        <span class="text-sm font-bold ${colorClass} value-sensitive tabular-nums">
                                            ${sign} ${this.formatCurrency(t.amount / 100)}
                                        </span>
                                    </td>
                                    <td class="p-4 text-right">
                                        <div class="flex items-center justify-end gap-2 opacity-100 group-hover:opacity-100 transition-opacity">
                                            <button onclick="window.app.WalletModule.openEdit('${t.id}')" class="p-2 text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-bg rounded-lg transition" title="Editar">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button onclick="window.app.WalletModule.askDelete('${t.id}')" class="p-2 text-brand-text-secondary hover:text-red-500 hover:bg-red-50/10 rounded-lg transition" title="Excluir">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    updateBalanceDisplay() {
        if (!this.dom.totalBalance) return;
        const total = this.state.transactions.reduce((acc, t) => {
            const val = parseInt(t.amount || 0);
            return t.type === 'income' ? acc + val : acc - val;
        }, 0);
        this.dom.totalBalance.textContent = this.formatCurrency(total / 100);
    },

    renderTransactionItem(t) {
        const isExpense = t.type === 'expense';
        const colorClass = isExpense ? 'text-brand-red' : 'text-brand-green';
        const sign = isExpense ? '-' : '+';
        const categoryColor = t.categories?.color || '#6c757d';
        const categoryIcon = t.categories?.icon || 'fa-tag';

        // Verifica se é ícone do FontAwesome ou Emoji
        const iconDisplay = categoryIcon.includes('fa-')
            ? `<i class="fas ${categoryIcon}"></i>`
            : categoryIcon;

        return `
            <div class="flex items-center p-4 border-b border-brand-border last:border-0 hover:bg-brand-surface-light transition group">
                <!--Icon -->
                <div class="w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0" 
                     style="background-color: ${categoryColor}20; color: ${categoryColor};">
                    <span class="text-lg">${iconDisplay}</span>
                </div>
                
                <!--Text(Click to Edit) -->
                <div class="flex-grow min-w-0 cursor-pointer" onclick="window.app.WalletModule.openEdit('${t.id}')">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="text-sm font-bold text-brand-text-primary truncate">${t.description}</h4>
                        ${t.context === 'business' ? '<span class="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">PJ</span>' : ''}
                    </div>
                    <p class="text-xs text-brand-text-secondary truncate">
                        ${t.categories?.name || 'Geral'} 
                        ${t.payment_method ? `• ${this.formatPaymentMethod(t.payment_method)}` : ''}
                    </p>
                </div>

                <!--Value -->
                <div class="text-right ml-4 shrink-0">
                    <div class="font-bold text-sm ${colorClass} value-sensitive">
                        ${sign} ${this.formatCurrency(t.amount / 100)}
                    </div>
                </div>

                <!--Actions(Visible on Hover / Swipe) -->
                <div class="ml-4 flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="btn-delete p-2 text-brand-text-secondary hover:text-red-500 transition" data-id="${t.id}" onclick="event.stopPropagation(); window.app.WalletModule.askDelete('${t.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    // --- Lógica de Formulário e Ações ---

    async handleTransactionSubmit(e) {
        e.preventDefault();

        // Fix: Button is outside the form in the fixed footer, so we search in the modal
        const submitBtn = this.dom.modal.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // UX: Previne clique duplo
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';

        try {
            const formData = new FormData(this.dom.form);
            const isRecurring = document.getElementById('isRecurringInput').checked;

            // Unmask Amount - returns value in REAIS (float) for TransactionService.create()
            const rawAmount = document.getElementById('amountInput').value;
            const amountInReais = CurrencyMask.unmaskToFloat(rawAmount); // TransactionService.create() expects reais

            const transactionData = {
                type: formData.get('type'),
                description: formData.get('description'),
                amount: amountInReais,
                date: formData.get('date'), // Formato YYYY-MM-DD do input date
                categoryId: formData.get('categoryId'), // Changed from category_id
                context: formData.get('context') || 'personal',
                account_id: formData.get('account_id'), // NEW: Account tracking
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
                        day_of_month: day
                    });
                    Toast.show('Recorrência criada com sucesso!', 'success');
                    HapticService.success();
                } else if (document.getElementById('isInstallmentInput').checked) {
                    // HANDLE INSTALLMENTS
                    const installmentsCount = parseInt(formData.get('installmentsCount'));
                    const installmentDay = formData.get('installmentDay') ? parseInt(formData.get('installmentDay')) : null;

                    if (!installmentsCount || installmentsCount < 2) throw new Error('Número de parcelas inválido.');

                    await TransactionService.createInstallments({
                        ...transactionData,
                        installmentsCount,
                        installmentDay
                    });
                    Toast.show('Parcelamento criado!', 'success');
                    HapticService.success();
                } else {
                    // NORMAL CREATE
                    await TransactionService.create(transactionData);
                    Toast.show('Transação criada!', 'success');
                    HapticService.success();

                    // Check budget limit for expenses
                    if (transactionData.type === 'expense' && transactionData.categoryId) {
                        const txDate = transactionData.date ? new Date(transactionData.date) : new Date();
                        const budgetStatus = await CategoryBudgetService.checkBudget(
                            transactionData.categoryId,
                            transactionData.amount * 100, // Convert to cents
                            txDate
                        );

                        if (budgetStatus.hasLimit) {
                            if (budgetStatus.exceeded) {
                                Toast.show(
                                    `⚠️ Orçamento de ${budgetStatus.categoryName} excedido! (${budgetStatus.usagePercent}%)`,
                                    'warning'
                                );
                                HapticService.warning();
                            } else if (budgetStatus.nearLimit) {
                                Toast.show(
                                    `📊 ${budgetStatus.usagePercent}% do orçamento de ${budgetStatus.categoryName}`,
                                    'info'
                                );
                            }
                        }
                    }
                }
            }

            this.closeTransactionModal();
            this.dom.form.reset();
            // Recarrega a lista para mostrar o estado atualizado
            await this.loadTransactions(true);

        } catch (error) {
            console.error(error);
            Toast.show(error.message || 'Erro ao salvar.', 'error');
            HapticService.error();
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

        this.openTransactionModal('edit', transaction);
    },

    askDelete(id) {
        this.state.transactionToDelete = id;
        HapticService.warning();

        // Open Modal
        if (this.dom.deleteModal) {
            this.dom.deleteModal.classList.remove('hidden');
        } else {
            // Fallback just in case
            window.ModalUtils.confirm('Excluir', 'Excluir transação?', { danger: true }).then(confirmed => { if (confirmed) this.confirmDelete(); });
        }
    },

    async confirmDelete() {
        if (!this.state.transactionToDelete) return;

        // Visual feedback on button
        if (this.dom.confirmDeleteBtn) {
            // const originalText = this.dom.confirmDeleteBtn.textContent; // Unused
            this.dom.confirmDeleteBtn.textContent = 'Excluindo...';
            this.dom.confirmDeleteBtn.disabled = true;

            try {
                await TransactionService.delete(this.state.transactionToDelete);
                Toast.show('Transação excluída.', 'info');
                HapticService.success();

                // Remove do estado local para UI atualizar instantaneamente sem reload de rede
                this.state.transactions = this.state.transactions.filter(t => t.id != this.state.transactionToDelete);

                // Re-render logic
                this.renderTransactionsList();
                this.updateTotalBalance();
            } catch (error) {
                console.error(error);
                Toast.show('Erro ao excluir.', 'error');
                HapticService.error();
            } finally {
                this.closeDeleteModal();
                if (this.dom.confirmDeleteBtn) {
                    this.dom.confirmDeleteBtn.textContent = 'Excluir';
                    this.dom.confirmDeleteBtn.disabled = false;
                }
            }
        }
    },

    closeDeleteModal() {
        if (this.dom.deleteModal) this.dom.deleteModal.classList.add('hidden');
        this.state.transactionToDelete = null;
    },

    // --- Validation ---
    validateForm() {
        if (!this.dom.form) return false;

        const description = this.dom.form.querySelector('[name="description"]').value.trim();
        const rawAmount = this.dom.form.querySelector('[name="amount"]').value;
        // Check functionality of CurrencyMask, fallback to simple parsing
        const amount = typeof CurrencyMask !== 'undefined' ? CurrencyMask.unmaskToFloat(rawAmount) : parseFloat(rawAmount.replace('R$', '').replace('.', '').replace(',', '.').trim());
        const categoryId = this.dom.form.querySelector('[name="categoryId"]').value;
        const date = this.dom.form.querySelector('[name="date"]').value;

        const isValid = description.length > 0 && amount > 0 && categoryId !== "" && date !== "";

        const submitBtn = this.dom.form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = !isValid;
            if (isValid) {
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }

        return isValid;
    },

    setupValidationListeners() {
        if (!this.dom.form) return;
        const inputs = this.dom.form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.removeEventListener('input', this._validateHandler);
            input.removeEventListener('change', this._validateHandler);

            this._validateHandler = () => this.validateForm();
            input.addEventListener('input', this._validateHandler);
            input.addEventListener('change', this._validateHandler);
        });
    },

    // --- Helpers de UI e Formatação ---

    handleFilterClick(e) {
        const type = e.target.dataset.type;
        const context = e.target.dataset.context;

        if (type !== undefined) {
            this.state.filters.type = type === 'all' ? null : type;
            // Clear context filter when selecting type
            if (type === 'all') {
                this.state.filters.context = null;
            }
        }

        if (context !== undefined) {
            this.state.filters.context = context;
            // Clear type filter when selecting context
            this.state.filters.type = null;
        }

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

    renderCategoryOptions(filterType = null) {
        if (!this.dom.categorySelect) return;

        // Save current selection to restore if valid
        const currentVal = this.dom.categorySelect.value;
        const currentTxCategoryId = this.dom.form.dataset.id ? this.dom.form.querySelector('[name="categoryId"]')?.value : null;
        // Note: dom.categorySelect.value might be empty if init. We rely on internal restore logic or currentVal if already selected.

        this.dom.categorySelect.innerHTML = '<option value="" disabled selected>Selecione...</option>';

        let categoriesToRender = this.state.categories;

        if (filterType) {
            // Filter categories: match type OR type is null (legacy/universal)
            categoriesToRender = categoriesToRender.filter(cat =>
                !cat.type || cat.type.toUpperCase() === filterType.toUpperCase()
            );
        }

        // --- CUSTOM REQUIREMENT: Enforce specific Expense Categories ---
        if (filterType === 'expense') {
            const contextSelect = this.dom.form.querySelector('select[name="context"]');
            // Default to 'personal' if context select not found or empty (e.g. init time)
            const context = contextSelect ? contextSelect.value : 'personal';

            let REQUIRED_CATEGORIES = [];

            if (context === 'business') {
                REQUIRED_CATEGORIES = [
                    'Equipe e Terceirizados',
                    'Insumos e Materiais',
                    'Lucro e Reservas',
                    'Custos Operacionais',
                    'Impostos e Taxas'
                ];
            } else {
                // Default / Personal
                REQUIRED_CATEGORIES = [
                    'Custos Fixos',
                    'Liberdade Financeira',
                    'Metas',
                    'Conforto',
                    'Prazeres',
                    'Conhecimento'
                ];
            }

            // Filter to only show these specific categories
            // We match by Name (Case Insensitive)
            let filtered = categoriesToRender.filter(cat =>
                REQUIRED_CATEGORIES.some(req => req.toLowerCase() === cat.name.toLowerCase())
            );

            // Important: sort them in the specific order requested
            filtered.sort((a, b) => {
                const indexA = REQUIRED_CATEGORIES.findIndex(r => r.toLowerCase() === a.name.toLowerCase());
                const indexB = REQUIRED_CATEGORIES.findIndex(r => r.toLowerCase() === b.name.toLowerCase());
                return indexA - indexB;
            });

            categoriesToRender = filtered;
        }

        // Render Options
        categoriesToRender.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;

            // Map standard icon names to Emojis for the Select dropdown (since it can't render SVGs)
            let emoji = '';
            const iconName = cat.icon ? cat.icon.toLowerCase() : '';

            const emojiMap = {
                'lock': '🔒',
                'trending-up': '📈',
                'target': '🎯',
                'coffee': '☕',
                'smile': '😃',
                'book': '📚',
                'home': '🏠',
                'car': '🚗',
                'gamepad': '🎮',
                'activity': '⚕️',
                'dollar-sign': '💰',
                'shopping-cart': '🛒',
                'gift': '🎁',
                'tool': '🛠️',
                'briefcase': '💼',
                'users': '👥',
                'box': '📦',
                'pie-chart': '📊',
                'settings': '⚙️',
                'file-text': '📄'
            };

            if (emojiMap[iconName]) {
                emoji = emojiMap[iconName];
            } else if (cat.icon && !cat.icon.includes('fa-') && !cat.icon.match(/^[a-z-]+$/)) {
                // If it's already an emoji (not a class-like string)
                emoji = cat.icon;
            }

            option.text = emoji ? `${emoji} ${cat.name}` : cat.name;
            this.dom.categorySelect.appendChild(option);
        });

        // Restore selection if it still exists in the filtered list
        if (currentVal && categoriesToRender.some(c => c.id == currentVal)) {
            this.dom.categorySelect.value = currentVal;
        } else if (currentVal) {
            // If the current value was filtered out (because it's not in the Required List),
            // we should probably fetch it from full list and append it so it's valid?
            const missingCat = this.state.categories.find(c => c.id == currentVal);
            if (missingCat) {
                const option = document.createElement('option');
                option.value = missingCat.id;
                const icon = (missingCat.icon && missingCat.icon.includes('fa-')) ? '' : (missingCat.icon || '');
                option.text = `${icon} ${missingCat.name} (Antigo)`;
                this.dom.categorySelect.appendChild(option);
                this.dom.categorySelect.value = currentVal;
            } else {
                this.dom.categorySelect.value = "";
            }
        } else {
            this.dom.categorySelect.value = "";
        }

        // --- NEW: Add Manage Button Logic ---
        // We can't put a button INSIDE the select. But we can ensure the container has it.
        // We'll verify if the 'manage-cats-btn' exists next to the select. If not, create it.
        const parent = this.dom.categorySelect.parentElement;
        if (parent && !parent.querySelector('#manage-cats-btn')) {
            const btn = document.createElement('button');
            btn.id = 'manage-cats-btn';
            btn.type = 'button'; // Prevent form submit
            btn.className = 'text-xs text-brand-gold font-bold uppercase mt-2 hover:underline flex items-center gap-1';
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Gerenciar Categorias
            `;
            btn.onclick = () => {
                // Close modal and go to settings? Or open settings modal?
                // Ideally preserve state? For now, navigate.
                if (confirm('Deseja ir para Configurações gerenciar as categorias? Os dados não salvos desta transação serão perdidos.')) {
                    window.app.WalletModule.closeTransactionModal();
                    window.app.navigateTo('settings');
                }
            };
            parent.appendChild(btn);
        }
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

    switchView(viewName) {
        this.currentView = viewName;

        // Update Buttons
        const txBtn = document.getElementById('viewBtn-transactions');
        const subBtn = document.getElementById('viewBtn-subscriptions');
        const filters = document.getElementById('filterTabsContainer');
        const fab = document.getElementById('addTransactionBtn');

        if (viewName === 'transactions') {
            if (txBtn) txBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-brand-gold text-brand-darker shadow-lg transition-all';
            if (subBtn) subBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-brand-text-secondary hover:text-brand-text-primary transition-all';
            if (filters) filters.classList.remove('hidden');
            if (fab) fab.classList.remove('hidden');
            this.renderTransactionsList();
        } else {
            if (txBtn) txBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold text-brand-text-secondary hover:text-brand-text-primary transition-all';
            if (subBtn) subBtn.className = 'flex-1 py-2 rounded-lg text-sm font-bold bg-brand-gold text-brand-darker shadow-lg transition-all';
            if (filters) filters.classList.add('hidden');
            if (fab) fab.classList.remove('hidden'); // Show FAB in Subscriptions too
            this.renderSubscriptions();
        }
    },

    async renderSubscriptions() {
        const list = document.getElementById('walletTransactionsList');
        if (!list) return;

        // Skeleton
        list.innerHTML = `
            <div class="animate-pulse space-y-3">
                <div class="h-20 bg-brand-surface-light rounded-2xl w-full"></div>
                <div class="h-20 bg-brand-surface-light rounded-2xl w-full"></div>
            </div>
        `;

        const recurring = await TransactionService.getRecurringDefinitions();
        const totalRecurring = recurring.reduce((acc, r) => acc + Number(r.amount), 0);

        // Get Income for context (Committed Income)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const stats = await TransactionService.getFinancialStatement(currentMonth, currentYear); // Added await if needed, but getFinancialStatement seems presumably async or not? Checked: it's likely async in Service but let's check assumptions. 
        // Actually, TransactionService.getFinancialStatement might be local calculation if syncing? 
        // Let's assume it returns a promise or value. If promise, we need await. 
        // View 2647 line 1002 didn't have await. I will stick to original.

        const income = (stats && stats.revenue) ? stats.revenue : 1; // avoid div by zero
        const committedPercent = Math.min((totalRecurring / income) * 100, 100).toFixed(1);

        let html = `
            <!-- Committed Income Widget -->
            <div class="bg-brand-surface-light p-6 rounded-2xl border border-brand-border mb-6">
                <div class="flex justify-between items-end mb-2">
                    <div>
                        <p class="text-xs text-brand-text-secondary uppercase tracking-widest font-bold">Custo Fixo Mensal</p>
                        <h3 class="text-2xl font-black text-brand-text-primary value-sensitive">R$ ${(totalRecurring / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div class="text-right">
                        <p class="text-xs text-${committedPercent > 50 ? 'brand-red' : 'brand-green'} font-bold">${committedPercent}% da Renda</p>
                    </div>
                </div>
                <div class="h-2 bg-brand-surface-light rounded-full overflow-hidden">
                    <div class="h-full bg-${committedPercent > 50 ? 'brand-red' : 'brand-green'} transition-all duration-1000" style="width: ${committedPercent}%"></div>
                </div>
                <p class="text-[10px] text-brand-text-secondary mt-2">Valor comprometido antes mesmo do mês começar.</p>
            </div>

            <!-- Credit Cards Section -->
            ${await this.renderCreditCardsSection()}

            <h3 class="text-sm font-bold text-brand-text-secondary uppercase mb-4 px-2">Assinaturas Ativas</h3>
            <div class="space-y-3">
        `;

        if (recurring.length === 0) {
            html += `
                <div class="text-center py-12">
                    <div class="w-16 h-16 bg-brand-surface-light rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔄</div>
                    <p class="text-brand-text-secondary text-sm">Nenhuma assinatura ou conta fixa cadastrada.</p>
                    <p class="text-gray-600 text-xs mt-2">Adicione uma transação e marque "Repetir Mensalmente".</p>
                </div>
            `;
        } else {
            html += recurring.map(r => `
                <div class="bg-brand-surface-light p-4 rounded-2xl border border-brand-border flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-xs uppercase">
                            ${r.description ? r.description.substring(0, 2) : '??'}
                        </div>
                        <div>
                            <h4 class="font-bold text-brand-text-primary text-sm">${r.description}</h4>
                            <p class="text-xs text-brand-text-secondary">Todo dia ${r.day_of_month}</p>
                        </div>
                    </div>
                    <div class="font-bold text-brand-text-primary value-sensitive">
                        R$ ${(r.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            `).join('');
        }

        html += '</div>';
        list.innerHTML = html;
    },

    async renderCreditCardsSection() {
        await CreditCardService.init();
        const cards = CreditCardService.cards;

        if (cards.length === 0) {
            return `
                <div class="mb-6">
                    <div class="flex justify-between items-center mb-4 px-2">
                        <h3 class="text-sm font-bold text-brand-text-secondary uppercase">💳 Cartões de Crédito</h3>
                        <button onclick="window.app.openCreditCardModal()" class="text-xs text-brand-gold font-bold hover:underline">+ Novo Cartão</button>
                    </div>
                    <div class="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-6 text-center">
                        <div class="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">💳</div>
                        <p class="text-sm text-brand-text-secondary">Nenhum cartão cadastrado</p>
                        <button onclick="window.app.openCreditCardModal()" class="mt-3 text-xs bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg hover:bg-purple-500/30 transition font-bold">
                            Adicionar Cartão
                        </button>
                    </div>
                </div>
            `;
        }

        const today = new Date();
        const currentDay = today.getDate();

        return `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-4 px-2">
                    <h3 class="text-sm font-bold text-brand-text-secondary uppercase">💳 Cartões de Crédito</h3>
                    <button onclick="window.app.openCreditCardModal()" class="text-xs text-brand-gold font-bold hover:underline">+ Novo</button>
                </div>
                <div class="space-y-4">
                    ${cards.map(card => {
            const daysUntilDue = card.billing_day >= currentDay
                ? card.billing_day - currentDay
                : (new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - currentDay) + card.billing_day;
            const isDueSoon = daysUntilDue <= 5;
            const invoiceAmount = (card.current_invoice || 0) / 100;
            const limitUsed = card.credit_limit ? ((card.current_invoice / card.credit_limit) * 100).toFixed(0) : 0;

            return `
                            <div class="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-5 relative overflow-hidden shadow-xl">
                                <!-- Card Design Elements -->
                                <div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                                <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                                
                                <div class="relative z-10">
                                    <!-- Header -->
                                    <div class="flex justify-between items-start mb-4">
                                        <div>
                                            <p class="text-purple-200 text-[10px] uppercase tracking-widest font-bold">Fatura Atual</p>
                                            <h4 class="text-2xl font-black text-white value-sensitive">
                                                R$ ${invoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </h4>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-white font-bold text-sm">${card.name}</p>
                                            ${card.last_digits ? `<p class="text-purple-200 text-xs">**** ${card.last_digits}</p>` : ''}
                                        </div>
                                    </div>

                                    <!-- Due Date -->
                                    <div class="flex justify-between items-center mb-4">
                                        <p class="text-purple-200 text-xs">
                                            📅 Vence dia <span class="text-white font-bold">${card.billing_day}</span>
                                            ${isDueSoon ? `<span class="text-yellow-300 ml-1">(em ${daysUntilDue} dias)</span>` : ''}
                                        </p>
                                        ${card.credit_limit ? `
                                            <p class="text-purple-200 text-xs">Pendentes: <span class="text-white font-bold">R$ ${invoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></p>
                                        ` : ''}
                                    </div>

                                    <!-- Limit Progress Bar -->
                                    ${card.credit_limit ? `
                                        <div class="h-1.5 bg-purple-900/50 rounded-full overflow-hidden mb-4">
                                            <div class="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all" style="width: ${Math.min(limitUsed, 100)}%"></div>
                                        </div>
                                    ` : ''}

                                    <!-- Action Buttons -->
                                    <div class="flex gap-2">
                                        <button onclick="window.app.openAddPurchaseModal('${card.id}')" 
                                            class="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1">
                                            ➕ Compra
                                        </button>
                                        <button onclick="window.app.viewCardInvoice('${card.id}')" 
                                            class="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1">
                                            📋 Ver Fatura
                                        </button>
                                        ${invoiceAmount > 0 ? `
                                            <button onclick="window.app.payCreditCardInvoice('${card.id}', '${card.name}', ${card.current_invoice})" 
                                                class="flex-1 bg-green-500/30 hover:bg-green-500/50 text-green-300 text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1">
                                                ✅ Pagar
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    },

    openTransactionModal(mode = 'create', transaction = null, isRecurringDefault = false) {
        HapticService.light();

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
        const recurringInput = document.getElementById('isRecurringInput');
        const recurringOptions = document.getElementById('recurringOptions');

        if (mode === 'edit' && transaction) {
            this.dom.form.dataset.id = transaction.id;
            this.dom.form.querySelector('[name="description"]').value = transaction.description;

            // Format existing value for mask
            if (amountInput) {
                // transaction.amount is already in Cents (Integer)
                const amountInCents = transaction.amount;
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

            // Edit Recurring? Not handling edit of recurring yet, just transactions.

        } else {
            this.dom.form.dataset.mode = 'create';
            delete this.dom.form.dataset.id;
            this.dom.form.reset();
            this.dom.form.querySelector('[name="date"]').value = new Date().toISOString().split('T')[0];

            const titleEl = this.dom.modal.querySelector('.modal-title');
            if (titleEl) titleEl.textContent = 'Nova Transação';

            // Handle Recurring Default
            if (isRecurringDefault && recurringInput) {
                recurringInput.checked = true;
                if (recurringOptions) recurringOptions.classList.remove('hidden');
            } else {
                if (recurringInput) recurringInput.checked = false;
                if (recurringOptions) recurringOptions.classList.add('hidden');
            }
        }

        if (this.dom.modal) this.dom.modal.classList.remove('hidden');

        // Initial Filter
        const initialType = transaction ? transaction.type : (isRecurringDefault ? 'expense' : 'expense');
        // Note: Default to expense if nothing, or check radio
        const currentTypeRadio = this.dom.form.querySelector('input[name="type"]:checked');
        const typeToFilter = currentTypeRadio ? currentTypeRadio.value : initialType;

        this.renderCategoryOptions(typeToFilter);

        // Restore category if editing
        if (mode === 'edit' && transaction) {
            this.dom.form.querySelector('[name="categoryId"]').value = transaction.category_id;
        }

        this.setupValidationListeners();
        this.validateForm();
    },

    closeTransactionModal() {
        if (this.dom.modal) this.dom.modal.classList.add('hidden');
    },

    // Chart instances
    expenseChart: null,
    incomeChart: null,

    renderSummaryCharts() {
        const transactions = this.state.transactions;

        // Calculate totals
        let totalIncome = 0;
        let totalExpenses = 0;
        const expensesByCategory = {};
        const incomesBySource = {};

        transactions.forEach(tx => {
            const amount = Math.abs(parseFloat(tx.amount) || 0);

            if (tx.type === 'income') {
                totalIncome += amount;
                const source = tx.description || 'Outros';
                incomesBySource[source] = (incomesBySource[source] || 0) + (amount / 100);
            } else if (tx.type === 'expense') {
                totalExpenses += amount;
                const catName = tx.categories?.name || tx.category_name || 'Outros';
                expensesByCategory[catName] = (expensesByCategory[catName] || 0) + (amount / 100);
            }
        });

        // Update stats cards
        const incomeEl = document.getElementById('walletTotalIncome');
        const expenseEl = document.getElementById('walletTotalExpenses');
        const balanceEl = document.getElementById('walletNetBalance');

        if (incomeEl) incomeEl.textContent = this.formatCurrency(totalIncome / 100);
        if (expenseEl) expenseEl.textContent = this.formatCurrency(totalExpenses / 100);
        if (balanceEl) {
            const netBalance = totalIncome - totalExpenses;
            balanceEl.textContent = this.formatCurrency(netBalance / 100);
            balanceEl.className = balanceEl.className.replace(/text-brand-(green|red|gold)/g, '');
            balanceEl.classList.add(netBalance >= 0 ? 'text-brand-green' : 'text-brand-red');
        }

        // Prepare chart data - Top 5 categories
        const sortedExpenses = Object.entries(expensesByCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const sortedIncomes = Object.entries(incomesBySource)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Default colors
        const expenseColors = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
        const incomeColors = ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#84cc16'];

        // Render Expense Chart
        const expenseCanvas = document.getElementById('walletExpenseChart');
        if (expenseCanvas && sortedExpenses.length > 0) {
            if (this.expenseChart) this.expenseChart.destroy();

            this.expenseChart = new Chart(expenseCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: sortedExpenses.map(([name]) => name),
                    datasets: [{
                        data: sortedExpenses.map(([, value]) => value),
                        backgroundColor: expenseColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    return ` R$ ${(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                }
                            }
                        }
                    }
                }
            });
        } else if (expenseCanvas) {
            expenseCanvas.parentElement.innerHTML = '<p class="text-center text-brand-text-secondary text-xs py-8">Sem despesas</p>';
        }

        // Render Income Chart
        const incomeCanvas = document.getElementById('walletIncomeChart');
        if (incomeCanvas && sortedIncomes.length > 0) {
            if (this.incomeChart) this.incomeChart.destroy();

            this.incomeChart = new Chart(incomeCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: sortedIncomes.map(([name]) => name),
                    datasets: [{
                        data: sortedIncomes.map(([, value]) => value),
                        backgroundColor: incomeColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    return ` R$ ${(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                }
                            }
                        }
                    }
                }
            });
        } else if (incomeCanvas) {
            incomeCanvas.parentElement.innerHTML = '<p class="text-center text-brand-text-secondary text-xs py-8">Sem receitas</p>';
        }
    }
};

// === Credit Card Functions ===
window.app = window.app || {};

window.app.openCreditCardModal = () => {
    const existing = document.getElementById('credit-card-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'credit-card-modal';
    modal.className = 'fixed inset-0 z-50 flex items-end justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
        <div class="relative w-full bg-brand-surface border-t border-brand-border rounded-t-[2rem] p-6 pb-10 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div class="w-12 h-1 bg-brand-surface-light rounded-full mx-auto mb-6"></div>
            <h3 class="text-xl font-bold text-brand-text-primary mb-6">💳 Novo Cartão de Crédito</h3>
            
            <form id="credit-card-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Nome do Cartão</label>
                    <input type="text" name="name" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white" placeholder="Ex: Nubank, Inter, C6">
                </div>
                <div>
                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Banco / Instituição</label>
                    <input type="text" name="bank" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white" placeholder="Ex: Nubank">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Últimos 4 Dígitos</label>
                        <input type="text" name="last_digits" maxlength="4" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white" placeholder="1234">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Dia Vencimento</label>
                        <input type="number" name="billing_day" min="1" max="31" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white" placeholder="10">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Limite (Opcional)</label>
                    <input type="text" name="credit_limit" data-currency="true" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white" placeholder="R$ 0,00">
                </div>
                <button type="submit" class="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-4 rounded-xl mt-4">
                    Salvar Cartão
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('credit-card-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await CreditCardService.createCard({
                name: form.name.value,
                bank: form.bank.value,
                last_digits: form.last_digits.value,
                billing_day: form.billing_day.value,
                credit_limit: form.credit_limit.value ? CurrencyMask.unmask(form.credit_limit.value) : null
            });
            Toast.show('Cartão adicionado com sucesso!', 'success');
            modal.remove();
            WalletModule.renderSubscriptions();
        } catch (error) {
            Toast.show('Erro: ' + error.message, 'error');
        }
    };
};

window.app.openAddPurchaseModal = (cardId) => {
    const existing = document.getElementById('add-purchase-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'add-purchase-modal';
    modal.className = 'fixed inset-0 z-50 flex items-end justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
        <div class="relative w-full bg-brand-surface border-t border-brand-border rounded-t-[2rem] p-6 pb-10 animate-slide-up">
            <div class="w-12 h-1 bg-brand-surface-light rounded-full mx-auto mb-6"></div>
            <h3 class="text-xl font-bold text-brand-text-primary mb-6">🛒 Nova Compra no Cartão</h3>
            
            <form id="add-purchase-form" class="space-y-4">
                <input type="hidden" name="card_id" value="${cardId}">
                <div>
                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Valor</label>
                    <input type="text" name="amount" data-currency="true" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-4 text-2xl font-bold text-white" placeholder="R$ 0,00">
                </div>
                <div>
                    <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Descrição</label>
                    <input type="text" name="description" required class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white" placeholder="Ex: Amazon, iFood, Uber">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Data</label>
                        <input type="date" name="purchase_date" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white [color-scheme:dark]" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-2">Parcelas</label>
                        <input type="number" name="installments" min="1" max="24" class="w-full bg-[#27272a] rounded-xl border border-brand-border p-3 text-white" value="1">
                    </div>
                </div>
                <button type="submit" class="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-4 rounded-xl mt-4">
                    Adicionar Compra
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('add-purchase-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await CreditCardService.addPurchase(form.card_id.value, {
                amount: CurrencyMask.unmask(form.amount.value),
                description: form.description.value,
                purchase_date: form.purchase_date.value,
                installments: form.installments.value
            });
            Toast.show('Compra adicionada à fatura!', 'success');
            modal.remove();
            WalletModule.renderSubscriptions();
        } catch (error) {
            Toast.show('Erro: ' + error.message, 'error');
        }
    };
};

window.app.payCreditCardInvoice = async (cardId, cardName, amountCents) => {
    try {
        // Pay the invoice (reset to 0)
        await CreditCardService.payInvoice(cardId);

        // Create expense transaction
        await TransactionService.create({
            amount: amountCents / 100,
            description: `Fatura ${cardName}`,
            type: 'expense',
            date: new Date().toISOString(),
            context: 'personal',
            status: 'paid',
            category: 'bills'
        });

        Toast.show(`✅ Fatura do ${cardName} paga!`, 'success');
        WalletModule.renderSubscriptions();
    } catch (error) {
        Toast.show('Erro: ' + error.message, 'error');
    }
};

window.app.viewCardInvoice = async (cardId) => {
    const purchases = await CreditCardService.getCardPurchases(cardId);
    const card = CreditCardService.cards.find(c => c.id === cardId);

    const existing = document.getElementById('invoice-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'invoice-modal';
    modal.className = 'fixed inset-0 z-50 flex items-end justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
        <div class="relative w-full bg-brand-surface border-t border-brand-border rounded-t-[2rem] p-6 pb-10 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div class="w-12 h-1 bg-brand-surface-light rounded-full mx-auto mb-6"></div>
            <h3 class="text-xl font-bold text-brand-text-primary mb-2">📋 Fatura ${card?.name || 'Cartão'}</h3>
            <p class="text-2xl font-black text-purple-400 mb-6 value-sensitive">
                R$ ${((card?.current_invoice || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            
            <div class="space-y-2">
                ${purchases.length === 0 ? `
                    <div class="text-center py-8 text-brand-text-secondary">
                        <p class="text-sm">Nenhuma compra nesta fatura</p>
                    </div>
                ` : purchases.map(p => `
                    <div class="bg-brand-surface-light p-3 rounded-xl flex justify-between items-center">
                        <div>
                            <p class="text-sm font-bold text-brand-text-primary">${p.description}</p>
                            <p class="text-[10px] text-brand-text-secondary">${new Date(p.purchase_date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <span class="text-sm font-bold text-brand-text-primary value-sensitive">
                            R$ ${(p.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                `).join('')}
            </div>
            
            <button onclick="this.closest('#invoice-modal').remove()" class="w-full bg-brand-surface-light text-brand-text-secondary font-bold py-3 rounded-xl mt-6">
                Fechar
            </button>
        </div>
    `;
    document.body.appendChild(modal);
};
