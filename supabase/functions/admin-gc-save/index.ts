import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Check superadmin role
    const { data: isSuperAdmin } = await supabase.rpc('is_superadmin');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: réservé aux superadministrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_id, general_top, jersey_winners, change_reason } = await req.json();

    if (!course_id || !Array.isArray(general_top) || !jersey_winners) {
      return new Response(JSON.stringify({ error: 'Invalid request parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get course and verify all stages are complete
    const overviewResponse = await fetch(`${supabaseUrl}/functions/v1/admin-stage-overview`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization')!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ course_id })
    });

    const overview = await overviewResponse.json();

    if (!overview.gc_requirements.all_stages_complete) {
      const incomplete = overview.stages
        .filter((s: any) => !s.is_complete)
        .map((s: any) => `#${s.etape_numero}`)
        .join(', ');
      
      return new Response(JSON.stringify({ 
        error: `Toutes les étapes doivent être complètes. Étapes manquantes : ${incomplete}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const required_top = overview.gc_requirements.required_top;
    const required_jerseys = overview.gc_requirements.required_jerseys;

    // Validate general_top size
    if (general_top.length !== required_top) {
      return new Response(JSON.stringify({ 
        error: `Le classement général doit contenir exactement ${required_top} positions` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check positions are contiguous from 1
    const positions = general_top.map((t: any) => t.position).sort((a: number, b: number) => a - b);
    const expectedPositions = Array.from({ length: required_top }, (_, i) => i + 1);
    if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
      return new Response(JSON.stringify({ 
        error: `Les positions doivent être de 1 à ${required_top}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for duplicates
    const coureurIds = general_top.map((t: any) => t.coureur_id);
    const uniqueIds = new Set(coureurIds);
    if (uniqueIds.size !== coureurIds.length) {
      return new Response(JSON.stringify({ error: 'Coureurs en double dans le classement général' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required jerseys
    if (!jersey_winners.general_winner_id) {
      return new Response(JSON.stringify({ error: 'Le vainqueur général est requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (required_jerseys.includes('Points') && !jersey_winners.points_winner_id) {
      return new Response(JSON.stringify({ error: 'Le vainqueur du classement par points est requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (required_jerseys.includes('Montagne') && !jersey_winners.montagne_winner_id) {
      return new Response(JSON.stringify({ error: 'Le vainqueur du classement de la montagne est requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (required_jerseys.includes('Jeune') && !jersey_winners.jeune_winner_id) {
      return new Response(JSON.stringify({ error: 'Le vainqueur du classement des jeunes est requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get course info
    const { data: course } = await supabase
      .from('courses')
      .select('date_fin, date_debut')
      .eq('id', course_id)
      .single();

    const date_classement = course?.date_fin || course?.date_debut || new Date().toISOString().split('T')[0];

    // Get manager_id for audit
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const manager_id = manager?.id;

    // Delete existing GC results (etape_numero = NULL)
    await supabase
      .from('race_results')
      .delete()
      .eq('course_id', course_id)
      .is('etape_numero', null);

    // Insert general classification top
    const gcInserts = general_top.map((t: any) => ({
      course_id,
      type_classement: 'General',
      etape_numero: null,
      coureur_id: t.coureur_id,
      position: t.position,
      statut: 'finished',
      date_classement,
      updated_by_manager_id: manager_id
    }));

    const { error: gcError } = await supabase
      .from('race_results')
      .insert(gcInserts);

    if (gcError) throw gcError;

    // Insert jersey winners (only if different from position 1 of general_top)
    const jerseyInserts = [];

    // Points winner
    if (required_jerseys.includes('Points') && jersey_winners.points_winner_id) {
      jerseyInserts.push({
        course_id,
        type_classement: 'Points',
        etape_numero: null,
        coureur_id: jersey_winners.points_winner_id,
        position: 1,
        statut: 'finished',
        date_classement,
        updated_by_manager_id: manager_id
      });
    }

    // Montagne winner
    if (required_jerseys.includes('Montagne') && jersey_winners.montagne_winner_id) {
      jerseyInserts.push({
        course_id,
        type_classement: 'Montagne',
        etape_numero: null,
        coureur_id: jersey_winners.montagne_winner_id,
        position: 1,
        statut: 'finished',
        date_classement,
        updated_by_manager_id: manager_id
      });
    }

    // Jeune winner
    if (required_jerseys.includes('Jeune') && jersey_winners.jeune_winner_id) {
      jerseyInserts.push({
        course_id,
        type_classement: 'Jeune',
        etape_numero: null,
        coureur_id: jersey_winners.jeune_winner_id,
        position: 1,
        statut: 'finished',
        date_classement,
        updated_by_manager_id: manager_id
      });
    }

    if (jerseyInserts.length > 0) {
      const { error: jerseyError } = await supabase
        .from('race_results')
        .insert(jerseyInserts);

      if (jerseyError) throw jerseyError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Classement général enregistré avec succès',
      general_top_count: general_top.length,
      jerseys_count: jerseyInserts.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-gc-save:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
