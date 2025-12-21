export const CurrencyMask = {
    apply(inputElement) {
        inputElement.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            e.target.value = this.format(value);
        });
    },

    format(value) {
        if (!value) return '';
        const numberValue = parseFloat(value) / 100;
        return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    unmask(value) {
        if (!value) return 0;
        return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }
};
