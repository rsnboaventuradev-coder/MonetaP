import { ReportsService } from '../services/reports.service.js';
import { TransactionService } from '../services/transaction.service.js';

export const ReportsModule = {
    chartInstance: null,

    async render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        if (TransactionService.transactions.length === 0) {
            await TransactionService.init();
        }

        // Expose service globally for onclick
        window.ReportsService = ReportsService;

        container.innerHTML = `
            <div class="h-full flex flex-col bg-brand-dark safe-area-top">
                <header class="p-6 pb-4 flex justify-between items-center">
                    <div>
                        <h1 class="text-2xl font-bold text-brand-text-primary mb-1">Relatórios</h1>
                        <p class="text-brand-text-secondary text-sm">Análise visual das suas finanças</p>
                    </div>
                    <button onclick="ReportsService.exportToCSV(new Date().getMonth(), new Date().getFullYear(), 'all')" class="bg-brand-surface border border-brand-border text-brand-text-primary text-[10px] font-bold px-3 py-2 rounded-lg hover:bg-brand-surface-light transition flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Exportar
                    </button>
                </header>

                <div class="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
                    <!-- Balance Chart Card -->
                    <div class="bg-brand-darker rounded-2xl p-4 border border-brand-border">
                         <h3 class="text-brand-text-primary font-bold mb-4">Entradas vs Saídas</h3>
                         <div class="relative h-48 w-full">
                            <canvas id="balance-chart"></canvas>
                         </div>
                    </div>

                    <!-- Category Chart Card -->
                    <div class="bg-brand-darker rounded-2xl p-4 border border-brand-border">
                         <h3 class="text-brand-text-primary font-bold mb-4">Despesas por Categoria</h3>
                         <div class="relative h-64 w-full">
                            <canvas id="category-chart"></canvas>
                         </div>
                         <div id="category-legend" class="mt-4 grid grid-cols-2 gap-2 text-xs text-brand-text-secondary">
                            <!-- Legend items injected here -->
                         </div>
                    </div>
                </div>
            </div>
        `;

        this.renderCharts();
    },

    renderCharts() {
        const transactions = TransactionService.transactions;
        if (!transactions || !transactions.length) return;

        // 1. Balance Chart Data
        let income = 0;
        let expense = 0;
        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount);
            if (tx.type === 'income') income += amount;
            else expense += amount;
        });

        // 2. Category Data
        const categories = {};
        transactions.filter(tx => tx.type === 'expense').forEach(tx => {
            // Simple keyword extraction or fallback
            // In a real app we'd have a category field. 
            // We'll infer category from description for now as per "Suggest improvements" freedom, or just use description
            // Let's assume we want to groups by explicit Category if exists, or fallback
            // But we don't have category input yet in Wallet? 
            // Wait, Wallet Modal has Description but no Category Select. 
            // I should probably add Category default or aggregation by description words?
            // Let's aggregate by Description for now to show *something*.

            const cat = tx.description ? tx.description.split(' ')[0] : 'Outros';
            categories[cat] = (categories[cat] || 0) + parseFloat(tx.amount);
        });

        const catLabels = Object.keys(categories);
        const catData = Object.values(categories);

        // Render Balance Chart
        const ctxBalance = document.getElementById('balance-chart').getContext('2d');
        new Chart(ctxBalance, {
            type: 'doughnut',
            data: {
                labels: ['Entradas', 'Saídas'],
                datasets: [{
                    data: [income, expense],
                    backgroundColor: ['#4CAF50', '#FF5252'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#fff', boxWidth: 12 } }
                }
            }
        });

        // Render Category Chart
        const ctxCategory = document.getElementById('category-chart').getContext('2d');
        new Chart(ctxCategory, {
            type: 'bar',
            data: {
                labels: catLabels,
                datasets: [{
                    label: 'Gasto (R$)',
                    data: catData,
                    backgroundColor: '#D4AF37',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#ffffff10' }, ticks: { color: '#999' } },
                    x: { grid: { display: false }, ticks: { color: '#999' } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
};



