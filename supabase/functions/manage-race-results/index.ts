import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResultUpdate {
  race_result_id: string;
  new_position?: number | null;
  new_statut: string;
  change_reason?: string;
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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Non authentifié');
    }

    // Verify admin role
    const { data: isAdmin } = await supabaseClient.rpc('is_admin');
    if (!isAdmin) {
      throw new Error('Accès réservé aux administrateurs');
    }

    // Get manager_id for current user
    const { data: manager } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!manager) {
      throw new Error('Manager non trouvé');
    }

    const { action, ...params } = await req.json();

    console.log(`Action: ${action}`, params);

    switch (action) {
      case 'list_results':
        return await listResults(supabaseClient, params);
      
      case 'get_history':
        return await getHistory(supabaseClient, params);
      
      case 'update_result':
        return await updateResult(supabaseClient, params, manager.id);
      
      case 'bulk_update':
        return await bulkUpdate(supabaseClient, params, manager.id);
      
      case 'revert_result':
        return await revertResult(supabaseClient, params, manager.id);
      
      case 'delete_result':
        return await deleteResult(supabaseClient, params, manager.id);
      
      default:
        throw new Error(`Action inconnue: ${action}`);
    }
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function listResults(supabaseClient: any, params: any) {
  const { course_id, type_classement, etape_numero, search } = params;

  let query = supabaseClient
    .from('v_race_results_editable')
    .select('*')
    .eq('course_id', course_id)
    .eq('type_classement', type_classement);

  if (etape_numero !== null && etape_numero !== undefined) {
    query = query.eq('etape_numero', etape_numero);
  }

  if (search) {
    query = query.ilike('coureur_nom', `%${search}%`);
  }

  query = query.order('position', { ascending: true, nullsFirst: false });

  const { data, error } = await query;

  if (error) throw error;

  return new Response(
    JSON.stringify({ results: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getHistory(supabaseClient: any, params: any) {
  const { race_result_id } = params;

  const { data, error } = await supabaseClient
    .from('race_results_history')
    .select(`
      *,
      changed_by:managers!changed_by_manager_id(nom)
    `)
    .eq('race_result_id', race_result_id)
    .order('changed_at', { ascending: false });

  if (error) throw error;

  return new Response(
    JSON.stringify({ history: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function updateResult(
  supabaseClient: any,
  params: any,
  manager_id: string
) {
  const { race_result_id, new_position, new_statut, change_reason } = params;

  // Get current result
  const { data: currentResult, error: fetchError } = await supabaseClient
    .from('race_results')
    .select('*')
    .eq('id', race_result_id)
    .single();

  if (fetchError) throw fetchError;

  // Normalize: if not finished, position must be null
  const normalizedPosition = new_statut === 'finished' ? new_position : null;

  // Create history entry
  const { error: historyError } = await supabaseClient
    .from('race_results_history')
    .insert({
      race_result_id,
      course_id: currentResult.course_id,
      type_classement: currentResult.type_classement,
      etape_numero: currentResult.etape_numero,
      coureur_id: currentResult.coureur_id,
      old_position: currentResult.position,
      old_statut: currentResult.statut,
      new_position: normalizedPosition,
      new_statut,
      change_reason,
      changed_by_manager_id: manager_id,
      action_type: 'update'
    });

  if (historyError) throw historyError;

  // Update result
  const { data: updated, error: updateError } = await supabaseClient
    .from('race_results')
    .update({
      position: normalizedPosition,
      statut: new_statut,
      updated_at: new Date().toISOString(),
      updated_by_manager_id: manager_id
    })
    .eq('id', race_result_id)
    .select()
    .single();

  if (updateError) throw updateError;

  // Audit log
  await supabaseClient.from('audits').insert({
    action: 'update_race_result',
    actor_manager_id: manager_id,
    payload_json: JSON.stringify({
      race_result_id,
      old: { position: currentResult.position, statut: currentResult.statut },
      new: { position: normalizedPosition, statut: new_statut },
      reason: change_reason
    })
  });

  return new Response(
    JSON.stringify({
      result: updated,
      delta: {
        old: { position: currentResult.position, statut: currentResult.statut },
        new: { position: normalizedPosition, statut: new_statut }
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function bulkUpdate(
  supabaseClient: any,
  params: any,
  manager_id: string
) {
  const { rows } = params as { rows: ResultUpdate[] };

  const results = [];
  const errors = [];

  for (const row of rows) {
    try {
      const response = await updateResult(supabaseClient, row, manager_id);
      const data = await response.json();
      results.push({ id: row.race_result_id, success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ id: row.race_result_id, error: message });
    }
  }

  return new Response(
    JSON.stringify({ results, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function revertResult(
  supabaseClient: any,
  params: any,
  manager_id: string
) {
  const { race_result_id, history_id, revert_reason } = params;

  // Get target history entry
  const { data: targetHistory, error: historyFetchError } = await supabaseClient
    .from('race_results_history')
    .select('*')
    .eq('id', history_id)
    .single();

  if (historyFetchError) throw historyFetchError;

  // Get current result
  const { data: currentResult, error: fetchError } = await supabaseClient
    .from('race_results')
    .select('*')
    .eq('id', race_result_id)
    .single();

  if (fetchError) throw fetchError;

  // Restore to old values from target history
  const restoredPosition = targetHistory.old_position;
  const restoredStatut = targetHistory.old_statut;

  // Create history entry for revert
  const { error: historyError } = await supabaseClient
    .from('race_results_history')
    .insert({
      race_result_id,
      course_id: currentResult.course_id,
      type_classement: currentResult.type_classement,
      etape_numero: currentResult.etape_numero,
      coureur_id: currentResult.coureur_id,
      old_position: currentResult.position,
      old_statut: currentResult.statut,
      new_position: restoredPosition,
      new_statut: restoredStatut,
      change_reason: revert_reason,
      changed_by_manager_id: manager_id,
      action_type: 'revert'
    });

  if (historyError) throw historyError;

  // Update result
  const { data: updated, error: updateError } = await supabaseClient
    .from('race_results')
    .update({
      position: restoredPosition,
      statut: restoredStatut,
      updated_at: new Date().toISOString(),
      updated_by_manager_id: manager_id
    })
    .eq('id', race_result_id)
    .select()
    .single();

  if (updateError) throw updateError;

  // Audit log
  await supabaseClient.from('audits').insert({
    action: 'revert_race_result',
    actor_manager_id: manager_id,
    payload_json: JSON.stringify({
      race_result_id,
      reverted_to_history_id: history_id,
      reason: revert_reason
    })
  });

  return new Response(
    JSON.stringify({ result: updated }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deleteResult(
  supabaseClient: any,
  params: any,
  manager_id: string
) {
  const { race_result_id, reason } = params;

  // Get current result before deletion
  const { data: currentResult, error: fetchError } = await supabaseClient
    .from('race_results')
    .select('*')
    .eq('id', race_result_id)
    .single();

  if (fetchError) throw fetchError;

  // Create history entry for deletion
  const { error: historyError } = await supabaseClient
    .from('race_results_history')
    .insert({
      race_result_id,
      course_id: currentResult.course_id,
      type_classement: currentResult.type_classement,
      etape_numero: currentResult.etape_numero,
      coureur_id: currentResult.coureur_id,
      old_position: currentResult.position,
      old_statut: currentResult.statut,
      new_position: null,
      new_statut: null,
      change_reason: reason,
      changed_by_manager_id: manager_id,
      action_type: 'delete'
    });

  if (historyError) throw historyError;

  // Delete result
  const { error: deleteError } = await supabaseClient
    .from('race_results')
    .delete()
    .eq('id', race_result_id);

  if (deleteError) throw deleteError;

  // Audit log
  await supabaseClient.from('audits').insert({
    action: 'delete_race_result',
    actor_manager_id: manager_id,
    payload_json: JSON.stringify({
      race_result_id,
      deleted_result: currentResult,
      reason
    })
  });

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
