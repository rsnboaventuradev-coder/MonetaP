
// MOCK SUPABASE
const mockUpdate = { eq: () => Promise.resolve({ data: null, error: null }) };
const mockSupabase = {
    auth: {
        getUser: async () => ({ data: { user: { id: 'user-123' } } })
    },
    from: (table) => ({
        select: (cols, opts) => {
            // Mock counts based on scenarios
            let count = 0;
            if (table === 'accounts') count = global.mockAccountCount;
            if (table === 'goals') count = global.mockGoalCount;

            return {
                eq: () => Promise.resolve({ count: count, data: [] })
            };
        },
        update: (updates) => {
            if (table === 'profiles') {
                console.log(`[DB UPDATE] profiles:`, updates);
                global.dbUpdated = true;
                global.dbUpdates = updates;
            }
            return mockUpdate;
        }
    })
};

// MOCK TOAST
const Toast = {
    show: (msg, type) => console.log(`[TOAST ${type.toUpperCase()}] ${msg}`)
};

// MOCK MODULE (Simplified from source)
const OnboardingModule = {
    data: { step_accounts_completed: false },
    status: { refinement: 'active' },
    renderDashboard: () => console.log("[UI RENDER] Dashboard re-rendered"),

    async checkRefinement() {
        console.log("Checking Refinement...");
        const { data: { user } } = await mockSupabase.auth.getUser();

        // Parallel checks (simulation)
        const [{ count: accCount }, { count: goalCount }] = await Promise.all([
            mockSupabase.from('accounts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            mockSupabase.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
        ]);

        console.log('Counts:', { accCount, goalCount });

        if ((accCount || 0) >= 1 && (goalCount || 0) >= 1) {
            await mockSupabase.from('profiles').update({ step_accounts_completed: true }).eq('id', user.id);
            this.data.step_accounts_completed = true;
            this.status.refinement = 'completed';
            Toast.show('Parabéns! Configuração inicial concluída.', 'success');
            this.renderDashboard();
        } else {
            const missing = [];
            if ((accCount || 0) < 1) missing.push('1 Conta Bancária');
            if ((goalCount || 0) < 1) missing.push('1 Meta');
            Toast.show(`Faltam itens: ${missing.join(', ')}`, 'warning');
        }
    }
};

// --- RUN TESTS ---

async function runTests() {
    console.log("=== TESTE LÓGICA REFINAMENTO (SIMULAÇÃO) ===\n");

    // SCENARIO 1: Empty
    console.log("--- CENÁRIO 1: Nada cadastrado ---");
    global.mockAccountCount = 0;
    global.mockGoalCount = 0;
    await OnboardingModule.checkRefinement();
    console.log("");

    // SCENARIO 2: Only Account
    console.log("--- CENÁRIO 2: Apenas Conta ---");
    global.mockAccountCount = 1;
    global.mockGoalCount = 0;
    await OnboardingModule.checkRefinement();
    console.log("");

    // SCENARIO 3: Complete
    console.log("--- CENÁRIO 3: Conta + Meta (SUCESSO) ---");
    global.mockAccountCount = 1;
    global.mockGoalCount = 1;
    global.dbUpdated = false;

    await OnboardingModule.checkRefinement();

    if (global.dbUpdated && global.dbUpdates.step_accounts_completed === true) {
        console.log("✅ DB Updated Correctly: step_accounts_completed = true");
        console.log("✅ Status Updated: " + OnboardingModule.status.refinement);
    } else {
        console.log("❌ DB Update Failed");
    }
    console.log("\n=== FIM DO TESTE ===");
}

runTests();
