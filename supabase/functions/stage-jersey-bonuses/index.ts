import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_id, etape_numero } = await req.json();

    if (!course_id || !etape_numero) {
      return new Response(JSON.stringify({ error: 'course_id and etape_numero required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching jersey bonuses for ${course_id} etape ${etape_numero}`);

    // Get current manager
    const { data: managerData } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const currentManagerId = managerData?.id;

    // Get course phase and saison
    const { data: courseData } = await supabase
      .from('courses')
      .select('phase_id, phases!inner(saison_id)')
      .eq('id', course_id)
      .single();

    const phaseId = courseData?.phase_id;
    const saisonId = (courseData?.phases as any)?.saison_id;

    // Jersey types with their icons
    const jerseyTypes = [
      { type: 'Porteur Général', icon: '🟡', label: 'Jaune' },
      { type: 'Porteur Vert', icon: '🟢', label: 'Vert' },
      { type: 'Porteur Montagne', icon: '🔴', label: 'Pois' },
      { type: 'Porteur Jeune', icon: '⚪', label: 'Blanc' },
      { type: 'Porteur Combattif', icon: '🔵', label: 'Combattif' }
    ];

    const bonuses = [];

    for (const jersey of jerseyTypes) {
      // Get points from points_ledger for this jersey type on this stage
      const { data: pointsData } = await supabase
        .from('points_ledger')
        .select(`
          coureur_id,
          points,
          managers!inner(nom)
        `)
        .eq('course_id', course_id)
        .eq('type_classement', jersey.type)
        .eq('etape_numero', etape_numero)
        .gt('points', 0)
        .order('points', { ascending: false })
        .limit(1);

      if (pointsData && pointsData.length > 0) {
        const record = pointsData[0];
        
        // Get coureur data from coureurs_saisons + equipes_saisons
        let coureurNom = '';
        let equipe = '';
        let managerId = null;
        
        if (saisonId) {
          const { data: csData } = await supabase
            .from('coureurs_saisons')
            .select('coureur_id, coureurs!inner(nom), equipe_id')
            .eq('saison_id', saisonId)
            .eq('coureur_id', record.coureur_id)
            .limit(1);

          if (csData && csData.length > 0) {
            const cs = csData[0];
            coureurNom = (cs.coureurs as any)?.nom || '';
            
            if (cs.equipe_id) {
              const { data: equipeData } = await supabase
                .from('equipes_saisons')
                .select('nom_affiche')
                .eq('id', cs.equipe_id)
                .limit(1);
              equipe = equipeData?.[0]?.nom_affiche || '';
            }
          }
        }

        // Get manager_id from rosters
        if (phaseId) {
          const { data: rosterData } = await supabase
            .from('rosters')
            .select('manager_id')
            .eq('phase_id', phaseId)
            .eq('coureur_id', record.coureur_id)
            .limit(1);
          managerId = rosterData?.[0]?.manager_id || null;
        }

        bonuses.push({
          jersey_type: jersey.label.toLowerCase(),
          icon: jersey.icon,
          coureur_id: record.coureur_id,
          coureur_nom: coureurNom,
          equipe: equipe,
          manager_id: managerId,
          manager_nom: (record.managers as any).nom,
          points: record.points,
          is_my_rider: currentManagerId && managerId ? managerId === currentManagerId : false
        });
      }
    }

    console.log(`Returning ${bonuses.length} jersey bonuses`);

    return new Response(JSON.stringify({ bonuses }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in stage-jersey-bonuses:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
