import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { result } = await req.json();

    if (!result || !result.managers) {
      return new Response(
        JSON.stringify({ error: 'result requis avec managers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build CSV
    let csv = 'Manager,Coureur,Equipe,Code Equipe\n';
    
    for (const manager of result.managers) {
      for (const starter of manager.starters) {
        const row = [
          manager.manager_nom,
          starter.nom,
          starter.equipe || '',
          starter.team_code || ''
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',');
        csv += row + '\n';
      }
    }

    // Add no_owner section
    if (result.no_owner && result.no_owner.length > 0) {
      csv += '\nSans propriétaire,,,\n';
      for (const rider of result.no_owner) {
        const row = [
          'Sans propriétaire',
          rider.nom,
          rider.equipe || '',
          rider.team_code || ''
        ].map(field => `"${(field || '').replace(/"/g, '""')}"`).join(',');
        csv += row + '\n';
      }
    }

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="startlist_export.csv"`
      }
    });

  } catch (error) {
    console.error('Error in startlist-export-csv-from-text:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});