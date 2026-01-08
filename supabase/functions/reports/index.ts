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

        // Auth Check
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const url = new URL(req.url)
        // Helper to get path segments. Support local & deployed paths if needed.
        // URL path might be /reports/breakdown or just /breakdown depending on how it's invoked.
        // Safest is to check the last segment.
        const path = url.pathname.split('/').pop()

        // --- ENDPOINT: BREAKDOWN ---
        if (path === 'breakdown') {
            const typeParam = url.searchParams.get('type') // Expected: INCOME or EXPENSE
            const month = parseInt(url.searchParams.get('month') ?? '')
            const year = parseInt(url.searchParams.get('year') ?? '')

            if (!typeParam || !month || !year) throw new Error('Missing params: type, month, year')

            // Case Sensitivity: DB uses UPPERCASE 'INCOME' / 'EXPENSE'
            // We force uppercase to be safe, assuming user might send 'expense'.
            const type = typeParam.toUpperCase();

            // Date Range: Start of Month to Start of Next Month
            const startDate = new Date(year, month - 1, 1).toISOString();
            // careful with month rollover in JS Date (month is 0-indexed)
            const endDate = new Date(year, month, 1).toISOString();

            const { data: transactions, error } = await supabaseClient
                .from('transactions')
                .select(`
                    amount,
                    category_id,
                    categories!inner (
                        name,
                        icon,
                        type
                    )
                `)
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lt('date', endDate)
                .eq('categories.type', type) // Exact match UPPERCASE

            if (error) throw error

            // Aggregation
            const aggregated: Record<string, any> = {}
            let totalSum = 0

            transactions.forEach((t: any) => {
                const catName = t.categories.name
                const val = Number(t.amount) // Standardize as number
                if (!aggregated[catName]) {
                    aggregated[catName] = {
                        category: catName,
                        total: 0,
                        color: stringToColor(catName),
                        icon: t.categories.icon
                    }
                }
                aggregated[catName].total += val
                totalSum += val
            })

            // Format Result
            const result = Object.values(aggregated).map((item: any) => ({
                category: item.category,
                color: item.color,
                total: item.total, // In Centavos
                percentage: totalSum === 0 ? 0 : Math.round((item.total / totalSum) * 100)
            })).sort((a, b) => b.total - a.total)

            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // --- ENDPOINT: EVOLUTION ---
        else if (path === 'evolution') {
            const monthsParam = parseInt(url.searchParams.get('months') ?? '6')
            const limit = monthsParam > 12 ? 12 : monthsParam; // Safety cap

            // Date Range: Last X months including current
            const today = new Date();
            // Start from X-1 months ago, 1st day.
            // e.g. If today is Jan, and limit 6, we want Aug, Sep, Oct, Nov, Dec, Jan.
            const startParams = new Date(today.getFullYear(), today.getMonth() - limit + 1, 1);
            const startDate = startParams.toISOString();

            // Fetch Date, Amount, Categories(Type)
            const { data: transactions, error } = await supabaseClient
                .from('transactions')
                .select(`
                    date, 
                    amount, 
                    categories!inner (
                        type
                    )
                `)
                .eq('user_id', user.id)
                .gte('date', startDate)

            if (error) throw error

            // Initialize Slots
            const grouped: Record<string, any> = {}
            for (let i = 0; i < limit; i++) {
                const d = new Date(startParams.getFullYear(), startParams.getMonth() + i, 1);
                // Key format: YYYY-MM
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                // Label: Short Month (Jan, Feb...)
                // Note: toLocaleDateString might depend on server locale. Hardcoding or passing locale 'pt-BR' is better.
                // But Deno Deploy locale might differ. Let's use a simpler map or just rely on 'pt-BR' if supported.
                // Fallback to number if needed.
                const monthName = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' });

                grouped[key] = {
                    month: monthName.replace('.', '').toUpperCase(), // e.g. 'JAN'
                    income: 0,
                    expense: 0,
                    rawDate: key
                }
            }

            // Aggregate
            transactions.forEach((t: any) => {
                const d = new Date(t.date); // UTC date string
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                if (grouped[key]) {
                    const type = t.categories.type; // 'INCOME' or 'EXPENSE'
                    const val = Number(t.amount);

                    if (type === 'INCOME') grouped[key].income += val;
                    if (type === 'EXPENSE') grouped[key].expense += val;
                }
            })

            const result = Object.values(grouped).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate));

            return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

        } else {
            return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers: corsHeaders })
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})

function stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}
