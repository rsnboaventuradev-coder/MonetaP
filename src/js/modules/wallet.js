import { TransactionService } from '../services/transaction.service.js';
import { AccountsService } from '../services/accounts.service.js';
import { CurrencyMask } from '../utils/mask.js';
import { AuthService } from './auth.js';
import { HapticService } from '../services/haptics.service.js';
import { Toast } from '../utils/toast.js';
import { CategoryBudgetService } from '../services/category_budgets.service.js';
import { CreditCardService } from '../services/credit-card.service.js';
import { Money } from '../utils/money.js';
import { createElement, clearElement } from '../utils/dom.js';
import { Chart } from 'chart.js/auto';
import Tesseract from 'tesseract.js';

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
                    <button onclick="window.app.navigateTo('reports')" class="flex items-center gap-2 px-3 py-1.5 bg-brand-surface-light text-blue-500 hover:bg-white/10 rounded-lg text-xs font-bold transition border border-brand-border">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span class="hidden sm:inline text-brand-text-primary">Relatórios</span>
                    </button>
                    <button id="importStatementBtn" class="flex items-center gap-2 px-3 py-1.5 bg-brand-surface-light hover:bg-white/10 rounded-lg text-xs font-bold text-brand-text-primary transition border border-brand-border">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span class="hidden sm:inline">Importar Extrato</span>
                    </button>
                    <input type="file" id="statementFileInput" class="hidden" accept="image/*">
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
                        <button class="filter-tab active px-5 py-3 rounded-full text-xs font-bold bg-brand-surface-light text-brand-text-primary whitespace-nowrap border border-brand-border transition-all active:scale-95 hover:bg-white/20" data-type="all">Todos</button>
                        <button class="filter-tab px-5 py-3 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green whitespace-nowrap border border-brand-green/20 transition-all active:scale-95 hover:bg-brand-green/20" data-type="income">Entradas</button>
                        <button class="filter-tab px-5 py-3 rounded-full text-xs font-bold bg-brand-red/10 text-brand-red whitespace-nowrap border border-brand-red/20 transition-all active:scale-95 hover:bg-brand-red/20" data-type="expense">Saídas</button>
                        <button class="filter-tab px-5 py-3 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 whitespace-nowrap border border-blue-500/20 transition-all active:scale-95 hover:bg-blue-500/20" data-context="personal">👤 PF</button>
                        <button class="filter-tab px-5 py-3 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 whitespace-nowrap border border-purple-500/20 transition-all active:scale-95 hover:bg-purple-500/20" data-context="business">💼 PJ</button>
                    </div>
                </div>

                <!-- WALLET SUMMARY CHARTS -->
                <div id="walletSummaryCharts" class="px-6 py-4 space-y-4">
                    <!-- Quick Stats Cards -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div class="bg-brand-surface rounded-xl p-3 text-center border border-brand-border">
                            <p class="text-[10px] text-brand-text-secondary uppercase font-bold tracking-wide">Saldo Atual</p>
                            <p id="walletNetBalance" class="text-lg font-black text-brand-primary value-sensitive">R$ 0</p>
                        </div>
                        <div class="bg-brand-gold/10 rounded-xl p-3 text-center border border-brand-gold/20">
                            <p class="text-[10px] text-brand-text-secondary uppercase font-bold tracking-wide">Projetado (Fim do Mês)</p>
                            <p id="walletProjectedBalance" class="text-lg font-black text-brand-gold value-sensitive">R$ 0</p>
                        </div>
                        <div class="bg-brand-green/10 rounded-xl p-3 text-center border border-brand-green/20">
                            <p class="text-[10px] text-brand-text-secondary uppercase font-bold tracking-wide">Receitas</p>
                            <p id="walletTotalIncome" class="text-lg font-black text-brand-green value-sensitive">R$ 0</p>
                        </div>
                        <div class="bg-brand-red/10 rounded-xl p-3 text-center border border-brand-red/20">
                            <p class="text-[10px] text-brand-text-secondary uppercase font-bold tracking-wide">Despesas</p>
                            <p id="walletTotalExpenses" class="text-lg font-black text-brand-red value-sensitive">R$ 0</p>
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
                <button id="addTransactionBtn" class="fixed bottom-24 right-6 w-14 h-14 bg-brand-green rounded-full shadow-[0_4px_20px_-4px_rgba(16,185,129,0.6)] text-white flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-all duration-300 z-30">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            <!-- MODAL TRANSACTION -->
            <div id="transactionModal" class="fixed inset-0 hidden" style="z-index: 9999;">
                <div class="absolute inset-0 bg-black/75 backdrop-blur-md" onclick="window.app.WalletModule ? window.app.WalletModule.closeTransactionModal() : null"></div>
                <div class="fixed bottom-0 left-0 right-0 w-full bg-brand-surface border-t border-brand-border/50 rounded-t-[2rem] md:rounded-3xl md:border p-0 shadow-2xl max-h-[92vh] flex flex-col md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:min-w-[600px] md:h-auto animate-slide-up md:animate-scale-in overflow-hidden">
                    
                    <!-- Decorative top accent -->
                    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-green/50 to-transparent"></div>
                    <div class="absolute -top-10 right-0 w-48 h-48 bg-brand-green/5 rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Drag Handle (Mobile Only) -->
                    <div class="w-10 h-1 bg-brand-border rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden"></div>

                    <!-- Header (Fixed) -->
                    <div class="px-6 py-4 border-b border-brand-border/50 flex justify-between items-center shrink-0 relative z-10">
                        <div>
                            <h3 class="modal-title text-lg font-black text-brand-text-primary tracking-tight">Nova Transação</h3>
                            <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest font-bold mt-0.5 opacity-70">Registre entradas e saídas</p>
                        </div>
                        <button onclick="window.app.WalletModule.closeTransactionModal()" class="bg-brand-surface-light hover:bg-brand-border rounded-xl p-2.5 text-brand-text-secondary hover:text-brand-text-primary transition-all active:scale-90">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>

                    <!-- Body (Scrollable) -->
                    <form id="transactionForm" class="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar relative z-10">
                        <!-- Amount Block -->
                        <div class="bg-brand-bg rounded-2xl p-5 border border-brand-border/50 relative overflow-hidden">
                            <label class="block text-[10px] font-black text-brand-text-secondary uppercase tracking-widest mb-3">Valor</label>
                            <input type="text" inputmode="numeric" id="amountInput" name="amount" data-currency required 
                                class="w-full bg-transparent text-4xl font-black text-brand-text-primary border-0 p-0 focus:ring-0 placeholder-brand-text-secondary/25 outline-none" 
                                placeholder="R$ 0,00">
                        </div>

                        <!-- Type Selector -->
                        <div class="grid grid-cols-2 gap-3">
                            <label class="p-4 rounded-2xl bg-brand-surface-light/50 border border-brand-border/50 flex items-center justify-center gap-2.5 cursor-pointer has-[:checked]:bg-brand-green/15 has-[:checked]:border-brand-green/40 transition-all group">
                                <input type="radio" name="type" value="income" class="hidden">
                                <div class="w-2 h-2 rounded-full bg-brand-green opacity-0 group-has-[:checked]:opacity-100 transition-all"></div>
                                <span class="text-sm font-bold text-brand-text-secondary group-has-[:checked]:text-brand-green transition-all">💰 Entrada</span>
                            </label>
                            <label class="p-4 rounded-2xl bg-brand-surface-light/50 border border-brand-border/50 flex items-center justify-center gap-2.5 cursor-pointer has-[:checked]:bg-red-500/15 has-[:checked]:border-red-500/40 transition-all group">
                                <input type="radio" name="type" value="expense" class="hidden" checked>
                                <div class="w-2 h-2 rounded-full bg-red-500 opacity-0 group-has-[:checked]:opacity-100 transition-all"></div>
                                <span class="text-sm font-bold text-brand-text-secondary group-has-[:checked]:text-red-400 transition-all">💸 Saída</span>
                            </label>
                        </div>

                        <!-- Description -->
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Descrição</label>
                            <input type="text" name="description" required 
                                class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all placeholder:text-brand-text-secondary/30 font-bold" 
                                placeholder="Ex: Supermercado, Salário...">
                        </div>

                        <!-- Context -->
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Classificação</label>
                            <select id="transactionContext" name="context" required 
                                class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                <option value="personal">👤 Pessoal (PF)</option>
                                <option value="business">💼 Empresa (PJ)</option>
                            </select>
                        </div>

                        <!-- Category -->
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Categoria</label>
                            <select id="transactionCategory" name="categoryId" required 
                                class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                <option value="">Carregando...</option>
                            </select>
                        </div>

                        <!-- Date -->
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Data da Compra</label>
                            <input type="date" name="date" required 
                                class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all font-bold scheme-dark">
                        </div>

                        <!-- Account -->
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Conta</label>
                            <select id="transactionAccount" name="account_id" required 
                                class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-1rem)_center] bg-no-repeat pr-12">
                                <option value="">Carregando contas...</option>
                            </select>
                        </div>

                        <!-- RECURRING TOGGLE -->
                        <div class="bg-brand-bg rounded-2xl p-4 border border-brand-border/50">
                            <label class="flex items-center justify-between cursor-pointer" onclick="event.preventDefault(); document.getElementById('isRecurringInput').click()">
                                <div class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-xl bg-brand-surface flex items-center justify-center">
                                        <span class="text-base">🔄</span>
                                    </div>
                                    <div>
                                        <p class="text-sm font-bold text-brand-text-primary">Repetir Mensalmente?</p>
                                        <p class="text-[10px] text-brand-text-secondary">Cria automaticamente todo mês</p>
                                    </div>
                                </div>
                                <div class="relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
                                    <input type="checkbox" name="isRecurring" id="isRecurringInput" class="sr-only peer">
                                    <div class="w-12 h-6 bg-brand-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                                </div>
                            </label>

                            <div id="recurringOptions" class="hidden mt-4 pt-4 border-t border-brand-border/50 animate-fade-in">
                                <div class="relative">
                                    <label class="absolute -top-2 left-3 bg-brand-bg px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Dia do Vencimento</label>
                                    <input type="number" name="day_of_month" min="1" max="31" 
                                        class="w-full bg-brand-surface rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all font-bold text-center" 
                                        placeholder="Ex: 5">
                                </div>
                                <p class="text-[10px] text-brand-text-secondary mt-2">Será gerado automaticamente todo mês neste dia.</p>
                            </div>
                        </div>

                        <!-- BILLING TOGGLE -->
                        <div class="bg-brand-bg rounded-2xl p-4 border border-brand-border/50">
                            <label class="flex items-center justify-between cursor-pointer" onclick="event.preventDefault(); document.getElementById('isInstallmentInput').click()">
                                <div class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-xl bg-brand-surface flex items-center justify-center">
                                        <span class="text-base">📅</span>
                                    </div>
                                    <div>
                                        <p class="text-sm font-bold text-brand-text-primary">Compra Parcelada?</p>
                                        <p class="text-[10px] text-brand-text-secondary">Divide o valor em parcelas mensais</p>
                                    </div>
                                </div>
                                <div class="relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
                                    <input type="checkbox" name="isInstallment" id="isInstallmentInput" class="sr-only peer">
                                    <div class="w-12 h-6 bg-brand-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                                </div>
                            </label>

                            <div id="installmentOptions" class="hidden mt-4 pt-4 border-t border-brand-border/50 animate-fade-in">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="relative">
                                        <label class="absolute -top-2 left-3 bg-brand-bg px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Parcelas</label>
                                        <input type="number" name="installmentsCount" min="2" max="60" 
                                            class="w-full bg-brand-surface rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all font-bold text-center" 
                                            placeholder="Ex: 10">
                                    </div>
                                    <div class="relative">
                                        <label class="absolute -top-2 left-3 bg-brand-bg px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Vencimento</label>
                                        <input type="number" name="installmentDay" min="1" max="31" 
                                            class="w-full bg-brand-surface rounded-xl border border-brand-border p-4 text-brand-text-primary text-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 outline-none transition-all font-bold text-center" 
                                            placeholder="Dia">
                                    </div>
                                </div>
                                <p class="text-[10px] text-brand-text-secondary mt-2">O valor total será dividido pelo número de parcelas.</p>
                            </div>
                        </div>
                        
                        <!-- Extra padding for scroll safety -->
                        <div class="pb-32 md:pb-0"></div>
                    </form>

                    <!-- Footer (Fixed) -->
                    <div class="p-5 border-t border-brand-border/50 bg-brand-surface rounded-b-3xl shrink-0 safe-area-bottom z-10 relative">
                        <button type="submit" form="transactionForm" 
                            class="w-full bg-brand-green hover:bg-emerald-400 text-brand-darker font-black py-4 rounded-2xl shadow-xl shadow-brand-green/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest">
                            Salvar Transação
                        </button>
                    </div>
                </div>
            </div>

            <!-- MODAL DELETE CONFIRMATION -->
    <div id="deleteConfirmationModal" class="fixed inset-0 z-[60] hidden">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-5">
            <div class="bg-brand-surface border border-red-500/20 rounded-3xl p-7 shadow-2xl relative overflow-hidden">
                <!-- Decorative red glow -->
                <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                <div class="absolute -top-10 -right-10 w-48 h-48 bg-red-500/8 rounded-full blur-3xl pointer-events-none"></div>
                <!-- Content -->
                <div class="relative z-10">
                    <div class="w-14 h-14 bg-red-500/15 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </div>
                    <h3 class="text-xl font-black text-brand-text-primary text-center mb-2 tracking-tight">Excluir Transação?</h3>
                    <p class="text-brand-text-secondary text-sm text-center mb-7 leading-relaxed">Essa ação é permanente e não pode ser desfeita.</p>
                    <div class="flex gap-3">
                        <button id="cancelDeleteBtn" class="flex-1 py-3.5 rounded-2xl font-bold text-brand-text-secondary bg-brand-bg border border-brand-border/50 hover:bg-brand-surface-light transition-all active:scale-95" onclick="window.app.WalletModule.closeDeleteModal()">Cancelar</button>
                        <button id="confirmDeleteBtn" class="flex-1 py-3.5 rounded-2xl font-black text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all active:scale-95">Excluir</button>
                    </div>
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
            projectedBalance: document.getElementById('walletProjectedBalance'),
            totalIncome: document.getElementById('walletTotalIncome'),
            totalExpenses: document.getElementById('walletTotalExpenses'),
            summaryCharts: document.getElementById('walletSummaryCharts'),
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

        // Import Statement
        const importBtn = document.getElementById('importStatementBtn');
        const fileInput = document.getElementById('statementFileInput');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleImportStatement(e.target.files[0]);
                    e.target.value = ''; // Reset for same file selection
                }
            });
        }
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

        // Calculate and displayed Projected Balance
        if (this.dom.projectedBalance) {
            // Get the last second of the current viewed month
            const year = this.state.currentDate.getFullYear();
            const month = this.state.currentDate.getMonth();
            const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

            const projectedCents = TransactionService.getProjectedBalance(endOfMonth);
            this.dom.projectedBalance.textContent = this.formatCurrency(projectedCents / 100);
        }
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

        // Clear existing content safely
        this.dom.list.innerHTML = '';

        if (transactions.length === 0) {
            const emptyState = createElement('div', { className: 'flex flex-col items-center justify-center py-12 text-center animate-fade-in-up' }, [
                createElement('div', { className: 'w-24 h-24 bg-brand-surface-light rounded-full flex items-center justify-center mb-6' },
                    createElement('span', { className: 'text-4xl' }, '💸')
                ),
                createElement('h3', { className: 'text-xl font-bold text-brand-text-primary mb-2' }, 'Nada por aqui... ainda!'),
                createElement('p', { className: 'text-brand-text-secondary max-w-[250px] mb-6' }, 'Suas transações aparecerão aqui. Que tal começar agora?'),
                createElement('button', {
                    className: 'px-6 py-3 bg-brand-gold text-brand-text-primary rounded-xl font-bold hover:bg-brand-gold-light transition shadow-glow-gold',
                    onclick: () => { window.app.navigateTo('wallet'); document.querySelector('#wallet-add-btn')?.click(); }
                }, 'Registrar Transação')
            ]);
            this.dom.list.appendChild(emptyState);
            return;
        }

        // Group by Date
        const grouped = this.groupByDate(transactions);

        // --- MOBILE VIEW (CARDS) ---
        const mobileContainer = createElement('div', { className: 'md:hidden space-y-6' });

        Object.entries(grouped).forEach(([date, items]) => {
            const group = createElement('div', { className: 'animate-fade-in-up' }, [
                createElement('h3', { className: 'text-xs font-bold text-brand-text-secondary uppercase tracking-widest mb-3 ml-1 sticky top-0 bg-brand-bg/95 backdrop-blur py-2 z-10' }, this.formatDateHeader(date)),
                createElement('div', { className: 'bg-brand-surface shadow-card-sm border border-brand-border rounded-2xl overflow-hidden' },
                    items.map(t => this.createTransactionCard(t))
                )
            ]);
            mobileContainer.appendChild(group);
        });

        this.dom.list.appendChild(mobileContainer);

        // --- DESKTOP VIEW (TABLE) ---
        const desktopContainer = createElement('div', { className: 'hidden md:block bg-brand-surface border border-brand-border rounded-2xl overflow-hidden shadow-sm animate-fade-in' });

        const table = createElement('table', { className: 'w-full text-left border-collapse' });

        const thead = createElement('thead', {}, [
            createElement('tr', { className: 'border-b border-brand-border bg-brand-surface-light/50' }, [
                createElement('th', { className: 'p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider' }, 'Data'),
                createElement('th', { className: 'p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider' }, 'Categoria / Descrição'),
                createElement('th', { className: 'p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider' }, 'Conta'),
                createElement('th', { className: 'p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider' }, 'Status'),
                createElement('th', { className: 'p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider text-right' }, 'Valor'),
                createElement('th', { className: 'p-4 py-5 text-xs font-bold text-brand-text-secondary uppercase tracking-wider text-right' }, 'Ações')
            ])
        ]);

        const tbody = createElement('tbody', { className: 'divide-y divide-brand-border' },
            transactions.map(t => this.createTransactionRow(t))
        );

        table.appendChild(thead);
        table.appendChild(tbody);
        desktopContainer.appendChild(table);

        this.dom.list.appendChild(desktopContainer);
    },

    updateBalanceDisplay() {
        if (!this.dom.totalBalance) return;
        const total = this.state.transactions.reduce((acc, t) => {
            const val = parseInt(t.amount || 0);
            return t.type === 'income' ? acc + val : acc - val;
        }, 0);
        this.dom.totalBalance.textContent = Money.format(total, true);
    },

    createTransactionRow(t) {
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
        const iconElement = this.createIconElement(categoryIcon); // Helper needed or inline

        // Create Row
        return createElement('tr', { className: 'hover:bg-brand-surface-light/50 transition duration-150 group' }, [
            createElement('td', { className: 'p-4 text-sm text-brand-text-secondary font-medium whitespace-nowrap' }, `${day}/${month}/${year}`),
            createElement('td', { className: 'p-4' },
                createElement('div', { className: 'flex items-center gap-3' }, [
                    createElement('div', {
                        className: 'w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg',
                        style: `background-color: ${categoryColor}20; color: ${categoryColor};`
                    }, [iconElement]),
                    createElement('div', {}, [
                        createElement('p', { className: 'text-sm font-bold text-brand-text-primary text-ellipsis overflow-hidden' }, t.description),
                        createElement('p', { className: 'text-xs text-brand-text-secondary' }, t.categories?.name || 'Geral')
                    ])
                ])
            ),
            createElement('td', { className: 'p-4' },
                createElement('div', { className: 'flex items-center gap-2' }, [
                    createElement('span', { className: 'text-xs font-bold px-2 py-1 rounded bg-brand-bg border border-brand-border text-brand-text-secondary' }, t.accounts?.name || 'Conta'),
                    t.context === 'business' ? createElement('span', { className: 'text-[9px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold' }, 'PJ') : null
                ])
            ),
            createElement('td', { className: 'p-4' },
                createElement('span', { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}` },
                    t.status === 'paid' ? 'Pago' : 'Pendente'
                )
            ),
            createElement('td', { className: 'p-4 text-right' },
                createElement('span', { className: `text-sm font-bold ${colorClass} value-sensitive tabular-nums` },
                    `${sign} ${Money.format(t.amount, true)}`
                )
            ),
            createElement('td', { className: 'p-4 text-right' },
                createElement('div', { className: 'flex items-center justify-end gap-2 opacity-100 group-hover:opacity-100 transition-opacity' }, [
                    createElement('button', {
                        className: 'p-2 text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-bg rounded-lg transition',
                        title: 'Editar',
                        onclick: () => window.app.WalletModule.openEdit(t.id)
                    }, [
                        createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            createElement('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                        )
                    ]),
                    createElement('button', {
                        className: 'p-2 text-brand-text-secondary hover:text-red-500 hover:bg-red-50/10 rounded-lg transition',
                        title: 'Excluir',
                        onclick: () => window.app.WalletModule.askDelete(t.id)
                    }, [
                        createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            createElement('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                        )
                    ])
                ])
            )
        ]);
    },

    createTransactionCard(t) {
        const isExpense = t.type === 'expense';
        const colorClass = isExpense ? 'text-brand-red' : 'text-brand-green';
        const sign = isExpense ? '-' : '+';
        const categoryColor = t.categories?.color || '#6c757d';
        const categoryIcon = t.categories?.icon || 'fa-tag';
        const iconElement = this.createIconElement(categoryIcon);

        return createElement('div', {
            className: 'flex items-center p-4 border-b border-brand-border last:border-0 hover:bg-brand-surface-light active:bg-brand-surface-light transition-colors group cursor-pointer',
            onclick: () => window.app.WalletModule.openEdit(t.id)
        }, [
            // Icon
            createElement('div', {
                className: 'w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0',
                style: `background-color: ${categoryColor}20; color: ${categoryColor};`
            }, [
                createElement('span', { className: 'text-lg' }, [iconElement])
            ]),

            // Text (Click to Edit)
            createElement('div', {
                className: 'flex-grow min-w-0 cursor-pointer',
                onclick: () => window.app.WalletModule.openEdit(t.id)
            }, [
                createElement('div', { className: 'flex items-center gap-2 mb-1' }, [
                    createElement('h4', { className: 'text-sm font-bold text-brand-text-primary truncate' }, t.description),
                    t.context === 'business' ? createElement('span', { className: 'text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-bold' }, 'PJ') : null
                ]),
                createElement('p', { className: 'text-xs text-brand-text-secondary truncate' }, [
                    t.categories?.name || 'Geral',
                    t.payment_method ? ` • ${this.formatPaymentMethod(t.payment_method)}` : ''
                ])
            ]),

            // Value
            createElement('div', { className: 'text-right ml-4 shrink-0' }, [
                createElement('div', { className: `font-bold text-sm ${colorClass} value-sensitive` },
                    `${sign} ${Money.format(t.amount, true)}`
                )
            ]),

            // Actions (Visible on Hover / Swipe)
            createElement('div', { className: 'ml-4 flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity' }, [
                createElement('button', {
                    className: 'btn-delete p-2 text-brand-text-secondary hover:text-red-500 transition',
                    'data-id': t.id,
                    onclick: (e) => { e.stopPropagation(); window.app.WalletModule.askDelete(t.id); }
                }, [
                    createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        createElement('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' })
                    )
                ])
            ])
        ]);
    },

    createIconElement(icon) {
        if (icon.includes('fa-')) {
            return createElement('i', { className: `fas ${icon}` });
        }
        return document.createTextNode(icon);
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

        // Clear and add default option
        this.dom.categorySelect.innerHTML = '';
        this.dom.categorySelect.appendChild(createElement('option', { value: '', disabled: true, selected: true }, 'Selecione...'));

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

            // Filter to prioritize these specific categories but NOT exclude others
            // We match by Name (Case Insensitive)
            const required = categoriesToRender.filter(cat =>
                REQUIRED_CATEGORIES.some(req => req.toLowerCase() === cat.name.toLowerCase())
            );

            const others = categoriesToRender.filter(cat =>
                !REQUIRED_CATEGORIES.some(req => req.toLowerCase() === cat.name.toLowerCase())
            );

            // Sort required in the specific order requested
            required.sort((a, b) => {
                const indexA = REQUIRED_CATEGORIES.findIndex(r => r.toLowerCase() === a.name.toLowerCase());
                const indexB = REQUIRED_CATEGORIES.findIndex(r => r.toLowerCase() === b.name.toLowerCase());
                return indexA - indexB;
            });

            categoriesToRender = [...required, ...others];
        }

        // Render Options
        categoriesToRender.forEach(cat => {
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

            const label = emoji ? `${emoji} ${cat.name}` : cat.name;
            this.dom.categorySelect.appendChild(createElement('option', { value: cat.id }, label));
        });

        // Restore selection if it still exists in the filtered list
        if (currentVal && categoriesToRender.some(c => c.id == currentVal)) {
            this.dom.categorySelect.value = currentVal;
        } else if (currentVal) {
            // If the current value was filtered out (because it's not in the Required List),
            // we should probably fetch it from full list and append it so it's valid?
            const missingCat = this.state.categories.find(c => c.id == currentVal);
            if (missingCat) {
                const icon = (missingCat.icon && missingCat.icon.includes('fa-')) ? '' : (missingCat.icon || '');
                const label = `${icon} ${missingCat.name} (Antigo)`;
                this.dom.categorySelect.appendChild(createElement('option', { value: missingCat.id }, label));
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
            const btn = createElement('button', {
                id: 'manage-cats-btn',
                type: 'button',
                className: 'text-xs text-brand-gold font-bold uppercase mt-2 hover:underline flex items-center gap-1',
                onclick: () => {
                    // Close modal and go to settings? Or open settings modal?
                    // Ideally preserve state? For now, navigate.
                    if (confirm('Deseja ir para Configurações gerenciar as categorias? Os dados não salvos desta transação serão perdidos.')) {
                        window.app.WalletModule.closeTransactionModal();
                        window.app.navigateTo('settings');
                    }
                }
            }, [
                createElement('i', { className: 'fas fa-cog' }),
                ' Gerenciar Categorias'
            ]);
            parent.appendChild(btn);
        }
    },

    setLoading(isLoading, isReset) {
        this.state.isLoading = isLoading;
        if (this.dom.loader && isReset) {
            this.dom.loader.style.display = isLoading ? 'flex' : 'none';
        }

        if (this.dom.loadMoreBtn) {
            this.dom.loadMoreBtn.innerHTML = '';
            if (isLoading) {
                this.dom.loadMoreBtn.appendChild(createElement('i', { className: 'fas fa-spinner fa-spin' }));
            } else {
                this.dom.loadMoreBtn.textContent = 'Carregar Mais';
            }
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

        // Clear existing content
        list.innerHTML = '';
        list.appendChild(createElement('div', { className: 'animate-pulse space-y-3' }, [
            createElement('div', { className: 'h-20 bg-brand-surface-light rounded-2xl w-full' }),
            createElement('div', { className: 'h-20 bg-brand-surface-light rounded-2xl w-full' })
        ]));

        const recurring = await TransactionService.getRecurringDefinitions();
        const totalRecurring = recurring.reduce((acc, r) => acc + Number(r.amount), 0);

        // Get Income for context (Committed Income)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const stats = await TransactionService.getFinancialStatement(currentMonth, currentYear);

        const income = (stats && stats.revenue) ? stats.revenue : 1; // avoid div by zero
        const committedPercent = Math.min((totalRecurring / income) * 100, 100).toFixed(1);

        // Clear skeleton
        list.innerHTML = '';

        // Committed Income Widget
        const widget = createElement('div', { className: 'bg-brand-surface-light p-6 rounded-2xl border border-brand-border mb-6' }, [
            createElement('div', { className: 'flex justify-between items-end mb-2' }, [
                createElement('div', {}, [
                    createElement('p', { className: 'text-xs text-brand-text-secondary uppercase tracking-widest font-bold' }, 'Custo Fixo Mensal'),
                    createElement('h3', { className: 'text-2xl font-black text-brand-text-primary value-sensitive' }, Money.format(totalRecurring, true))
                ]),
                createElement('div', { className: 'text-right' }, [
                    createElement('p', { className: `text-xs text-${committedPercent > 50 ? 'brand-red' : 'brand-green'} font-bold` }, `${committedPercent}% da Renda`)
                ])
            ]),
            createElement('div', { className: 'h-2 bg-brand-surface-light rounded-full overflow-hidden' }, [
                createElement('div', {
                    className: `h-full bg-${committedPercent > 50 ? 'brand-red' : 'brand-green'} transition-all duration-1000`,
                    style: `width: ${committedPercent}%`
                })
            ]),
            createElement('p', { className: 'text-[10px] text-brand-text-secondary mt-2' }, 'Valor comprometido antes mesmo do mês começar.')
        ]);
        list.appendChild(widget);

        // Credit Cards Section
        const creditCardsSection = await this.renderCreditCardsSection();
        list.appendChild(creditCardsSection);

        // Active Subscriptions
        list.appendChild(createElement('h3', { className: 'text-sm font-bold text-brand-text-secondary uppercase mb-4 px-2' }, 'Assinaturas Ativas'));

        const subList = createElement('div', { className: 'space-y-3' });

        if (recurring.length === 0) {
            subList.appendChild(createElement('div', { className: 'text-center py-12' }, [
                createElement('div', { className: 'w-16 h-16 bg-brand-surface-light rounded-full flex items-center justify-center mx-auto mb-4 text-3xl' }, '🔄'),
                createElement('p', { className: 'text-brand-text-secondary text-sm' }, 'Nenhuma assinatura ou conta fixa cadastrada.'),
                createElement('p', { className: 'text-gray-600 text-xs mt-2' }, 'Adicione uma transação e marque "Repetir Mensalmente".')
            ]));
        } else {
            recurring.forEach(r => {
                subList.appendChild(createElement('div', { className: 'bg-brand-surface-light p-4 rounded-2xl border border-brand-border flex items-center justify-between' }, [
                    createElement('div', { className: 'flex items-center gap-4' }, [
                        createElement('div', { className: 'w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold font-bold text-xs uppercase' },
                            r.description ? r.description.substring(0, 2) : '??'
                        ),
                        createElement('div', {}, [
                            createElement('h4', { className: 'font-bold text-brand-text-primary text-sm' }, r.description),
                            createElement('p', { className: 'text-xs text-brand-text-secondary' }, `Todo dia ${r.day_of_month}`)
                        ])
                    ]),
                    createElement('div', { className: 'font-bold text-brand-text-primary value-sensitive' }, Money.format(r.amount, true))
                ]));
            });
        }
        list.appendChild(subList);
    },

    async renderCreditCardsSection() {
        await CreditCardService.init();
        const cards = CreditCardService.cards;
        const container = createElement('div', { className: 'mb-6' });

        const header = createElement('div', { className: 'flex justify-between items-center mb-4 px-2' }, [
            createElement('h3', { className: 'text-sm font-bold text-brand-text-secondary uppercase' }, '💳 Cartões de Crédito'),
            createElement('button', {
                className: 'text-xs text-brand-gold font-bold hover:underline',
                onclick: () => window.app.openCreditCardModal()
            }, '+ Novo')
        ]);
        container.appendChild(header);

        if (cards.length === 0) {
            const emptyState = createElement('div', { className: 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-6 text-center' }, [
                createElement('div', { className: 'w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl' }, '💳'),
                createElement('p', { className: 'text-sm text-brand-text-secondary' }, 'Nenhum cartão cadastrado'),
                createElement('button', {
                    className: 'mt-3 text-xs bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg hover:bg-purple-500/30 transition font-bold',
                    onclick: () => window.app.openCreditCardModal()
                }, 'Adicionar Cartão')
            ]);
            container.appendChild(emptyState);
            return container;
        }

        const today = new Date();
        const currentDay = today.getDate();
        const cardsList = createElement('div', { className: 'space-y-4' });

        cards.forEach(card => {
            const daysUntilDue = card.billing_day >= currentDay
                ? card.billing_day - currentDay
                : (new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - currentDay) + card.billing_day;
            const isDueSoon = daysUntilDue <= 5;
            const invoiceAmountCents = card.current_invoice || 0;
            const limitUsed = card.credit_limit ? ((invoiceAmountCents / card.credit_limit) * 100) : 0;

            const cardEl = createElement('div', { className: 'bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-5 relative overflow-hidden shadow-xl' }, [
                // Design Elements
                createElement('div', { className: 'absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2' }),
                createElement('div', { className: 'absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2' }),

                // Content
                createElement('div', { className: 'relative z-10' }, [
                    // Header
                    createElement('div', { className: 'flex justify-between items-start mb-4' }, [
                        createElement('div', {}, [
                            createElement('p', { className: 'text-purple-200 text-[10px] uppercase tracking-widest font-bold' }, 'Fatura Atual'),
                            createElement('h4', { className: 'text-2xl font-black text-white value-sensitive' }, Money.format(invoiceAmountCents, true))
                        ]),
                        createElement('div', { className: 'text-right' }, [
                            createElement('p', { className: 'text-white font-bold text-sm' }, card.name),
                            card.last_digits ? createElement('p', { className: 'text-purple-200 text-xs' }, `**** ${card.last_digits}`) : null
                        ])
                    ]),

                    // Due Date
                    createElement('div', { className: 'flex justify-between items-center mb-4' }, [
                        createElement('p', { className: 'text-purple-200 text-xs' }, [
                            '📅 Vence dia ',
                            createElement('span', { className: 'text-white font-bold' }, card.billing_day),
                            isDueSoon ? createElement('span', { className: 'text-yellow-300 ml-1' }, `(em ${daysUntilDue} dias)`) : null
                        ]),
                        card.credit_limit ? createElement('p', { className: 'text-purple-200 text-xs' }, [
                            'Pendentes: ',
                            createElement('span', { className: 'text-white font-bold' }, Money.format(invoiceAmountCents, true))
                        ]) : null
                    ]),

                    // Limit Progress Bar
                    card.credit_limit ? createElement('div', { className: 'h-1.5 bg-purple-900/50 rounded-full overflow-hidden mb-4' }, [
                        createElement('div', {
                            className: 'h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all',
                            style: `width: ${Math.min(limitUsed, 100)}%`
                        })
                    ]) : null,

                    // Action Buttons
                    createElement('div', { className: 'flex gap-2' }, [
                        createElement('button', {
                            className: 'flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1',
                            onclick: () => window.app.openAddPurchaseModal(card.id)
                        }, [
                            createElement('span', {}, '➕'), ' Compra'
                        ]),
                        createElement('button', {
                            className: 'flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1',
                            onclick: () => window.app.viewCardInvoice(card.id)
                        }, [
                            createElement('span', {}, '📋'), ' Ver Fatura'
                        ]),
                        invoiceAmountCents > 0 ? createElement('button', {
                            className: 'flex-1 bg-green-500/30 hover:bg-green-500/50 text-green-300 text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center gap-1',
                            onclick: () => window.app.payCreditCardInvoice(card.id, card.name, card.current_invoice)
                        }, [
                            createElement('span', {}, '✅'), ' Pagar'
                        ]) : null
                    ])
                ])
            ]);
            cardsList.appendChild(cardEl);
        });

        container.appendChild(cardsList);
        return container;
    },

    async handleImportStatement(file) {
        Toast.show('Processando arquivo com OCR...', 'info');
        try {
            // We use 'por' for Portuguese language
            const { data: { text } } = await Tesseract.recognize(file, 'por', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });

            console.log('OCR Text Result:', text);

            const extractedTransactions = this.parseStatementText(text);

            if (extractedTransactions && extractedTransactions.length > 0) {
                if (extractedTransactions.length === 1) {
                    // Single transaction (like a Pix receipt) -> Open Modal for review
                    this.openTransactionModal('create', null, false, extractedTransactions[0]);
                    Toast.show('1 transação encontrada. Verifique os dados.', 'success');
                    HapticService.success();
                } else {
                    // Fetch accounts to let user choose where to import
                    const accounts = AccountsService.accounts.filter(a => a.is_active) || [];
                    // Multiple transactions -> Show Bulk Review Modal
                    this.openBulkOCRReviewModal(extractedTransactions, accounts);
                }
            } else {
                Toast.show('Não foi possível identificar transações claras. Tente uma imagem mais nítida.', 'warning');
                HapticService.warning();
            }
        } catch (error) {
            console.error('OCR Error:', error);
            Toast.show('Erro ao processar imagem. Verifique sua conexão.', 'error');
            HapticService.error();
        }
    },

    openBulkOCRReviewModal(transactions, accounts = []) {
        HapticService.light();

        const overlay = createElement('div', {
            className: 'fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4 sm:p-6',
            id: 'ocr-bulk-modal'
        });

        // Account Selector Element
        const accountSelect = createElement('select', {
            className: 'w-full md:w-auto bg-brand-surface border border-brand-border rounded-lg px-2 py-1.5 text-sm text-brand-text-primary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors shadow-sm font-semibold max-w-[150px]',
            id: 'bulk-account-select'
        }, [
            createElement('option', { value: '' }, 'Selecionar Conta')
        ]);

        accounts.forEach(acc => {
            const isMain = acc.is_main || false;
            accountSelect.appendChild(createElement('option', {
                value: acc.id,
                selected: isMain // auto select main account if exists
            }, acc.name));
        });

        const modal = createElement('div', {
            className: 'bg-brand-surface border border-brand-border/50 w-full max-w-lg rounded-t-[1.5rem] sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-slide-up sm:animate-scale-in'
        }, [
            createElement('div', { className: 'p-4 border-b border-brand-border flex justify-between items-center z-10 bg-brand-surface sm:rounded-t-2xl shadow-sm gap-2' }, [
                createElement('h3', { className: 'text-base font-bold text-brand-text-primary truncate flex-1', id: 'bulk-modal-title' }, `Revisar ${transactions.length} Transações`),
                accountSelect,
                createElement('button', {
                    className: 'p-2 rounded-full hover:bg-brand-surface-light text-brand-text-secondary transition-colors shrink-0',
                    onclick: () => document.getElementById('ocr-bulk-modal').remove()
                }, '✕')
            ])
        ]);

        const listContainer = createElement('div', { className: 'flex-1 overflow-y-auto p-4 space-y-4 pt-6' });

        transactions.forEach((tx, index) => {
            const amountCents = Math.round(tx.amount * 100);

            const card = createElement('div', { className: 'bg-brand-surface-light p-3 rounded-xl shadow-sm border border-brand-border flex flex-col gap-3 relative' });

            // Delete Button
            const btnRemove = createElement('button', {
                className: 'absolute -top-3 -right-2 bg-brand-surface border border-brand-border text-brand-text-secondary rounded-full p-2 shadow-sm hover:!bg-accent-danger hover:!text-white hover:!border-accent-danger transition-colors z-10',
                onclick: () => {
                    tx._deleted = true;
                    card.style.display = 'none';
                    const remaining = transactions.filter(t => !t._deleted).length;
                    document.getElementById('bulk-modal-title').innerText = `Revisar ${remaining} Transações`;
                }
            });
            btnRemove.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;

            const topRow = createElement('div', { className: 'flex gap-2 items-center' });

            // Editable Description
            const inputDesc = createElement('input', {
                type: 'text',
                value: tx.description,
                className: 'flex-1 bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text-primary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors shadow-sm',
                onchange: (e) => tx.description = e.target.value
            });

            // Editable Amount
            const inputAmount = createElement('input', {
                type: 'text',
                value: typeof CurrencyMask !== 'undefined' ? CurrencyMask.format(amountCents.toString()) : `R$ ${tx.amount.toFixed(2)}`,
                className: `w-28 text-right bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm font-bold focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors shadow-sm ${tx.type === 'expense' ? 'text-accent-danger' : 'text-accent-success'}`,
                oninput: (e) => {
                    if (typeof CurrencyMask !== 'undefined') {
                        CurrencyMask.apply(e);
                    }
                },
                onblur: (e) => {
                    if (typeof CurrencyMask !== 'undefined') {
                        const unmasked = CurrencyMask.unmask(e.target.value);
                        tx.amount = unmasked / 100;
                    } else {
                        const val = parseFloat(e.target.value.replace(/[^0-9,-]+/g, '').replace(',', '.'));
                        if (!isNaN(val)) tx.amount = Math.abs(val);
                    }
                }
            });

            topRow.appendChild(inputDesc);
            topRow.appendChild(inputAmount);

            const bottomRow = createElement('div', { className: 'flex justify-between items-center text-sm gap-2' });

            // Editable Date
            const inputDate = createElement('input', {
                type: 'date',
                value: tx.date,
                className: 'flex-1 bg-brand-surface border border-brand-border rounded-lg px-2 py-1.5 text-brand-text-secondary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors',
                onchange: (e) => tx.date = e.target.value
            });

            // Editable Type
            const selectType = createElement('select', {
                className: 'w-24 bg-brand-surface border border-brand-border rounded-lg px-2 py-1.5 text-brand-text-secondary focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors text-xs',
                onchange: (e) => {
                    tx.type = e.target.value;
                    inputAmount.classList.remove('text-accent-danger', 'text-accent-success');
                    inputAmount.classList.add(tx.type === 'expense' ? 'text-accent-danger' : 'text-accent-success');
                }
            }, [
                createElement('option', { value: 'expense', selected: tx.type === 'expense' }, 'Despesa'),
                createElement('option', { value: 'income', selected: tx.type === 'income' }, 'Receita')
            ]);

            bottomRow.appendChild(inputDate);
            bottomRow.appendChild(selectType);

            card.appendChild(btnRemove);
            card.appendChild(topRow);
            card.appendChild(bottomRow);

            listContainer.appendChild(card);
        });

        modal.appendChild(listContainer);

        const footer = createElement('div', { className: 'p-4 border-t border-brand-border bg-brand-surface sm:rounded-b-2xl flex gap-3 pb-safe z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' }, [
            createElement('button', {
                className: 'flex-1 py-3 px-4 rounded-xl border border-brand-border text-brand-text-secondary font-semibold hover:bg-brand-surface-light transition',
                onclick: () => document.getElementById('ocr-bulk-modal').remove()
            }, 'Cancelar'),
            createElement('button', {
                className: 'flex-1 py-3 px-4 rounded-xl bg-brand font-bold text-white shadow-lg hover:bg-brand-600 transition',
                onclick: async (e) => {
                    const validTx = transactions.filter(t => !t._deleted);
                    if (validTx.length === 0) {
                        Toast.show('Nenhuma transação selecionada.', 'warning');
                        return;
                    }

                    const accountSelect = document.getElementById('bulk-account-select');
                    const selectedAccountId = accountSelect ? accountSelect.value : null;

                    const btn = e.target;
                    btn.disabled = true;
                    btn.innerHTML = 'Importando...';

                    let successCount = 0;
                    for (const tx of validTx) {
                        try {
                            const txPayload = {
                                amount: Math.round(tx.amount * 100),
                                description: tx.description,
                                date: tx.date,
                                type: tx.type,
                                payment_method: 'money',
                                category_id: null
                            };

                            if (selectedAccountId) {
                                txPayload.account_id = selectedAccountId;
                            }

                            await window.app.TransactionService.createTransaction(txPayload);
                            successCount++;
                        } catch (err) {
                            console.error('OCR Batch Insert Error:', err);
                        }
                    }

                    document.getElementById('ocr-bulk-modal').remove();
                    await this.loadData();
                    Toast.show(`${successCount} de ${validTx.length} importadas com sucesso!`, 'success');
                    HapticService.success();
                }
            }, 'Sincronizar')
        ]);

        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    },

    parseStatementText(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Date: DD/MM/YYYY or DD/MM/YY or DD/MM or "1de Agosto de 2025" or "15 de Agosto"
        const dateRegexMatchList = [
            /(\d{2})\/(\d{2})(?:\/(\d{4}|\d{2}))?/,
            /(\d{1,2})\s+de\s+([a-zA-Z]+)(?:\s+de\s+(\d{4}))?/i
        ];
        // Amount: R$ 1.234,56 or -150,00 or 1.500,00 or AS 1.300,00
        const amountRegex = /(?:R\$|AS|As|A\$|RS|)[\s]*(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/;

        let transactions = [];
        let currentYear = new Date().getFullYear();

        // 1. Group lines into logical "Chunks" (e.g. 3-4 lines that belong together)
        // A new chunk often starts when we see a strong keyword or a new date.
        // But for simplicity, let's just slide a window over the lines.

        let pendingDesc = "";
        let pendingAmount = null;
        let pendingDate = null;
        let pendingIsExpense = true;

        const pushTransaction = () => {
            if (pendingAmount !== null) {
                transactions.push({
                    amount: pendingAmount,
                    description: pendingDesc || "Transação OCR",
                    date: pendingDate || new Date().toISOString().split('T')[0],
                    type: pendingIsExpense ? 'expense' : 'income'
                });
                // reset for next
                pendingDesc = "";
                pendingAmount = null;
                pendingDate = null;
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();

            // Look for Date
            let foundDate = null;
            for (const dRegex of dateRegexMatchList) {
                const dateMatch = line.match(dRegex);
                if (dateMatch) {
                    if (dateMatch[0].includes('de')) {
                        // Semantic date: "15 de Agosto de 2025"
                        let d = dateMatch[1].padStart(2, '0');
                        let mName = dateMatch[2].toLowerCase();
                        let y = dateMatch[3] || currentYear.toString();

                        const months = { 'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12' };
                        let m = months[mName] || '01';
                        foundDate = `${y}-${m}-${d}`;
                    } else {
                        // Numeric date
                        let d = dateMatch[1];
                        let m = dateMatch[2];
                        let y = dateMatch[3] || currentYear.toString();
                        if (y.length === 2) y = '20' + y;
                        foundDate = `${y}-${m}-${d}`;
                    }
                    break;
                }
            }

            if (foundDate) {
                pendingDate = foundDate;
            }

            // Look for Amount
            // Avoid interpreting strings of digits like "1246205" as an amount unless it has a comma/dot for decimals or has R$ prefix
            // To be safer, we look for explicit currency markers or valid decimals
            const strictAmountRegex = /(?:R\$|AS|As|A\$|RS)\s*(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/;
            let amountMatch = line.match(strictAmountRegex);

            // Fallback to looser if no strict match, but it MUST have a comma for cents to avoid IDs
            if (!amountMatch) {
                const looseAmountRegex = /(-?\d{1,3}(?:\.\d{3})*(?:,\d{2}))/;
                amountMatch = line.match(looseAmountRegex);
            }

            if (amountMatch && !lowerLine.includes('saldo')) {
                const rawAmountStr = amountMatch[1];
                const amountStr = rawAmountStr.replace(/\./g, '').replace(',', '.');
                const parsed = parseFloat(amountStr);

                if (!isNaN(parsed) && parsed !== 0) {
                    pendingAmount = Math.abs(parsed);

                    if (rawAmountStr.includes('-') || lowerLine.includes(' d ') || lowerLine.endsWith(' d') || lowerLine.includes('enviado') || lowerLine.includes('pagamento efetuado')) {
                        pendingIsExpense = true;
                    } else if (lowerLine.includes(' c ') || lowerLine.endsWith(' c') || lowerLine.includes('recebido') || lowerLine.includes('recebida') || parsed > 0 && !rawAmountStr.includes('-')) {
                        pendingIsExpense = false;
                    } else {
                        pendingIsExpense = true; // default
                    }
                }
            }

            // Look for Description
            // If the line starts with a keyword, use it as description backbone
            if (lowerLine.startsWith('pix enviado:') || lowerLine.startsWith('pix recebido:') || lowerLine.startsWith('pagamento efetuado:') || lowerLine.startsWith('ph recebida:') || lowerLine.startsWith('ph recebido:')) {
                // If we already had an amount pending, we should probably commit the PREVIOUS transaction
                if (pendingAmount !== null) {
                    pushTransaction();
                }

                // Extract description
                let cleanLine = line.replace(/Pix enviado:|Pix recebido:|Pagamento efetuado:|Ph recebida:|Ph recebido:/i, '').trim();
                // Remove the quote marks around CNPJ/names often found in OCR
                cleanLine = cleanLine.replace(/["“”]/g, '').trim();
                // Try to strip trailing amounts from description
                if (amountMatch) {
                    cleanLine = cleanLine.replace(amountMatch[0], '').trim();
                }
                pendingDesc = cleanLine;
            }

            // Try to commit transaction if we have both an amount and description (or if we hit a new date)
            // But sometimes the date comes on the NEXT line
            if (pendingAmount !== null && pendingDesc !== "") {
                // look ahead one line for date if we don't have it yet
                if (!pendingDate && i + 1 < lines.length) {
                    let nextLineMatch = lines[i + 1].match(dateRegexMatchList[0]) || lines[i + 1].match(dateRegexMatchList[1]);
                    if (nextLineMatch) {
                        // We let the loop naturally pick it up on next iteration to keep logic clean, 
                        // or we can wait to push until we're sure we have a date or hit a new transaction start.
                    }
                }
            }
        }

        // Push the last one if lingering
        pushTransaction();

        // Fallback: If no transactions were found via the structured list logic, maybe it's a standalone receipt where data is scattered
        if (transactions.length === 0) {
            let bestDateStr = null;
            let bestAmount = null;
            let isExpense = true;
            let bestDescription = "Transação OCR";

            for (const line of lines) {
                const lowerLine = line.toLowerCase();

                if (bestAmount === null) {
                    let amountMatch = line.match(/(?:R\$|AS|As|RS)\s*(-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/);
                    if (!amountMatch) amountMatch = line.match(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{2}))/);
                    if (amountMatch && !lowerLine.includes('saldo')) {
                        const rawAmountStr = amountMatch[1];
                        const amountStr = rawAmountStr.replace(/\./g, '').replace(',', '.');
                        const parsed = parseFloat(amountStr);
                        if (!isNaN(parsed) && parsed !== 0) {
                            bestAmount = Math.abs(parsed);
                            if (parsed < 0 || lowerLine.includes('pagou') || lowerLine.includes('enviado')) {
                                isExpense = true;
                            } else if (lowerLine.includes('recebeu')) {
                                isExpense = false;
                            }
                        }
                    }
                }

                if (bestDateStr === null) {
                    for (const dRegex of dateRegexMatchList) {
                        const dateMatch = line.match(dRegex);
                        if (dateMatch) {
                            if (dateMatch[0].includes('de')) {
                                let d = dateMatch[1].padStart(2, '0');
                                let mName = dateMatch[2].toLowerCase();
                                let y = dateMatch[3] || currentYear.toString();
                                const months = { 'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12' };
                                let m = months[mName] || '01';
                                bestDateStr = `${y}-${m}-${d}`;
                            } else {
                                let d = dateMatch[1];
                                let m = dateMatch[2];
                                let y = dateMatch[3] || currentYear.toString();
                                if (y.length === 2) y = '20' + y;
                                bestDateStr = `${y}-${m}-${d}`;
                            }
                            break;
                        }
                    }
                }

                if (lowerLine.includes('nome ') && lowerLine.indexOf('nome ') === 0) {
                    bestDescription = line.substring(5).trim();
                }
            }

            if (bestAmount !== null) {
                transactions.push({
                    amount: bestAmount,
                    description: bestDescription,
                    date: bestDateStr || new Date().toISOString().split('T')[0],
                    type: isExpense ? 'expense' : 'income'
                });
            }
        }

        return transactions;
    },

    openTransactionModal(mode = 'create', transaction = null, isRecurringDefault = false, prefillData = null) {
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

            // Handle Prefill Data (from OCR)
            if (prefillData) {
                const descInput = this.dom.form.querySelector('[name="description"]');
                if (prefillData.description && descInput) descInput.value = prefillData.description;

                if (prefillData.amount && amountInput) {
                    // amountInput expects formatted string
                    const amountInCents = Math.round(Math.abs(prefillData.amount) * 100);
                    amountInput.value = typeof CurrencyMask !== 'undefined' ? CurrencyMask.format(amountInCents.toString()) : prefillData.amount;
                }

                const dateInput = this.dom.form.querySelector('[name="date"]');
                if (prefillData.date && dateInput) dateInput.value = prefillData.date;

                if (prefillData.type) {
                    const typeRadio = this.dom.form.querySelector(`input[name="type"][value="${prefillData.type}"]`);
                    if (typeRadio) typeRadio.checked = true;
                }
            }

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
    modal.className = 'fixed inset-0 z-50 flex items-end md:items-center justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/75 backdrop-blur-md" onclick="this.parentElement.remove()"></div>
        <div class="relative w-full md:max-w-md bg-brand-surface border-t md:border border-brand-border/60 rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up md:animate-scale-in max-h-[90vh] overflow-y-auto">
            <!-- Accent top line -->
            <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
            <div class="absolute -top-8 -right-8 w-40 h-40 bg-purple-500/8 rounded-full blur-3xl pointer-events-none"></div>

            <!-- Drag Handle -->
            <div class="w-10 h-1 bg-brand-border rounded-full mx-auto mt-3 md:hidden"></div>

            <!-- Header -->
            <div class="px-6 pt-5 pb-4 border-b border-brand-border/50 flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-black text-brand-text-primary tracking-tight">💳 Novo Cartão</h3>
                    <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest mt-0.5 opacity-70">Adicione seu cartão de crédito</p>
                </div>
                <button onclick="this.closest('#credit-card-modal').remove()" class="bg-brand-surface-light hover:bg-brand-border rounded-xl p-2.5 text-brand-text-secondary hover:text-brand-text-primary transition-all">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            
            <!-- Body -->
            <div class="p-6">
                <form id="credit-card-form" class="space-y-5">
                    <div class="relative">
                        <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Nome do Cartão</label>
                        <input type="text" name="name" required class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Nubank, Inter, C6">
                    </div>
                    <div class="relative">
                        <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Banco / Instituição</label>
                        <input type="text" name="bank" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Nubank">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Últimos 4 Dígitos</label>
                            <input type="text" name="last_digits" maxlength="4" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all text-center placeholder:text-brand-text-secondary/30" placeholder="1234">
                        </div>
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Vencimento</label>
                            <input type="number" name="billing_day" min="1" max="31" required class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all text-center placeholder:text-brand-text-secondary/30" placeholder="Dia">
                        </div>
                    </div>
                    <div class="relative">
                        <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Limite (Opcional)</label>
                        <input type="text" name="credit_limit" data-currency="true" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="R$ 0,00">
                    </div>
                    <button type="submit" class="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-black py-4 rounded-2xl mt-2 shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest">
                        Salvar Cartão
                    </button>
                </form>
            </div>
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
                credit_limit: form.credit_limit.value ? CurrencyMask.unmaskToFloat(form.credit_limit.value) : null
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
    modal.className = 'fixed inset-0 z-50 flex items-end md:items-center justify-center';
    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/75 backdrop-blur-md" onclick="this.parentElement.remove()"></div>
        <div class="relative w-full md:max-w-md bg-brand-surface border-t md:border border-brand-border/60 rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up md:animate-scale-in">
            <!-- Accent top line -->
            <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
            <div class="absolute -top-8 right-0 w-40 h-40 bg-purple-500/8 rounded-full blur-3xl pointer-events-none"></div>
            
            <!-- Drag Handle -->
            <div class="w-10 h-1 bg-brand-border rounded-full mx-auto mt-3 md:hidden"></div>

            <!-- Header -->
            <div class="px-6 pt-5 pb-4 border-b border-brand-border/50">
                <h3 class="text-lg font-black text-brand-text-primary tracking-tight">🛒 Nova Compra no Cartão</h3>
                <p class="text-[10px] text-brand-text-secondary uppercase tracking-widest mt-0.5 opacity-70">Registre uma compra na fatura</p>
            </div>
            
            <!-- Body -->
            <div class="p-6">
                <form id="add-purchase-form" class="space-y-5">
                    <input type="hidden" name="card_id" value="${cardId}">

                    <!-- Amount - large display -->
                    <div class="bg-brand-bg rounded-2xl p-5 border border-brand-border/50">
                        <label class="block text-[10px] font-black text-brand-text-secondary uppercase tracking-widest mb-2">Valor da Compra</label>
                        <input type="text" name="amount" data-currency="true" required class="w-full bg-transparent text-4xl font-black text-brand-text-primary border-0 p-0 focus:ring-0 outline-none placeholder:text-brand-text-secondary/25" placeholder="R$ 0,00">
                    </div>

                    <div class="relative">
                        <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Descrição</label>
                        <input type="text" name="description" required class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all placeholder:text-brand-text-secondary/30" placeholder="Ex: Amazon, iFood, Uber">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Data</label>
                            <input type="date" name="purchase_date" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all [color-scheme:dark]" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="relative">
                            <label class="absolute -top-2 left-3 bg-brand-surface px-1 text-[10px] uppercase tracking-wider font-black text-brand-text-secondary z-10">Parcelas</label>
                            <input type="number" name="installments" min="1" max="24" class="w-full bg-brand-bg rounded-2xl border border-brand-border p-4 text-brand-text-primary font-bold text-sm text-center focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all" value="1">
                        </div>
                    </div>

                    <button type="submit" class="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-purple-500/25 active:scale-[0.98] transition-all text-sm uppercase tracking-widest">
                        Adicionar Compra
                    </button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('add-purchase-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await CreditCardService.addPurchase(form.card_id.value, {
                amount: CurrencyMask.unmaskToFloat(form.amount.value),
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
    modal.className = 'fixed inset-0 z-50 flex items-end md:items-center justify-center';

    const invoiceTotal = ((card?.current_invoice || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/75 backdrop-blur-md" onclick="this.parentElement.remove()"></div>
        <div class="relative w-full md:max-w-md bg-brand-surface border-t md:border border-brand-border/60 rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up md:animate-scale-in">
            <!-- Accent -->
            <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
            <div class="absolute -top-8 right-0 w-40 h-40 bg-purple-500/8 rounded-full blur-3xl pointer-events-none"></div>

            <!-- Drag Handle -->
            <div class="w-10 h-1 bg-brand-border rounded-full mx-auto mt-3 md:hidden"></div>

            <!-- Header -->
            <div class="px-6 pt-5 pb-4 border-b border-brand-border/50 flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-black text-brand-text-primary tracking-tight">📋 Fatura ${card?.name || 'Cartão'}</h3>
                    <p class="text-2xl font-black text-purple-400 mt-1 value-sensitive">R$ ${invoiceTotal}</p>
                </div>
                <button onclick="this.closest('#invoice-modal').remove()" class="bg-brand-surface-light hover:bg-brand-border rounded-xl p-2.5 text-brand-text-secondary hover:text-brand-text-primary transition-all">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Purchase list -->
            <div class="p-5 space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar">
                ${purchases.length === 0 ? `
                    <div class="text-center py-10">
                        <div class="w-12 h-12 bg-brand-surface-light rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">🛒</div>
                        <p class="text-sm font-bold text-brand-text-secondary">Nenhuma compra nesta fatura</p>
                    </div>
                ` : purchases.map(p => `
                    <div class="bg-brand-bg rounded-2xl p-4 flex justify-between items-center border border-brand-border/30 hover:border-brand-border transition-all">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-brand-text-primary truncate">
                                ${p.description}
                            </p>
                            <div class="flex items-center gap-2 mt-1">
                                <p class="text-[10px] text-brand-text-secondary">${new Date(p.purchase_date).toLocaleDateString('pt-BR')}</p>
                                ${p.installments > 1 ? `<span class="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold">${p.current_installment}/${p.installments}x</span>` : ''}
                            </div>
                        </div>
                        <span class="text-sm font-black text-brand-text-primary value-sensitive ml-3 shrink-0">
                            R$ ${(parseFloat(p.amount) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                `).join('')}
            </div>

            <!-- Footer -->
            <div class="p-5 border-t border-brand-border/50">
                <button onclick="this.closest('#invoice-modal').remove()" class="w-full bg-brand-bg border border-brand-border/50 hover:bg-brand-surface-light text-brand-text-secondary font-bold py-3.5 rounded-2xl transition-all active:scale-95 text-sm">
                    Fechar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};
