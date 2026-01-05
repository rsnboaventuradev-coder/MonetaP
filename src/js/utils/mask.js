/**
 * Currency Mask Utility for Brazilian Real (R$)
 * Auto-formats numeric input as currency (e.g., 464 → R$ 4,64)
 */
export const CurrencyMask = {
    /**
     * Apply mask to a specific input element
     * @param {HTMLInputElement} inputElement 
     */
    apply(inputElement) {
        if (!inputElement || inputElement.dataset.currencyMaskApplied) return;

        inputElement.dataset.currencyMaskApplied = 'true';
        inputElement.setAttribute('inputmode', 'numeric');
        inputElement.setAttribute('placeholder', 'R$ 0,00');

        inputElement.addEventListener('input', (e) => {
            const cursorPos = e.target.selectionStart;
            const oldLength = e.target.value.length;

            // Remove all non-digits
            const value = e.target.value.replace(/\D/g, '');

            // Format
            e.target.value = this.format(value);

            // Adjust cursor position
            const newLength = e.target.value.length;
            const diff = newLength - oldLength;
            const newCursorPos = Math.max(0, cursorPos + diff);

            // Set cursor at end (most natural for currency input)
            e.target.setSelectionRange(newLength, newLength);
        });

        // Format on blur to ensure consistent display
        inputElement.addEventListener('blur', (e) => {
            if (e.target.value) {
                const value = e.target.value.replace(/\D/g, '');
                e.target.value = this.format(value);
            }
        });

        // Handle paste
        inputElement.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numericValue = pastedText.replace(/\D/g, '');
            e.target.value = this.format(numericValue);
        });
    },

    /**
     * Format a numeric string as Brazilian currency
     * @param {string} value - Numeric string (e.g., "464" or "35000")
     * @returns {string} Formatted currency (e.g., "R$ 4,64" or "R$ 350,00")
     */
    format(value) {
        if (!value || value === '0') return '';

        // Remove leading zeros but keep at least one digit
        const cleanValue = value.replace(/^0+/, '') || '0';

        // Convert to number (value is in cents)
        const numberValue = parseFloat(cleanValue) / 100;

        return numberValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    /**
     * Remove formatting and return value in cents (integer)
     * @param {string} value - Formatted currency string
     * @returns {number} Value in cents
     */
    unmask(value) {
        if (!value) return 0;

        // Remove everything except digits and comma
        const cleanValue = value.replace(/[^\d,]/g, '');

        // Replace comma with dot for parsing
        const numericString = cleanValue.replace(',', '.');

        // Parse as float and convert to cents
        const floatValue = parseFloat(numericString) || 0;

        // Return in cents (integer)
        return Math.round(floatValue * 100);
    },

    /**
     * Get float value from masked input (for display/calculations in reais)
     * @param {string} value - Formatted currency string
     * @returns {number} Value in reais (float)
     */
    unmaskToFloat(value) {
        return this.unmask(value) / 100;
    },

    /**
     * Auto-apply to all inputs with data-currency attribute
     */
    initAll() {
        document.querySelectorAll('[data-currency]').forEach(input => {
            this.apply(input);
        });
    }
};

// Make available globally for inline event handlers
window.CurrencyMask = CurrencyMask;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CurrencyMask.initAll());
} else {
    CurrencyMask.initAll();
}
