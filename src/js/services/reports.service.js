import { TransactionService } from './transaction.service.js';
import { SupabaseService } from './supabase.service.js';
import { Toast } from '../utils/toast.js';

export const ReportsService = {
    /**
     * Get expense/income breakdown by category
     * @param {'income'|'expense'} type 
     * @param {number} month 1-12
     * @param {number} year 
     */
    async getBreakdown(type, month, year) {
        try {
            const query = new URLSearchParams({ type, month, year }).toString();
            const { data, error } = await SupabaseService.client.functions.invoke(`reports/breakdown?${query}`, {
                method: 'GET'
            });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('ReportsService.getBreakdown error:', error);
            Toast.show('Erro ao carregar relatório: ' + error.message, 'error');
            throw error;
        }
    },

    /**
     * Get evolution of income vs expense
     * @param {number} months default 6
     */
    async getEvolution(months = 6) {
        try {
            const query = new URLSearchParams({ months }).toString();
            const { data, error } = await SupabaseService.client.functions.invoke(`reports/evolution?${query}`, {
                method: 'GET'
            });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('ReportsService.getEvolution error:', error);
            Toast.show('Erro ao carregar evolução: ' + error.message, 'error');
            throw error;
        }
    },

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
    },

    /**
     * Export transactions to PDF using html2pdf.js
     * @param {number} month - 0-11
     * @param {number} year 
     * @param {'personal' | 'business' | 'all'} context 
     */
    async exportToPDF(month, year, context = 'all') {
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

        // Calculate Totals
        const totalIncome = transactions.reduce((acc, t) => t.type === 'income' ? acc + parseFloat(t.amount) : acc, 0);
        const totalExpense = transactions.reduce((acc, t) => t.type === 'expense' ? acc + parseFloat(t.amount) : acc, 0);
        const net = totalIncome - totalExpense;

        const dateStr = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        // Construct HTML structure to convert to PDF
        const pdfContent = document.createElement('div');
        pdfContent.style.padding = '20px';
        pdfContent.style.fontFamily = 'Inter, sans-serif';
        pdfContent.style.color = '#333';

        // Use inline styles since html2pdf renders what it sees
        let html = `
            <div style="margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 10px;">
                <h1 style="margin: 0; font-size: 24px; color: #1E293B;">Moneta - Relatório Financeiro</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748B;">Mês de Referência: ${dateStr.toUpperCase()}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748B;">Contexto: ${context === 'personal' ? 'Pessoa Física' : context === 'business' ? 'Pessoa Jurídica' : 'Ambos'}</p>
            </div>
            
            <div style="display: flex; gap: 20px; margin-bottom: 30px;">
                <div style="flex: 1; padding: 15px; background: #e0f2fe; border-radius: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #0284c7; text-transform: uppercase;">Receitas (+)</p>
                    <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #0369a1;">R$ ${(totalIncome / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div style="flex: 1; padding: 15px; background: #fee2e2; border-radius: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #dc2626; text-transform: uppercase;">Despesas (-)</p>
                    <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #b91c1c;">R$ ${(totalExpense / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div style="flex: 1; padding: 15px; background: ${net >= 0 ? '#dcfce7' : '#fee2e2'}; border-radius: 8px;">
                    <p style="margin: 0; font-size: 12px; color: ${net >= 0 ? '#16a34a' : '#dc2626'}; text-transform: uppercase;">Saldo Líquido</p>
                    <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">R$ ${(net / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f1f5f9; text-align: left; font-size: 12px; color: #475569;">
                        <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Data</th>
                        <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Descrição</th>
                        <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Ctegoria</th>
                        <th style="padding: 10px; border-bottom: 1px solid #cbd5e1;">Status</th>
                        <th style="padding: 10px; border-bottom: 1px solid #cbd5e1; text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
        `;

        transactions.forEach(t => {
            const date = new Date(t.date).toLocaleDateString('pt-BR');
            const amount = parseFloat(t.amount) / 100;
            const amountStr = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const amountColor = t.type === 'income' ? '#059669' : '#DC2626';
            const category = t.category || '-';
            const status = t.status === 'paid' ? 'Pago' : 'Pendente';

            html += `
                <tr style="font-size: 12px; color: #333;">
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${date}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${t.description}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${category}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${status}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; text-align: right; color: ${amountColor}; font-weight: 600;">${amountStr}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            
            <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8;">
                <p>Gerado por Moneta em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        `;

        pdfContent.innerHTML = html;

        // Html2Pdf configuration
        const opt = {
            margin: 10,
            filename: `moneta_relatorio_${month + 1}_${year}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Create PDF
        Toast.show('Gerando PDF, aguarde...', 'info');
        try {
            await html2pdf().set(opt).from(pdfContent).save();
            Toast.show('PDF gerado com sucesso!', 'success');
        } catch (error) {
            console.error('PDF Generation Error:', error);
            Toast.show('Erro ao gerar PDF', 'error');
        }
    }
};
