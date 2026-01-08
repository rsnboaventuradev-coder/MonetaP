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

        let numberVal;

        if (typeof amount === 'string') {
            // Replace comma with dot if present (Brazilian format support)
            // Remove 'R$' or other non-numeric chars except dot/comma? 
            // Better to be safe: assume mostly cleaner input, but handle common cases.
            const cleanStr = amount.replace(',', '.');
            numberVal = parseFloat(cleanStr);
        } else {
            numberVal = amount;
        }

        if (isNaN(numberVal)) return 0;

        // Use Math.round to correct floating point drift (e.g. 10.50 * 100 = 1050.0000001)
        return Math.round(numberVal * 100);
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
