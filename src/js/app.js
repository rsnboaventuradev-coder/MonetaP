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

window.Toast = Toast;

class App {
    constructor() {
        this.state = {
            user: null
        };
        this.currentView = null;
    }

    async init() {
        console.log('App Initializing...');

        // Init Services
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

    navigateTo(viewName) {
        console.log('Navigating to:', viewName);
        this.currentView = viewName;

        // Render Bottom Nav for authenticated views
        if (this.state.user && ['dashboard', 'wallet', 'goals', 'reports', 'investments', 'settings'].includes(viewName)) {
            BottomNav.render(viewName);
        }

        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        switch (viewName) {
            case 'dashboard':
                DashboardModule.render();
                break;
            case 'wallet':
                WalletModule.render();
                break;
            case 'goals':
                GoalsModule.render();
                break;
            case 'reports':
                ReportsModule.render();
                break;
            case 'investments':
                InvestmentsModule.render();
                break;
            case 'settings':
                SettingsModule.init().then(() => SettingsModule.render());
                break;
            case 'profile': // Legacy redirect
                this.navigateTo('settings');
                break;
            default:
                break;
        }
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
