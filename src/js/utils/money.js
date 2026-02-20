/**
 * Utilitário para manipulação monetária segura.
 * Baseado no padrão de armazenar valores em centavos (Inteiros).
 */
export const Money = {
    /**
     * Formata um valor (em centavos ou decimal) para moeda BRL
     * @param {number} value - Valor (padrão espera decimal vindo da UI, ou centavos se isCents=true)
     * @param {boolean} isCents - Se o valor já está em centavos (ex: vindo do DB)
     */
    format(value, isCents = false) {
        if (value === null || value === undefined) return 'R$ 0,00';

        // Se vier do banco (centavos), divide por 100. Se for input da tela, usa direto.
        const amount = isCents ? Number(value) / 100 : Number(value);

        return amount.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    },

    /**
     * Converte um valor de Input (string '1.250,50') ou Decimal (1250.50) para Centavos (Int)
     * Ideal para enviar para o Supabase.
     */
    toCents(value) {
        if (typeof value === 'string') {
            // Remove R$, pontos de milhar e troca vírgula por ponto
            value = value.replace(/[^\d,-]/g, '').replace(',', '.');
        }
        // Multiplica por 100 e arredonda para evitar 19.9999999
        return Math.round(Number(value) * 100);
    },

    /**
     * Converte Centavos (do banco) para Decimal (para inputs ou cálculos JS)
     */
    fromCents(value) {
        return Number(value) / 100;
    },

    /**
     * Realiza soma segura de valores decimais convertendo para centavos temporariamente
     */
    add(a, b) {
        const centsA = Math.round(Number(a) * 100);
        const centsB = Math.round(Number(b) * 100);
        return (centsA + centsB) / 100;
    }
};
