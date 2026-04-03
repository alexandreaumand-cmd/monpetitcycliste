import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Client with JWT for authentication checks
    const supabaseAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
    });

    // Client with service role only to bypass RLS
    const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check superadmin role
    const { data: isSuperAdmin } = await supabaseAuthClient.rpc('is_superadmin');
    console.log('admin-leagues-list user', user?.id, 'isSuperAdmin', isSuperAdmin);
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: réservé aux super-administrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query params
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const gameMode = url.searchParams.get('game_mode');
    const visibility = url.searchParams.get('visibility');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Build query with admin client to bypass RLS
    let query = supabaseAdminClient
      .from('leagues')
      .select(`
        *,
        owner:managers!owner_manager_id(id, nom, email),
        members:league_members(count),
        invites:league_invites!league_invites_league_id_fkey(count)
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (gameMode) {
      query = query.eq('game_mode', gameMode);
    }
    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    query = query
      .range(page * limit, (page + 1) * limit - 1)
      .order('created_at', { ascending: false });

    const { data: leagues, error, count } = await query;

    if (error) {
      console.error('Error fetching leagues:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform data to include member and invite counts
    const transformedLeagues = leagues?.map(league => ({
      ...league,
      member_count: league.members?.[0]?.count || 0,
      invite_count: league.invites?.[0]?.count || 0,
      owner_name: league.owner?.nom || 'N/A',
      owner_email: league.owner?.email || null,
    })) || [];

    // Log action
    const { data: managerData } = await supabaseAdminClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (managerData) {
      await supabaseAdminClient.from('audits').insert({
        actor_manager_id: managerData.id,
        action: 'admin_leagues_list',
        payload_json: JSON.stringify({ 
          status, 
          gameMode, 
          visibility, 
          search, 
          page, 
          limit,
          result_count: transformedLeagues.length 
        }),
      });
    }

    return new Response(
      JSON.stringify({
        leagues: transformedLeagues,
        total: count || 0,
        page,
        limit,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in admin-leagues-list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
