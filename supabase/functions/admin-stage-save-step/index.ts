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

    const { course_id, etape_numero, top10, leaders, jersey_holders, change_reason } = await req.json();

    // Validations
    if (!course_id || !etape_numero) {
      return new Response(JSON.stringify({ error: 'course_id and etape_numero are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(top10) || top10.length !== 10) {
      return new Response(JSON.stringify({ error: 'top10 must contain exactly 10 positions' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!leaders?.general_leader_id || !leaders?.points_leader_id || !leaders?.montagne_leader_id) {
      return new Response(JSON.stringify({ error: 'All three leaders are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for duplicates in top10
    const coureurIds = top10.map(t => t.coureur_id);
    const uniqueIds = new Set(coureurIds);
    if (uniqueIds.size !== coureurIds.length) {
      return new Response(JSON.stringify({ error: 'Duplicate riders in top 10' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate positions are 1-10
    const positions = top10.map(t => t.position).sort((a, b) => a - b);
    const expectedPositions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
      return new Response(JSON.stringify({ error: 'Positions must be 1 through 10' }), {
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

    // Delete existing stage results
    await supabase
      .from('race_results')
      .delete()
      .eq('course_id', course_id)
      .eq('etape_numero', etape_numero);

    // Insert top 10
    const top10Inserts = top10.map(t => ({
      course_id,
      type_classement: 'Etape',
      etape_numero,
      coureur_id: t.coureur_id,
      position: t.position_decimal ? Math.floor(t.position_decimal) : t.position,
      position_decimal: t.position_decimal || null,
      statut: 'finished',
      date_classement,
      updated_by_manager_id: manager_id
    }));

    const { error: top10Error } = await supabase
      .from('race_results')
      .insert(top10Inserts);

    if (top10Error) throw top10Error;

    // Insert leaders
    const leadersInserts = [
      {
        course_id,
        type_classement: 'General',
        etape_numero,
        coureur_id: leaders.general_leader_id,
        position: 1,
        statut: 'finished',
        date_classement,
        updated_by_manager_id: manager_id
      },
      {
        course_id,
        type_classement: 'Points',
        etape_numero,
        coureur_id: leaders.points_leader_id,
        position: 1,
        statut: 'finished',
        date_classement,
        updated_by_manager_id: manager_id
      },
      {
        course_id,
        type_classement: 'Montagne',
        etape_numero,
        coureur_id: leaders.montagne_leader_id,
        position: 1,
        statut: 'finished',
        date_classement,
        updated_by_manager_id: manager_id
      }
    ];

    const { error: leadersError } = await supabase
      .from('race_results')
      .insert(leadersInserts);

    if (leadersError) throw leadersError;

    // Insert jersey holders if provided
    if (jersey_holders) {
      const jerseyInserts = [];
      
      if (jersey_holders.general_holder_id) {
        jerseyInserts.push({
          course_id,
          type_classement: 'Porteur Leader',
          etape_numero,
          coureur_id: jersey_holders.general_holder_id,
          position: 1,
          statut: 'finished',
          date_classement,
          updated_by_manager_id: manager_id
        });
      }
      
      if (jersey_holders.vert_holder_id) {
        jerseyInserts.push({
          course_id,
          type_classement: 'Porteur Vert',
          etape_numero,
          coureur_id: jersey_holders.vert_holder_id,
          position: 1,
          statut: 'finished',
          date_classement,
          updated_by_manager_id: manager_id
        });
      }
      
      if (jersey_holders.montagne_holder_id) {
        jerseyInserts.push({
          course_id,
          type_classement: 'Porteur Montagne',
          etape_numero,
          coureur_id: jersey_holders.montagne_holder_id,
          position: 1,
          statut: 'finished',
          date_classement,
          updated_by_manager_id: manager_id
        });
      }
      
      if (jersey_holders.jeune_holder_id) {
        jerseyInserts.push({
          course_id,
          type_classement: 'Porteur Jeune',
          etape_numero,
          coureur_id: jersey_holders.jeune_holder_id,
          position: 1,
          statut: 'finished',
          date_classement,
          updated_by_manager_id: manager_id
        });
      }
      
      if (jersey_holders.combattif_holder_id) {
        jerseyInserts.push({
          course_id,
          type_classement: 'Porteur Combattif',
          etape_numero,
          coureur_id: jersey_holders.combattif_holder_id,
          position: 1,
          statut: 'finished',
          date_classement,
          updated_by_manager_id: manager_id
        });
      }

      if (jerseyInserts.length > 0) {
        // Delete existing jersey holders first
        await supabase
          .from('race_results')
          .delete()
          .eq('course_id', course_id)
          .eq('etape_numero', etape_numero)
          .in('type_classement', ['Porteur Leader', 'Porteur Vert', 'Porteur Montagne', 'Porteur Jeune', 'Porteur Combattif']);

        const { error: jerseyError } = await supabase
          .from('race_results')
          .insert(jerseyInserts);

        if (jerseyError) throw jerseyError;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      etape_numero,
      message: `Étape ${etape_numero} enregistrée avec succès` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-stage-save-step:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
