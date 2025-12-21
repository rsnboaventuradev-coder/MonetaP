import { supabase } from '../services/supabase.service.js';

// Logic & State Management
export const AuthService = {
    user: null,

    async init() {
        supabase.auth.onAuthStateChange((event, session) => {
            this.user = session?.user || null;
        });
    },

    async getCurrentUser() {
        if (this.user) return this.user;
        const { data: { session } } = await supabase.auth.getSession();
        this.user = session?.user || null;
        return this.user;
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    async register(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        // 2. Cria perfil público (se necessário, ou usar trigger no banco)
        // ... lógica de perfil ...
        Toast.show('Conta criada com sucesso! Verifique seu email.', 'success');
        window.location.href = '/index.html';
        return data;
    },

    async logout() {
        await supabase.auth.signOut();
        window.location.href = '/index.html';
    },

    async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        if (error) throw error;
    }
};

// UI Rendering & Interaction
export const AuthModule = {
    isRegistering: false,

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const title = this.isRegistering ? 'Criar nova conta' : 'Bem-vindo de volta';
        const subtitle = this.isRegistering ? 'Comece sua jornada financeira hoje.' : 'Acesse suas finanças de qualquer lugar.';
        const btnText = this.isRegistering ? 'Cadastrar' : 'Entrar';
        const toggleText = this.isRegistering ? 'Já tem conta? Entre aqui.' : 'Não tem conta? Cadastre-se.';

        container.innerHTML = `
            <div class="flex flex-col justify-center min-h-full px-6 py-12 lg:px-8 bg-brand-bg relative overflow-hidden">
                <!-- Background Decoration -->
                <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div class="absolute -top-[20%] -right-[20%] w-[80%] h-[80%] rounded-full bg-brand-green/20 blur-[100px]"></div>
                    <div class="absolute -bottom-[20%] -left-[20%] w-[80%] h-[80%] rounded-full bg-brand-gold/10 blur-[100px]"></div>
                </div>

                <div class="sm:mx-auto sm:w-full sm:max-w-sm relative z-10">
                    <div class="text-center mb-10">
                        <div class="mx-auto h-16 w-16 bg-gradient-to-br from-brand-green to-brand-green-light rounded-2xl flex items-center justify-center shadow-glow-green mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 class="text-3xl font-bold tracking-tight text-white mb-2">${title}</h2>
                        <p class="text-gray-400 text-sm">${subtitle}</p>
                    </div>

                    <div class="bg-brand-surface/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
                        <form class="space-y-6" id="auth-form">
                            ${this.isRegistering ? `
                            <div>
                                <label for="fullName" class="block text-xs font-medium uppercase tracking-wide text-gray-400">Nome Completo</label>
                                <div class="mt-2">
                                    <input id="fullName" name="fullName" type="text" required placeholder="Seu Nome"
                                        class="block w-full rounded-xl border border-white/10 bg-brand-bg/50 px-4 py-3 text-white shadow-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green sm:text-sm placeholder-gray-600 outline-none transition-all">
                                </div>
                            </div>
                            ` : ''}

                            <div>
                                <label for="email" class="block text-xs font-medium uppercase tracking-wide text-gray-400">Email</label>
                                <div class="mt-2">
                                    <input id="email" name="email" type="email" autocomplete="email" required placeholder="seu@email.com"
                                        class="block w-full rounded-xl border border-white/10 bg-brand-bg/50 px-4 py-3 text-white shadow-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green sm:text-sm placeholder-gray-600 outline-none transition-all">
                                </div>
                            </div>

                            <div>
                                <div class="flex items-center justify-between">
                                    <label for="password" class="block text-xs font-medium uppercase tracking-wide text-gray-400">Senha</label>
                                    ${!this.isRegistering ? '<button id="forgot-password" type="button" class="text-xs font-semibold text-brand-green hover:text-brand-green-light transition">Esqueceu?</button>' : ''}
                                </div>
                                <div class="mt-2">
                                    <input id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"
                                        class="block w-full rounded-xl border border-white/10 bg-brand-bg/50 px-4 py-3 text-white shadow-sm focus:border-brand-green focus:ring-1 focus:ring-brand-green sm:text-sm placeholder-gray-600 outline-none transition-all">
                                </div>
                            </div>

                            <div>
                                <button type="submit"
                                    class="flex w-full justify-center rounded-xl bg-gradient-to-r from-brand-green to-brand-green-light px-3 py-3.5 text-sm font-bold leading-6 text-white shadow-glow-green hover:opacity-90 active:scale-[0.98] transition-all duration-200">
                                    ${btnText}
                                </button>
                            </div>
                        </form>
                        
                        <div class="mt-8 text-center">
                            <button id="toggle-auth" class="text-sm font-semibold text-gray-400 hover:text-white transition">
                                ${toggleText}
                            </button>
                        </div>
                        <div id="auth-message" class="mt-4 text-center text-sm font-semibold min-h-[1.5rem]"></div>
                    </div>
                </div>
            </div>
        `;

        this.addListeners();
    },

    addListeners() {
        const form = document.getElementById('auth-form');
        const toggleBtn = document.getElementById('toggle-auth');
        const forgotBtn = document.getElementById('forgot-password');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.isRegistering = !this.isRegistering;
                this.render();
            });
        }

        if (forgotBtn) {
            forgotBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const messageEl = document.getElementById('auth-message');

                if (!email) {
                    this.showMessage('Digite seu email primeiro.', 'error');
                    return;
                }

                try {
                    this.showMessage('Enviando email de recuperação...', 'warning');
                    await AuthService.resetPassword(email);
                    this.showMessage('Email de recuperação enviado!', 'success');
                } catch (error) {
                    this.showMessage(error.message, 'error');
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const fullName = this.isRegistering ? document.getElementById('fullName').value : null;
                const submitBtn = form.querySelector('button[type="submit"]');

                try {
                    this.setLoading(submitBtn, true);
                    this.showMessage('Processando...', 'warning');

                    if (this.isRegistering) {
                        await AuthService.register(email, password, fullName);
                        this.showMessage('Sucesso! Verifique seu email.', 'success');
                    } else {
                        await AuthService.login(email, password);
                        this.showMessage('Login realizado! Redirecionando...', 'success');
                        // AuthStateListener in App or Shared Service will handle redirect commonly, but we can enable here too
                        window.location.href = '/dashboard.html';
                    }

                } catch (error) {
                    console.error(error);
                    this.showMessage(error.message, 'error');

                    // Specific error handling logic
                    if (error.message.includes('already registered')) {
                        this.showMessage('Este email já está cadastrado.', 'error');
                    }
                } finally {
                    this.setLoading(submitBtn, false);
                }
            });
        }
    },

    showMessage(text, type) {
        const el = document.getElementById('auth-message');
        if (!el) return;

        el.textContent = text;
        if (type === 'error') el.className = 'mt-4 text-center text-sm text-brand-red';
        else if (type === 'success') el.className = 'mt-4 text-center text-sm text-brand-green';
        else el.className = 'mt-4 text-center text-sm text-brand-gold';
    },

    setLoading(btn, isLoading) {
        if (isLoading) {
            btn.dataset.originalText = btn.innerText;
            btn.innerHTML = '<span class="animate-pulse">Aguarde...</span>';
            btn.disabled = true;
        } else {
            btn.innerText = btn.dataset.originalText || (this.isRegistering ? 'Cadastrar' : 'Entrar');
            btn.disabled = false;
        }
    }
};