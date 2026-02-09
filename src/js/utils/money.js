/**
 * MoneyHelper
 * Utility for handling monetary conversions between Reais (Frontend/Display) and Centavos (Database).
 * 
 * Rules:
 * - Database stores BIGINT (Centavos).
 * - Frontend inputs usually come as Float/String (Reais).
 * - Math should be done in Integers whenever possible.
 */
export const MoneyHelper = {
    /**
     * Converts a value (Reais) to Centavos (Integer).
     * Handles floats, strings with commas/dots, and nulls.
     * 
     * Examples:
     * 10.50 -> 1050
     * "10.50" -> 1050
     * "10,50" -> 1050
     * null -> 0
     * 
     * @param {number|string} amount - Value in Reais
     * @returns {number} Value in Centavos (Integer)
     */
    toCents(amount) {
        if (amount === null || amount === undefined || amount === '') return 0;

        // If it's already a number, treat as Reais (float) -> Cents
        if (typeof amount === 'number') {
            return Math.round(amount * 100);
        }

        if (typeof amount === 'string') {
            // Check if it looks like a formatted currency (contains comma or dots)
            // or just a cleanup of R$ etc.

            // 1. Remove anything that isn't a digit, a minus sign, or a comma.
            // We ignore dots used for thousands separator.
            let cleanStr = amount.replace(/[^\d,-]/g, '');

            // 2. Replace comma with dot for standard float parsing
            cleanStr = cleanStr.replace(',', '.');

            const numberVal = parseFloat(cleanStr);
            if (isNaN(numberVal)) return 0;

            return Math.round(numberVal * 100);
        }

        return 0;
    },

    /**
     * Converts Centavos (Integer) to Reais (Float) for calculation/display.
     * 
     * Examples:
     * 1050 -> 10.50
     * 1000 -> 10.00
     * 
     * @param {number} amountInCents - Value in Centavos
     * @returns {number} Value in Reais (Float)
     */
    fromCents(amountInCents) {
        if (!amountInCents) return 0;
        const intVal = parseInt(amountInCents, 10);
        if (isNaN(intVal)) return 0;

        return intVal / 100;
    },

    /**
     * Formats Centavos directly to Brazilian Real string.
     * Shortcut for: formatting(fromCents(val))
     * 
     * @param {number} amountInCents 
     * @returns {string} "R$ 10,50"
     */
    format(amountInCents) {
        const value = this.fromCents(amountInCents);
        return value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
};
