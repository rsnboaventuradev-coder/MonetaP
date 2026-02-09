import { SupabaseService } from './services/supabase.service.js';
import { SyncService } from './services/sync.service.js';
import { BottomNav } from './ui/bottom-nav.js';
import { AuthModule } from './modules/auth.js';
import { DashboardModule } from './modules/dashboard.js';
import { WalletModule } from './modules/wallet.js';
import { GoalsModule } from './modules/goals.js';
import { ReportsModule } from './modules/reports.js';
import { InvestmentsModule } from './modules/investments.js';
import { SettingsModule } from './modules/settings.js';
import { OnboardingModule } from './modules/onboarding.js';
import { Toast } from './utils/toast.js';
import { syncIndicator } from './ui/sync-indicator.js';
import { ModalUtils } from './ui/modal-utils.js';

window.Toast = Toast;
window.ModalUtils = ModalUtils;

class App {
    constructor() {
        this.state = {
            user: null
        };
        this.currentView = null;

        // Expose modules globally for interactions
        this.InvestmentsModule = InvestmentsModule;
        this.GoalsModule = GoalsModule;
        this.WalletModule = WalletModule;
        this.ReportsModule = ReportsModule;
        this.SettingsModule = SettingsModule;
        this.DashboardModule = DashboardModule;
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Default to Light if no preference saved, unless system is explicitly dark
        if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        return isDark;
    }

    async init() {
        console.log('App Initializing...');

        // POLYFILL: crypto.randomUUID for Android WebViews / Older Browsers
        if (!crypto.randomUUID) {
            crypto.randomUUID = () => {
                return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                );
            };
            console.log('Polyfill: crypto.randomUUID applied.');
        }

        // CRASH DEBUG: Check for previous errors
        const crashLog = localStorage.getItem('crash_log');
        if (crashLog) {
            console.error('Previous Crash:', crashLog);
            // Delay slightly to ensure Toast is ready
            setTimeout(() => {
                Toast.show('Crash Anterior: ' + crashLog, 'error', 10000);
                localStorage.removeItem('crash_log');
            }, 1000);
        }

        // Global Error Handlers
        window.onerror = (msg, url, lineNo, columnNo, error) => {
            const errorMsg = `Global: ${msg} (${lineNo}:${columnNo})`;
            localStorage.setItem('crash_log', errorMsg);
            return false;
        };

        window.onunhandledrejection = (event) => {
            const errorMsg = `Unhandled: ${event.reason?.message || event.reason}`;
            localStorage.setItem('crash_log', errorMsg);
        };

        // Init Services
        this.initTheme(); // NEW: Light/Dark Mode
        SyncService.init();

        // Check Auth
        const session = await SupabaseService.getSession();
        this.state.user = session?.user || null;

        // Auth Listener
        SupabaseService.client.auth.onAuthStateChange((event, session) => {
            this.state.user = session?.user || null;
            this.updateAuthUI(!!session);
        });

