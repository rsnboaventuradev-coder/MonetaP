import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() // "identity", "snapshot", "status"

    // ROUTE: GET /onboarding/status
    if (req.method === 'GET' && path === 'status') {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('onboarding_progress')
        .eq('id', user.id)
        .single()

      if (error) throw error

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ROUTE: POST /onboarding/identity
    if (req.method === 'POST' && path === 'identity') {
      const { type } = await req.json() // 'PF', 'PJ', or 'Hybrid'

      if (!['PF', 'PJ', 'Hybrid'].includes(type)) {
        return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400, headers: corsHeaders })
      }

      // 1. Update Profile (and progress to 'snapshot')
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({
          type: type,
          onboarding_progress: 'snapshot'
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Load Categories
      const categoriesPF = [
        { name: 'Alimentação', icon: 'pizza', type: 'EXPENSE', context: 'personal' },
        { name: 'Moradia', icon: 'home', type: 'EXPENSE', context: 'personal' },
        { name: 'Transporte', icon: 'car', type: 'EXPENSE', context: 'personal' },
        { name: 'Lazer', icon: 'gamepad', type: 'EXPENSE', context: 'personal' },
        { name: 'Saúde', icon: 'activity', type: 'EXPENSE', context: 'personal' },
        { name: 'Salário', icon: 'dollar-sign', type: 'INCOME', context: 'personal' }
      ]

      const categoriesPJ = [
        { name: 'Operacional', icon: 'settings', type: 'EXPENSE', context: 'business' },
        { name: 'Marketing', icon: 'share-2', type: 'EXPENSE', context: 'business' },
        { name: 'Pessoal', icon: 'users', type: 'EXPENSE', context: 'business' }, // Usually withdrawal
        { name: 'Impostos', icon: 'file-text', type: 'EXPENSE', context: 'business' },
        { name: 'Serviços', icon: 'briefcase', type: 'INCOME', context: 'business' }
      ]

      let targetCategories = [];

      if (type === 'PF') {
        targetCategories = categoriesPF;
      } else if (type === 'PJ') {
        targetCategories = categoriesPJ;
      } else if (type === 'Hybrid') {
        // Merge both, avoid exact duplicates if any names overlap (though here they are distinct enough)
        // 'Pessoal' in PJ is technically distinct from personal expenses, but let's keep all.
        targetCategories = [...categoriesPF, ...categoriesPJ];
      }

      // Insert categories
      const categoriesToInsert = targetCategories.map(cat => ({
        user_id: user.id,
        name: cat.name,
        icon: cat.icon,
        type: cat.type,
        context: cat.context,
        is_system: true
      }))

      const { error: catError } = await supabaseClient
        .from('categories')
        .insert(categoriesToInsert)

      if (catError) console.error('Error inserting categories:', catError)

      return new Response(JSON.stringify({ success: true, next_step: 'snapshot' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ROUTE: POST /onboarding/snapshot
    if (req.method === 'POST' && path === 'snapshot') {
      const body = await req.json()

      // Calculate Risk Profile & Target
      // Logic: High Risk (Unstable Income) = 12 months. Low Risk (Stable) = 6 months.
      const profession = body.profession || 'Outros';
      // Normalize to lower case for comparison
      const professionLower = profession.toLowerCase();

      const highRiskKeywords = ['autônomo', 'empresário', 'dentista', 'freelancer', 'profissional liberal'];

      let riskProfile = 'low';
      let targetMonths = 6;

      // Check if profession contains any high risk keyword
      if (highRiskKeywords.some(keyword => professionLower.includes(keyword))) {
        riskProfile = 'high';
        targetMonths = 12;
      }

      // Update financial fields
      const updates = {
        monthly_income: body.monthly_income,
        cost_of_living: body.cost_of_living,
        knowledge_level: body.knowledge_level,
        age: body.age,
        current_balance: body.current_balance,
        onboarding_progress: 'completed',
        onboarding_completed: true,
        // New Fields
        profession: profession,
        risk_profile: riskProfile,
        emergency_fund_target_months: targetMonths
      }

      const { error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        next_step: null,
        risk_analysis: {
          profession,
          risk: riskProfile,
          target_months: targetMonths
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
