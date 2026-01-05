import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase Environment Variables!');
}

/**
 * SupabaseService
 * Singleton instance of the Supabase client.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});

export const SupabaseService = {
    client: supabase,

    /**
     * Get current user session
     * Includes fallback to getUser if session is not immediately available
     */
    async getSession() {
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;

            // If session exists, return it
            if (data.session) {
                return data.session;
            }

            // Fallback: Try to get user directly (in case session is being refreshed)
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (!userError && userData.user) {
                // Create a minimal session-like object with the user
                return { user: userData.user };
            }

            return null;
        } catch (err) {
            console.error('Error getting session:', err);
            return null;
        }
    },

    /**
     * Sign out
     */
    /**
     * Sign out
     */
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    /**
     * Centralized Error Handler
     * Maps technical error codes to user-friendly messages.
     * @param {Error} error - The error object from Supabase or JS
     */
    handleError(error) {
        console.error('Supabase Error:', error);

        // Default Message
        let message = 'Ocorreu um erro inesperado. Tente novamente.';

        // Map Specific Codes (PostgreSQL / Supabase Auth)
        if (error?.code) {
            switch (error.code) {
                // Database Constraints
                case '23505': // unique_violation
                    message = 'Este registro já existe.';
                    break;
                case '23503': // foreign_key_violation
                    message = 'Não foi possível completar a ação pois este item está vinculado a outro registro.';
                    break;
                case '42P01': // undefined_table
                    message = 'Erro interno: Tabela não encontrada.';
                    break;

                // Auth Specific (Some auth errors come as strings or specific status)
                case 'invalid_credentials':
                case '400': // Check details for granular auth mapping if needed elsewhere
                    // Supabase often sends 'Invalid login credentials' in message
                    break;
            }
        }

        // Message Content Overrides
        if (error?.message) {
            if (error.message.includes('Invalid login credentials')) {
                message = 'Email ou senha incorretos.';
            } else if (error.message.includes('User already registered')) {
                message = 'Este email já está cadastrado.';
            } else if (error.message.includes('weak_password')) {
                message = 'A senha escolhida é muito fraca.';
            }
        }

        // Show Toast
        // Toast is available globally as window.Toast (set in app.js)
        if (window.Toast) {
            window.Toast.show(message, 'error');
        } else {
            // Fallback: log to console if Toast somehow isn't loaded
            console.error('Toast not available:', message);
        }
    }
};