        this.updateAuthUI(!!this.state.user);
    }

    updateAuthUI(isAuthenticated) {
        if (!isAuthenticated) {
            // Hide Bottom Nav
            const nav = document.getElementById('bottom-nav');
            if (nav) nav.innerHTML = '';

            AuthModule.render();
            this.currentView = 'login';
        } else {
            // Default to dashboard if coming from login
            if (this.currentView === 'login' || !this.currentView) {
                this.navigateTo('dashboard');
                // Check Onboarding
                setTimeout(() => {
                    OnboardingModule.init();
                }, 1000);
            }
        }
    }

    showLoading() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.remove('hidden');
            // Small delay to allow display:block to apply before opacity transition if needed
            requestAnimationFrame(() => {
                loader.classList.remove('opacity-0');
                loader.classList.add('opacity-100');
            });
        }
    }

    hideLoading() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.remove('opacity-100');
            loader.classList.add('opacity-0');
            setTimeout(() => {
                loader.classList.add('hidden');
            }, 300); // Match transition duration
        }
    }

    async navigateTo(viewName) {
        console.log('Navigating to:', viewName);

        this.showLoading();

        // 1. Centralize Truth
        this.currentView = viewName;
        window.app.currentView = viewName;

        // Render Bottom Nav with hidden tabs filtering
        if (this.state.user && ['dashboard', 'wallet', 'goals', 'investments', 'reports', 'settings'].includes(viewName)) {
            await this.renderNavigation();
        }

        const mainContent = document.getElementById('main-content');
        if (!mainContent) {
            this.hideLoading();
            return;
        }

        // Clear content to avoid ghost elements while loading new view
        mainContent.innerHTML = '';

        try {
            switch (viewName) {
                case 'dashboard':
                    await DashboardModule.render();
                    break;
                case 'wallet':
                    await WalletModule.render();
                    break;
                case 'goals':
                    await GoalsModule.render();
                    break;
                case 'investments':
                    await InvestmentsModule.render();
                    break;
                case 'reports':
                    await ReportsModule.render();
                    break;
                case 'settings':
                    await SettingsModule.render();
                    break;
                default:
                    await DashboardModule.render();
                    break;
            }
        } catch (error) {
            console.error('Navigation Error:', error);
            if (this.currentView === viewName) {
                Toast.show('Erro ao carregar ' + viewName + ': ' + (error.message || error), 'error');
            }
        } finally {
            if (this.currentView === viewName) {
                this.hideLoading();
            }
        }
    }

    async renderNavigation() {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;

        // Get user profile to check hidden tabs
        let hiddenTabs = [];
        try {
            const session = await SupabaseService.getSession();
            const user = session?.user;
            // console.log('📱 renderNavigation - User:', user?.id);
            if (user) {
                // Use limit(1) to handle potential duplicate rows in user_profiles
                const { data: profiles, error } = await SupabaseService.client
                    .from('user_profiles')
                    .select('hidden_tabs')
                    .eq('user_id', user.id)
                    .limit(1);

                const profile = profiles?.[0] || null;
                // console.log('📱 renderNavigation - Profile data:', profile, 'Error:', error);
                hiddenTabs = profile?.hidden_tabs || [];
                // console.log('📱 renderNavigation - Hidden tabs:', hiddenTabs);
            }
        } catch (error) {
            console.error('Error fetching hidden tabs:', error);
        }

        // Define all tabs
        const allTabs = [
            { id: 'dashboard', icon: '', label: 'Dashboard' },
            { id: 'wallet', icon: '', label: 'Carteira' },
            { id: 'goals', icon: '', label: 'Metas' },
            { id: 'investments', icon: '', label: 'Investimentos' },
            { id: 'settings', icon: '', label: 'Config' }
        ];

        // Filter visible tabs
        const visibleTabs = allTabs.filter(tab => !hiddenTabs.includes(tab.id));
        console.log('📱 renderNavigation - Visible tabs:', visibleTabs.map(t => t.id));

        // Use BottomNav component which has proper SVG icons
        BottomNav.render(this.currentView, hiddenTabs);
    }

    togglePrivacy() {
        this.state.isPrivacyOn = !this.state.isPrivacyOn;
        localStorage.setItem('privacy_mode', this.state.isPrivacyOn);
        if (this.state.isPrivacyOn) {
            document.body.classList.add('privacy-active');
            Toast.show('Modo Privacidade Ativado', 'info');
        } else {
            document.body.classList.remove('privacy-active');
            Toast.show('Modo Privacidade Desativado', 'info');
        }
    }
}

const app = new App();
const existingCtx = window.app || {};
window.app = app;
Object.assign(window.app, existingCtx);

document.addEventListener('DOMContentLoaded', () => {
    app.init();

    // Privacy Init
    if (localStorage.getItem('privacy_mode') === 'true') {
        app.state.isPrivacyOn = true;
        document.body.classList.add('privacy-active');
    }
});


