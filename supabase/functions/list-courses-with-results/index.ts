import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  saison_id?: string | null;
  phase_id?: string | null;
  filters?: string[] | null;
  search?: string | null;
  limit?: number | null;
  offset?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { 
      saison_id, 
      phase_id, 
      filters, 
      search, 
      limit = 50, 
      offset = 0 
    }: RequestBody = await req.json();

    console.log('Listing courses with filters:', { saison_id, phase_id, filters, search });

    // Get courses that have results in points_ledger
    const { data: coursesWithPoints, error: pointsError } = await supabaseClient
      .from('points_ledger')
      .select('course_id')
      .not('course_id', 'is', null);

    if (pointsError) throw pointsError;

    const courseIds = Array.from(new Set(coursesWithPoints?.map(p => p.course_id) || []));

    if (courseIds.length === 0) {
      return new Response(
        JSON.stringify({ items: [], total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine phase filter
    let phaseIds: string[] = [];
    if (phase_id) {
      phaseIds = [phase_id];
    } else if (saison_id) {
      const { data: phases } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id);
      phaseIds = phases?.map(p => p.id) || [];
    }

    // Build query
    let query = supabaseClient
      .from('courses')
      .select('id, nom, date_debut, date_fin, categorie, phase_id', { count: 'exact' })
      .in('id', courseIds);

    if (phaseIds.length > 0) {
      query = query.in('phase_id', phaseIds);
    }

    // Apply multi-criteria filters
    if (filters && filters.length > 0) {
      // Separate UCI categories from WT filters
      const uciCategories = filters.filter(f => 
        ['2.1', '1.1', '2.Pro', '1.Pro'].includes(f)
      );
      const wtFilters = filters.filter(f => 
        ['GT', 'Monument', 'WT_Tours', 'WT_Classiques'].includes(f)
      );

      // Build OR conditions
      const conditions: string[] = [];

      // UCI categories (exact match on categorie)
      if (uciCategories.length > 0) {
        conditions.push(`categorie.in.(${uciCategories.join(',')})`);
      }

      // WT filters (use wt_tier with ILIKE for Tours/Classiques patterns)
      wtFilters.forEach(wt => {
        if (wt === 'GT' || wt === 'Monument') {
          conditions.push(`wt_tier.eq.${wt}`);
        } else if (wt === 'WT_Tours') {
          conditions.push(`wt_tier.ilike.WT_Tours_%`);
        } else if (wt === 'WT_Classiques') {
          conditions.push(`wt_tier.ilike.WT_Classiques_%`);
        }
      });

      // Apply with .or()
      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }
    }

    if (search) {
      query = query.ilike('nom', `%${search}%`);
    }

    query = query
      .order('date_debut', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 50) - 1);

    const { data: courses, error: coursesError, count } = await query;

    if (coursesError) throw coursesError;

    // Check which courses have stages
    const items = await Promise.all((courses || []).map(async (course) => {
      const { data: stagesData } = await supabaseClient
        .from('race_results')
        .select('etape_numero')
        .eq('course_id', course.id)
        .eq('type_classement', 'Etape')
        .not('etape_numero', 'is', null)
        .limit(1);

      const { data: phaseData } = await supabaseClient
        .from('phases')
        .select('index_dans_saison')
        .eq('id', course.phase_id)
        .single();

      return {
        id: course.id,
        nom: course.nom,
        date_debut: course.date_debut,
        date_fin: course.date_fin,
        category: course.categorie,
        has_stages: (stagesData && stagesData.length > 0),
        phase_label: phaseData ? `P${phaseData.index_dans_saison}` : null
      };
    }));

    return new Response(
      JSON.stringify({ items, total: count || 0 }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in list-courses-with-results:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
