import { TransactionService } from '../services/transaction.service.js';
import { PartnersService } from '../services/partners.service.js';
import { BudgetService } from '../services/budget.service.js';

export const WalletModule = {
    currentDate: new Date(),
    currentContext: 'personal', // 'personal' | 'business'

    async render() {
        const container = document.getElementById('main-content');

        // Date Safeguard
        if (!this.currentDate || isNaN(this.currentDate.getTime())) {
            this.currentDate = new Date();
        }

        if (TransactionService.transactions.length === 0) {
            await TransactionService.init();
        }
        await PartnersService.init();
        await BudgetService.init();

        this.renderView(container);
    },

    renderView(container) {
        // Date Safeguard again just in case
        if (!this.currentDate || isNaN(this.currentDate.getTime())) {
            this.currentDate = new Date();
        }

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const monthName = this.currentDate.toLocaleDateString('pt-BR', { month: 'long' });

        const transactions = TransactionService.getByMonth(month, year, this.currentContext);
        const { income, expense, balance } = this.calculateSummary(transactions);
        const grouped = this.groupTransactionsByDate(transactions);

        const isBusiness = this.currentContext === 'business';

        container.innerHTML = `
            <div class="h-full flex flex-col bg-brand-bg relative">
                <!-- Header / Context & Month Selector -->
                <header class="pt-8 pb-4 px-4 bg-brand-bg/95 backdrop-blur-md sticky top-0 z-20 safe-area-top border-b border-white/5">
                    
                    <!-- Context Switcher (PF/PJ) -->
                    <div class="flex justify-center mb-6">
                        <div class="bg-brand-surface rounded-full p-1 flex border border-white/5 relative">
                            <!-- Active Pill Background Animation -->
                            <div class="absolute inset-y-1 w-[50%] bg-brand-surface-light rounded-full transition-all duration-300 ${isBusiness ? 'translate-x-[96%]' : 'left-1'}" style="width: calc(50% - 4px);"></div>

                            <button id="switch-personal" class="relative z-10 px-6 py-2 rounded-full text-sm font-bold transition-colors ${!isBusiness ? 'text-white' : 'text-gray-400 hover:text-white'}">
                                👤 Pessoal
                            </button>
                            <button id="switch-business" class="relative z-10 px-6 py-2 rounded-full text-sm font-bold transition-colors ${isBusiness ? 'text-white' : 'text-gray-400 hover:text-white'}">
                                💼 Empresa
                            </button>
                        </div>
                    </div>

                    <div class="flex items-center justify-between mb-4">
                        <h1 class="text-2xl font-bold text-white tracking-tight">${isBusiness ? 'Fluxo de Caixa' : 'Minha Carteira'}</h1>
                        
                        ${isBusiness ? `
                        <button id="btn-performance" class="bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full text-xs font-bold border border-brand-gold/20 hover:bg-brand-gold/20 transition flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            Performance
                        </button>
                        ` : ''}

                        <div class="flex items-center bg-brand-surface rounded-full p-1 border border-white/5 shadow-inner ${isBusiness ? 'ml-2' : 'ml-auto'}">
                             <button id="prev-month" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/5 hover:text-white transition">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                                </svg>
                            </button>
                            <span class="text-xs font-bold text-white px-2 capitalize min-w-[5rem] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                ${monthName.slice(0, 3)} ${year.toString().slice(2)}
                            </span>
                            <button id="next-month" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/5 hover:text-white transition">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Monthly Summary Pill -->
                    <div class="flex justify-between gap-2">
                        <div class="flex-1 bg-brand-surface/50 border border-white/5 rounded-2xl p-3 text-center">
                            <p class="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Entradas</p>
                            <p class="text-brand-green-light font-bold text-sm">R$ ${income.toFixed(2)}</p>
                        </div>
                        <div class="flex-1 bg-brand-surface/50 border border-white/5 rounded-2xl p-3 text-center">
                            <p class="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Saídas</p>
                            <p class="text-brand-red-light font-bold text-sm">R$ ${expense.toFixed(2)}</p>
                        </div>
                        <div class="flex-1 bg-gradient-to-br from-brand-surface to-brand-surface-light border border-white/10 rounded-2xl p-3 text-center shadow-lg">
                            <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Saldo</p>
                            <p class="text-white font-black text-sm">R$ ${balance.toFixed(2)}</p>
                        </div>
                    </div>
                </header>

                <!-- Transaction List & Budget Chart -->
                 <div class="flex-1 overflow-y-auto p-4 pb-28 space-y-6 custom-scrollbar">
                    
                    ${!isBusiness ? `
                    <!-- Budget Overview Chart (Personal Only) -->
                    <div class="bg-brand-surface/30 border border-white/5 rounded-3xl p-5 backdrop-blur-sm animate-fade-in-up">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <span class="bg-brand-gold/10 text-brand-gold p-1 rounded-lg">📊</span>
                                Orçamento Mensal
                            </h3>
                            <button class="text-[10px] font-bold text-brand-green hover:underline" onclick="window.app.router.navigate('goals')">
                                Ajustar Limites
                            </button>
                        </div>
                        <div id="budget-chart-container" class="relative h-48 w-full flex justify-center items-center">
                            <canvas id="budget-chart" class="relative z-10"></canvas>
                             <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none center-text">
                                <!-- Initial Text will be injected via JS -->
                             </div>
                        </div>
                    </div>
                    ` : ''}

                    ${(grouped && grouped.length) ? grouped.map(group => this.renderGroup(group)).join('') :
                '<div class="flex flex-col items-center justify-center h-64 text-gray-600 space-y-4"><div class="w-16 h-16 rounded-full bg-brand-surface flex items-center justify-center"><svg class="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><p class="font-medium">Sem movimentações em ${monthName}</p></div>'}
                </div>

                <!-- FAB -->
                <button id="fab-add-tx" class="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-brand-green to-brand-green-light rounded-full shadow-glow-green flex items-center justify-center text-white hover:scale-105 active:scale-95 transition z-20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>
            
            <!-- Modal (Hidden) -->
            ${this.renderModal()}
            
            <!-- Performance Modal (Hidden) -->
             <div id="performance-modal" class="fixed inset-0 z-50 hidden">
                <div class="absolute inset-0 bg-brand-bg/95 backdrop-blur-md transition-opacity duration-300" id="close-perf-overlay"></div>
                <div class="absolute bottom-0 w-full bg-brand-surface border-t border-white/10 rounded-t-[2.5rem] p-6 pb-8 animate-slide-up shadow-2xl h-[80vh] flex flex-col">
                    <div class="w-12 h-1 bg-gray-700/50 rounded-full mx-auto mb-6 shrink-0"></div>
                     <div class="flex justify-between items-center mb-4 shrink-0">
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                           📊 Performance por Clínica
                        </h3>
                         <button class="bg-white/5 rounded-full p-2 text-gray-400 hover:text-white transition" id="close-perf-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    <div class="flex-1 relative w-full h-full p-2">
                        <canvas id="performance-chart"></canvas>
                    </div>
                </div>
            </div>
        `;

        this.addListeners(container);

        // Render Budget Chart if Personal
        if (!isBusiness) {
            this.renderBudgetChart(income);
        }
    },

    calculateSummary(transactions) {
        let income = 0;
        let expense = 0;
        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount);
            if (tx.type === 'income') income += amount;
            else expense += amount;
        });
        return { income, expense, balance: income - expense };
    },

    groupTransactionsByDate(transactions) {
        const groups = {};
        transactions.forEach(tx => {
            // FIX: Robust date parsing
            let dateObj = new Date(tx.date);
            if (isNaN(dateObj.getTime())) {
                // Try fallback or current date if weirdness
                dateObj = new Date();
            }
            const dateStr = dateObj.toLocaleDateString('pt-BR');

            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(tx);
        });

        return Object.keys(groups).map(date => ({
            date,
            isToday: date === new Date().toLocaleDateString('pt-BR'),
            transactions: groups[date]
        }));
    },

    renderGroup(group) {
        // FIX: Re-parse date from locale string part carefully if needed, 
        // but 'group.date' is 'DD/MM/YYYY' from toLocaleDateString('pt-BR').
        // new Date('DD/MM/YYYY') is invalid in JS. Need to parse.
        const [dayStr, monthStr, yearStr] = group.date.split('/');
        const date = new Date(yearStr, monthStr - 1, dayStr);

        const day = date.getDate().toString().padStart(2, '0');
        const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const today = new Date().toDateString() === date.toDateString();

        return `
            <div class="animate-fade-in-up">
                <div class="flex items-center gap-4 mb-4 pl-2 opacity-80">
                    <div class="flex flex-col items-center">
                        <span class="text-xl font-bold text-white leading-none">${day}</span>
                    </div>
                     <span class="h-8 w-px bg-white/10"></span>
                    <span class="text-xs font-bold uppercase tracking-widest text-brand-gold">${today ? 'Hoje' : weekday}</span>
                </div>
                <div class="bg-black/20 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden shadow-lg">
                    ${group.transactions.map((tx, index) => this.renderTransactionItem(tx, index, group.transactions.length)).join('')}
                </div>
            </div>
        `;
    },

    renderTransactionItem(tx, index, total) {
        const isExpense = tx.type === 'expense';
        const amountClass = isExpense ? 'text-white' : 'text-brand-green-light';
        const iconBg = isExpense ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-green/10 text-brand-green';
        const icon = isExpense
            ? '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>'
            : '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>';

        // Category Icon logic
        let categoryEmoji = '💸';
        if (tx.category === 'investment') categoryEmoji = '📈';
        if (tx.category === 'food') categoryEmoji = '🍔';
        if (tx.category === 'transport') categoryEmoji = '🚗';
        if (tx.category === 'bills') categoryEmoji = '📄';
        if (tx.category === 'leisure') categoryEmoji = '🍿';
        if (tx.context === 'business') categoryEmoji = '💼';

        // FIX: Date Safeguard in Item
        const txDate = new Date(tx.date);
        const timeStr = !isNaN(txDate.getTime())
            ? txDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '--:--';

        return `
            <div class="relative group touch-manipulation cursor-pointer hover:bg-white/5 transition-colors duration-200 p-4 ${index !== (total - 1) ? 'border-b border-white/5' : ''}"
                onclick="window.app.editTransaction('${tx.id}')">
                
                <div class="flex items-center justify-between">
                    <!-- Left: Icon & Info -->
                    <div class="flex items-center gap-4 overflow-hidden">
                        <div class="w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 shadow-inner">
                            ${isExpense && tx.context === 'personal' ? `<span class="text-xl">${categoryEmoji}</span>` : icon}
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-white font-bold text-sm truncate pr-2">${tx.description}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] uppercase font-bold tracking-wider text-gray-500">${tx.context === 'business' ? (tx.classification ? tx.classification.replace('_', ' ') : 'Operacional') : (tx.category || 'Geral')}</span>
                                ${tx.status === 'pending' ? '<span class="px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-500 text-[9px] font-bold border border-yellow-500/20">PENDENTE</span>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Amount -->
                    <div class="text-right shrink-0 pl-2">
                        <span class="${amountClass} font-black text-base tracking-tight block">
                            ${isExpense ? '- ' : '+ '}R$ ${parseFloat(tx.amount).toFixed(2)}
                        </span>
                        <span class="text-[10px] text-gray-600 font-medium">${timeStr}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderModal() {
        const isBusiness = this.currentContext === 'business';
        const partners = PartnersService.partners;

        return `
            <div id="add-tx-modal" class="fixed inset-0 z-50 hidden">
                <div class="absolute inset-0 bg-brand-bg/90 backdrop-blur-md transition-opacity duration-300" id="close-modal-overlay"></div>
                
                <!-- Modal Content -->
                <div class="absolute bottom-0 w-full bg-brand-surface border-t border-white/10 rounded-t-[2.5rem] p-6 pb-8 animate-slide-up shadow-2xl h-[85vh] flex flex-col">
                    <div class="w-12 h-1 bg-gray-700/50 rounded-full mx-auto mb-6 shrink-0"></div>
                    
                    <div class="flex justify-between items-center mb-4 shrink-0">
                        <h3 class="text-xl font-bold text-white flex items-center gap-2">
                            ${isBusiness ? '💼 Nova Operação' : '👤 Nova Transação'}
                        </h3>
                        <button class="bg-white/5 rounded-full p-2 text-gray-400 hover:text-white transition" id="close-modal-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    <form id="add-tx-form" class="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-1">
                        <!-- Amount Field -->
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Valor</label>
                            <div class="relative group">
                                <span class="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 text-2xl font-light group-focus-within:text-brand-green-light transition">R$</span>
                                <input type="number" step="0.01" name="amount" id="amount-input" required 
                                    class="w-full bg-transparent text-5xl font-black text-white border-none focus:ring-0 pl-10 placeholder-gray-800 p-0 caret-brand-green" 
                                    placeholder="0,00">
                            </div>
                        </div>

                        <!-- Type Selector (In/Out) -->
                        <div class="grid grid-cols-2 gap-4">
                            <label class="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-brand-bg/30 cursor-pointer overflow-hidden group hover:bg-brand-bg/50 transition">
                                <input type="radio" name="type" value="income" class="peer hidden">
                                <div class="absolute inset-0 border-2 border-brand-green opacity-0 peer-checked:opacity-100 rounded-2xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-brand-green/20 text-brand-green mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                </div>
                                <span class="font-bold text-sm text-gray-400 peer-checked:text-brand-green transition">Entrada</span>
                            </label>
                             <label class="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-brand-bg/30 cursor-pointer overflow-hidden group hover:bg-brand-bg/50 transition">
                                <input type="radio" name="type" value="expense" class="peer hidden" checked>
                                <div class="absolute inset-0 border-2 border-brand-red opacity-0 peer-checked:opacity-100 rounded-2xl transition"></div>
                                <div class="w-10 h-10 rounded-full bg-brand-red/20 text-brand-red mb-2 flex items-center justify-center group-hover:scale-110 transition">
                                     <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                </div>
                                <span class="font-bold text-sm text-gray-400 peer-checked:text-brand-red transition">Saída</span>
                            </label>
                        </div>
                        
                        <!-- Common Description -->
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Descrição</label>
                            <input type="text" name="description" required 
                                class="w-full bg-brand-bg/50 rounded-2xl border border-white/5 p-4 text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none transition placeholder-gray-600 font-medium"
                                placeholder="O que foi isso?">
                        </div>

                         <!-- PERSONAL CONTEXT: CATEGORY (New) -->
                        ${!isBusiness ? `
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Categoria</label>
                            <select name="category" class="w-full bg-brand-bg/50 rounded-2xl border border-white/5 p-4 text-white focus:border-brand-green outline-none appearance-none">
                                <option value="general">Geral</option>
                                <option value="food">Alimentação</option>
                                <option value="transport">Transporte</option>
                                <option value="leisure">Lazer</option>
                                <option value="investment">Investimento / Aporte 📈</option>
                                <option value="bills">Contas Fixas</option>
                            </select>
                        </div>
                        ` : ''}

                        <!-- BUSINESS CONTEXT FIELDS -->
                        ${isBusiness ? `
                        <div class="space-y-6 border-t border-white/5 pt-6 animate-fade-in-up">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-lg">🏢</span>
                                <h4 class="text-white font-bold">Dados Operacionais</h4>
                            </div>

                            <!-- Partner Selector -->
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Parceiro / Clínica</label>
                                <div class="relative">
                                    <select name="partner_id" class="w-full bg-brand-bg/50 rounded-2xl border border-white/5 p-4 text-white focus:border-brand-green outline-none appearance-none">
                                        <option value="" disabled selected>Selecione uma clínica...</option>
                                        ${partners.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                                    </select>
                                    <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                                <button type="button" id="btn-add-partner" class="text-xs text-brand-green font-bold mt-2 hover:underline">+ Adicionar Nova Clínica</button>
                            </div>

                            <!-- Status (Paid/Pending) -->
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Status de Liquidez</label>
                                <div class="flex gap-2">
                                    <label class="flex-1 cursor-pointer">
                                        <input type="radio" name="status" value="paid" class="peer hidden" checked>
                                        <div class="bg-brand-bg/30 border border-white/5 rounded-xl p-3 text-center text-gray-400 peer-checked:bg-brand-green/20 peer-checked:text-brand-green peer-checked:border-brand-green transition font-medium">
                                            ✅ Recebido/Pago
                                        </div>
                                    </label>
                                    <label class="flex-1 cursor-pointer">
                                        <input type="radio" name="status" value="pending" class="peer hidden">
                                        <div class="bg-brand-bg/30 border border-white/5 rounded-xl p-3 text-center text-gray-400 peer-checked:bg-yellow-500/20 peer-checked:text-yellow-400 peer-checked:border-yellow-500 transition font-medium">
                                            ⏳ A Receber/Pagar
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <!-- Classification (Costs) - Only for Expenses -->
                            <div id="cost-classification-container">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Classificação de Custo</label>
                                <select name="classification" class="w-full bg-brand-bg/50 rounded-2xl border border-white/5 p-4 text-white focus:border-brand-green outline-none appearance-none">
                                    <option value="fixed_operational">🏢 Fixo Operacional (Aluguel, Softwares)</option>
                                    <option value="production_variable">🦷 Variável de Produção (Materiais)</option>
                                    <option value="outsourced">🤝 Terceirizados (Laboratórios)</option>
                                </select>
                            </div>
                        </div>
                        ` : ''}

                        <button type="submit" class="w-full bg-gradient-to-r from-brand-green to-brand-green-light text-white font-bold text-lg py-4 rounded-2xl shadow-glow-green active:scale-[0.98] transition mt-6">
                            Confirmar
                        </button>
                    </form>
                </div>
            </div>
        `;
    },

    addListeners(container) {
        const modal = document.getElementById('add-tx-modal');
        const fab = document.getElementById('fab-add-tx');
        const closeBtn = document.getElementById('close-modal-btn');
        const overlay = document.getElementById('close-modal-overlay');
        const form = document.getElementById('add-tx-form');

        // Context Switchers
        const switchPersonal = document.getElementById('switch-personal');
        const switchBusiness = document.getElementById('switch-business');

        if (switchPersonal) {
            switchPersonal.onclick = () => {
                if (this.currentContext !== 'personal') {
                    this.currentContext = 'personal';
                    this.render();
                }
            };
        }
        if (switchBusiness) {
            switchBusiness.onclick = () => {
                if (this.currentContext !== 'business') {
                    this.currentContext = 'business';
                    this.render();
                }
            };
        }

        document.getElementById('prev-month').onclick = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.render();
        };
        document.getElementById('next-month').onclick = () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.render();
        };

        const openModal = () => {
            modal.classList.remove('hidden');
            setTimeout(() => document.getElementById('amount-input').focus(), 100);
        };
        const closeModal = () => modal.classList.add('hidden');

        if (fab) fab.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay) overlay.addEventListener('click', closeModal);

        // Add Partner Logic
        const btnAddPartner = document.getElementById('btn-add-partner');
        if (btnAddPartner) {
            btnAddPartner.addEventListener('click', async () => {
                const name = prompt('Nome da nova Clínica/Parceiro:');
                if (name) {
                    await PartnersService.create({ name });
                    this.render();
                    document.getElementById('fab-add-tx').click();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const category = formData.get('category');
                const context = this.currentContext;

                const newTx = {
                    amount: parseFloat(formData.get('amount')),
                    description: formData.get('description'),
                    type: formData.get('type'),
                    date: new Date().toISOString(),
                    context: context,
                    partner_id: formData.get('partner_id') || null,
                    status: formData.get('status') || 'paid',
                    classification: formData.get('classification') || null,
                    category: category || null
                };

                try {
                    await TransactionService.create(newTx);
                    closeModal();
                    form.reset();
                    this.render();

                    // Investment Trigger Logic (Personal Context only)
                    if (context === 'personal' && category === 'investment') {
                        if (confirm('Parabéns pelo investimento! 🚀\n\nDeseja registrar isso como um Aporte na aba de Metas agora?')) {
                            const goalsBtn = document.querySelector('button[data-nav="goals"]');
                            if (window.app && window.app.router) {
                                window.app.router.navigate('goals');
                            } else {
                                alert('Vá para a aba Metas para registrar o detalhe do ativo!');
                            }
                        }
                    }

                } catch (error) {
                    console.error(error);
                    alert('Erro ao salvar: ' + error.message);
                }
            });
        }

        // Performance Modal Logic
        const btnPerformance = document.getElementById('btn-performance');
        const performanceModal = document.getElementById('performance-modal');
        const closePerfBtn = document.getElementById('close-perf-btn');
        const closePerfHandle = document.getElementById('close-perf-btn-handle');
        const closePerfOverlay = document.getElementById('close-perf-overlay');

        if (btnPerformance) {
            btnPerformance.addEventListener('click', () => {
                performanceModal.classList.remove('hidden');
                this.renderPerformanceChart();
            });
        }

        const closePerf = () => performanceModal.classList.add('hidden');
        if (closePerfBtn) closePerfBtn.addEventListener('click', closePerf);
        if (closePerfHandle) closePerfHandle.addEventListener('click', closePerf);
        if (closePerfOverlay) closePerfOverlay.addEventListener('click', closePerf);

        window.app.editTransaction = async (id) => {
            if (confirm('Deseja excluir esta transação?')) {
                await TransactionService.delete(id);
                this.render();
            }
        };
    },

    renderPerformanceChart() {
        const ctx = document.getElementById('performance-chart')?.getContext('2d');
        if (!ctx) return;

        if (window.performanceChart instanceof Chart) {
            window.performanceChart.destroy();
        }

        const partners = PartnersService.partners;
        const transactions = TransactionService.transactions;
        const partnerStats = {};

        partners.forEach(p => {
            partnerStats[p.id] = { name: p.name, revenue: 0, cost: 0, profit: 0, color: p.color };
        });

        transactions.filter(tx => tx.context === 'business' && tx.partner_id).forEach(tx => {
            if (partnerStats[tx.partner_id]) {
                const amount = parseFloat(tx.amount);
                if (tx.type === 'income') {
                    partnerStats[tx.partner_id].revenue += amount;
                } else {
                    partnerStats[tx.partner_id].cost += amount;
                }
            }
        });

        Object.keys(partnerStats).forEach(id => {
            partnerStats[id].profit = partnerStats[id].revenue - partnerStats[id].cost;
        });

        const sortedPartners = Object.values(partnerStats).sort((a, b) => b.profit - a.profit);

        const labels = sortedPartners.map(p => p.name);
        const profitData = sortedPartners.map(p => p.profit);
        const revenueData = sortedPartners.map(p => p.revenue);

        window.performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Lucro Líquido',
                        data: profitData,
                        backgroundColor: '#10B981',
                        borderRadius: 6,
                    },
                    {
                        label: 'Faturamento Bruto',
                        data: revenueData,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 6,
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: 'white' } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'gray' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'white' }
                    }
                }
            }
        });
    },

    renderBudgetChart(currentMonthRevenue) {
        const ctx = document.getElementById('budget-chart')?.getContext('2d');
        if (!ctx) return;

        if (window.budgetChart instanceof Chart) {
            window.budgetChart.destroy();
        }

        const allocations = BudgetService.allocations;

        // Use a default revenue if 0 to show at least the proportions?
        const basis = currentMonthRevenue > 0 ? currentMonthRevenue : 0;

        const dataPoints = allocations.map(alloc => {
            let spending = 0;
            const txs = TransactionService.getByMonth(this.currentDate.getMonth(), this.currentDate.getFullYear(), 'personal');

            txs.forEach(tx => {
                if (tx.type === 'expense') {
                    const amount = Math.abs(parseFloat(tx.amount));
                    let bucket = 'comfort'; // Default

                    if (tx.category === 'bills') bucket = 'fixed_costs';
                    else if (tx.category === 'food' || tx.category === 'transport') bucket = 'comfort';
                    else if (tx.category === 'leisure') bucket = 'pleasures';
                    else if (tx.category === 'investment') bucket = 'financial_freedom'; // Changed to align with Goals
                    else if (tx.category === 'education') bucket = 'knowledge';

                    if (bucket === alloc.category) {
                        spending += amount;
                    }
                }
            });

            return {
                label: BudgetService.getLabel(alloc.category),
                spending: spending,
                color: BudgetService.getColor(alloc.category)
            };
        });

        // Compute Totals
        const totalSpending = dataPoints.reduce((acc, curr) => acc + curr.spending, 0);

        const labels = dataPoints.map(d => d.label);
        const data = dataPoints.map(d => d.spending);
        const colors = dataPoints.map(d => d.color);

        // Center Text Logic
        const updateCenterText = (value, label, color = 'white') => {
            const container = document.getElementById('budget-chart-container');
            let centerDiv = container.querySelector('.center-text');
            if (!centerDiv) {
                centerDiv = document.createElement('div');
                centerDiv.className = 'absolute inset-0 flex flex-col items-center justify-center pointer-events-none center-text';
                container.appendChild(centerDiv);
            }
            centerDiv.innerHTML = `
                <span class="text-xl font-bold" style="color: ${color}">${value}</span>
                <span class="text-[10px] text-gray-400 uppercase tracking-widest">${label}</span>
            `;
        };

        // Ensure container has relative positioning
        const canvasContainer = document.getElementById('budget-chart').parentElement;
        canvasContainer.id = 'budget-chart-container';
        canvasContainer.classList.add('relative', 'flex', 'justify-center', 'items-center');

        // Initial Text
        updateCenterText(`R$ ${totalSpending.toFixed(2)}`, 'Gasto Total');

        window.budgetChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 12,
                    borderRadius: 5,
                    spacing: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                onHover: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const d = dataPoints[index];
                        updateCenterText(`R$ ${d.spending.toFixed(2)}`, d.label, d.color);
                    } else {
                        updateCenterText(`R$ ${totalSpending.toFixed(2)}`, 'Gasto Total');
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }
};
