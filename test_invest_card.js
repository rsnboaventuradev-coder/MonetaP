
// Mock Constants
const STAGES = {
    SECURITY: 'security',
    ACCUMULATION: 'accumulation',
    FREEDOM: 'freedom'
};

// Mock Evolution Service Logic (Replicated from src/js/services/evolution.service.js)
const EvolutionService = {
    calculateLiquidity(profile) {
        // 1. Profile Balance
        let total = profile.current_balance || 0;
        // 2. Investments (Mocked as 0 for this test unless specified)
        const investmentsLiquidity = 0;
        total += (investmentsLiquidity / 100);
        return total;
    },

    calculateStage(profile, costOfLiving) {
        if (!profile) return STAGES.SECURITY;

        const liquidityAmount = this.calculateLiquidity(profile);
        // Cost of living passed explicitly for test simplicity
        const monthsSecured = costOfLiving > 0 ? liquidityAmount / costOfLiving : 0;

        const targetMonths = profile.emergency_fund_target_months || 6;
        const hasEmergencyFund = monthsSecured >= targetMonths;

        if (!hasEmergencyFund) return STAGES.SECURITY;
        return STAGES.ACCUMULATION;
    }
};

// Mock Investment Module Decision Logic
function determineView(profile, costOfLiving, disclaimerAccepted) {
    const stage = EvolutionService.calculateStage(profile, costOfLiving); // Pass CostOfLiving manually

    if (stage === STAGES.SECURITY) {
        return "MODO SEGURANÇA (Bloqueado)";
    }

    if (!disclaimerAccepted) {
        return "DISCLAIMER LEGAL (Aviso)";
    }

    return "INVESTIMENTOS_DASHBOARD (Liberado)";
}

// --- TEST EXECUTION ---
console.log("=== INICIANDO TESTE DO CARD DE INVESTIMENTOS ===\n");

// PARAMETERS
const COST_OF_LIVING = 5000;
const TARGET_MONTHS = 6;
const TARGET_AMOUNT = COST_OF_LIVING * TARGET_MONTHS; // 30.000

console.log(`Parâmetros:`);
console.log(`- Custo Mensal: R$ ${COST_OF_LIVING}`);
console.log(`- Meta (6 meses): R$ ${TARGET_AMOUNT}\n`);

// TEST C1: RESERVA INSUFICIENTE
console.log("--- Teste C1: Reserva Insuficiente (R$ 1.000) ---");
const profileC1 = {
    current_balance: 1000,
    emergency_fund_target_months: TARGET_MONTHS
};
const resultC1 = determineView(profileC1, COST_OF_LIVING, false);
console.log(`Saldo: R$ ${profileC1.current_balance}`);
console.log(`Resultado Esperado: MODO SEGURANÇA`);
console.log(`Resultado Obtido:   ${resultC1}`);
console.log(resultC1.includes("SEGURANÇA") ? "✅ PASSOU" : "❌ FALHOU");
console.log("");

// TEST C2.1: RESERVA COMPLETA (SEM DISCLAIMER)
console.log("--- Teste C2.1: Reserva Completa (R$ 50.000) - Sem Disclaimer ---");
const profileC2 = {
    current_balance: 50000,
    emergency_fund_target_months: TARGET_MONTHS
};
const resultC2_1 = determineView(profileC2, COST_OF_LIVING, false); // Disclaimer FALSE
console.log(`Saldo: R$ ${profileC2.current_balance}`);
console.log(`Disclaimer Aceito: NÃO`);
console.log(`Resultado Esperado: DISCLAIMER LEGAL`);
console.log(`Resultado Obtido:   ${resultC2_1}`);
console.log(resultC2_1.includes("DISCLAIMER") ? "✅ PASSOU" : "❌ FALHOU");
console.log("");

// TEST C2.2: RESERVA COMPLETA (COM DISCLAIMER)
console.log("--- Teste C2.2: Reserva Completa (R$ 50.000) - Com Disclaimer ---");
const resultC2_2 = determineView(profileC2, COST_OF_LIVING, true); // Disclaimer TRUE
console.log(`Saldo: R$ ${profileC2.current_balance}`);
console.log(`Disclaimer Aceito: SIM`);
console.log(`Resultado Esperado: INVESTIMENTOS_DASHBOARD`);
console.log(`Resultado Obtido:   ${resultC2_2}`);
console.log(resultC2_2.includes("DASHBOARD") ? "✅ PASSOU" : "❌ FALHOU");
console.log("\n=== FIM DO TESTE ===");
