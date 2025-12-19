import { SupabaseService } from './supabase.service.js';

export const AnalysisService = {
    /**
     * Get analysis for a specific investment
     * @param {string} investmentId 
     * @returns {Promise<object|null>}
     */
    async getAnalysis(investmentId) {
        const { data } = await SupabaseService.client
            .from('asset_analysis')
            .select('*')
            .eq('investment_id', investmentId)
            .maybeSingle();
        return data;
    },

    /**
     * Save (Insert/Update) analysis
     * @param {string} investmentId 
     * @param {object} scores { profitability: 0-5, ... }
     */
    async saveAnalysis(investmentId, scores) {
        const { data: { user } } = await SupabaseService.getSession();
        if (!user) throw new Error('User not authenticated');

        // Check if exists
        const existing = await this.getAnalysis(investmentId);

        if (existing) {
            const { error } = await SupabaseService.client
                .from('asset_analysis')
                .update({ ...scores, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await SupabaseService.client
                .from('asset_analysis')
                .insert({
                    user_id: user.id,
                    investment_id: investmentId,
                    ...scores
                });
            if (error) throw error;
        }
    }
};
