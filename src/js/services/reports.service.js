import { TransactionService } from './transaction.service.js';
import { Toast } from '../utils/toast.js';

export const ReportsService = {
    /**
     * Export transactions to CSV
     * @param {number} month - 0-11
     * @param {number} year 
     * @param {'personal' | 'business' | 'all'} context 
     */
    async exportToCSV(month, year, context = 'all') {
        const transactions = TransactionService.transactions.filter(t => {
            const date = new Date(t.date);
            const matchesDate = date.getMonth() === month && date.getFullYear() === year;
            const matchesContext = context === 'all' || t.context === context;
            return matchesDate && matchesContext;
        });

        if (transactions.length === 0) {
            Toast.show('Nenhuma transação encontrada para este período.', 'warning');
            return;
        }

        // CSV Header
        const headers = ['Data', 'Descrição', 'Tipo', 'Valor', 'Categoria', 'Parceiro', 'Contexto', 'Status'];

        // CSV Rows
        const rows = transactions.map(t => {
            const date = new Date(t.date).toLocaleDateString('pt-BR');
            const amount = parseFloat(t.amount).toFixed(2).replace('.', ',');
            const type = t.type === 'income' ? 'Receita' : 'Despesa';
            const category = t.category || '-';
            const partner = t.partner_id ? 'Sim' : '-'; // Ideally fetch partner name
            const ctx = t.context === 'business' ? 'PJ' : 'PF';
            const status = t.status === 'paid' ? 'Pago' : 'Pendente';

            return [date, `"${t.description}"`, type, amount, category, partner, ctx, status].join(';');
        });

        const csvContent = [headers.join(';'), ...rows].join('\n');

        // Trigger Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `moneta_extrato_${month + 1}_${year}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};


