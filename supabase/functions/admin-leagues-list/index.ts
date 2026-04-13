import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
    });
    const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isSuperAdmin } = await supabaseAuthClient.rpc('is_superadmin');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Accès refusé: réservé aux super-administrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const gameMode = url.searchParams.get('game_mode');
    const visibility = url.searchParams.get('visibility');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sortOrder = url.searchParams.get('sort_order') === 'asc' ? true : false;

    let query = supabaseAdminClient
      .from('leagues')
      .select(`
        *,
        owner:managers!owner_manager_id(id, nom, email),
        members:league_members(count),
        member_users:league_members(user_id),
        invites:league_invites!league_invites_league_id_fkey(count),
        scopes:league_scopes(selected_course_ids)
      `, { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (gameMode) query = query.eq('game_mode', gameMode);
    if (visibility) query = query.eq('visibility', visibility);
    if (search) query = query.ilike('name', `%${search}%`);

    query = query
      .range(page * limit, (page + 1) * limit - 1)
      .order('created_at', { ascending: sortOrder });

    const { data: leagues, error, count } = await query;

    if (error) {
      console.error('Error fetching leagues:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect all user_ids from members and all course_ids from scopes
    const allUserIds = new Set<string>();
    const allCourseIds = new Set<string>();

    for (const league of leagues || []) {
      for (const m of league.member_users || []) {
        if (m.user_id) allUserIds.add(m.user_id);
      }
      for (const s of league.scopes || []) {
        if (s.selected_course_ids) {
          for (const id of s.selected_course_ids) {
            allCourseIds.add(id);
          }
        }
      }
    }

    // Batch resolve user_ids -> manager names
    const managerMap = new Map<string, string>();
    if (allUserIds.size > 0) {
      const { data: managers } = await supabaseAdminClient
        .from('managers')
        .select('user_id, nom')
        .in('user_id', Array.from(allUserIds));
      for (const m of managers || []) {
        managerMap.set(m.user_id, m.nom);
      }
    }

    // Batch resolve course_ids -> course names
    const courseMap = new Map<string, string>();
    if (allCourseIds.size > 0) {
      const { data: courses } = await supabaseAdminClient
        .from('courses')
        .select('id, nom')
        .in('id', Array.from(allCourseIds));
      for (const c of courses || []) {
        courseMap.set(c.id, c.nom);
      }
    }

    const transformedLeagues = (leagues || []).map(league => {
      const memberUserIds: string[] = (league.member_users || []).map((m: any) => m.user_id);
      const memberNames = memberUserIds.map(uid => managerMap.get(uid) || 'Inconnu');

      const scopeCourseIds: string[] = [];
      for (const s of league.scopes || []) {
        if (s.selected_course_ids) {
          scopeCourseIds.push(...s.selected_course_ids);
        }
      }
      const courseNames = [...new Set(scopeCourseIds)].map(id => courseMap.get(id) || id);

      return {
        ...league,
        member_count: league.members?.[0]?.count || 0,
        invite_count: league.invites?.[0]?.count || 0,
        owner_name: league.owner?.nom || 'N/A',
        owner_email: league.owner?.email || null,
        member_names: memberNames,
        course_names: courseNames,
        // Clean up nested data
        member_users: undefined,
        scopes: undefined,
      };
    });

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
        payload_json: JSON.stringify({ status, gameMode, visibility, search, page, limit, result_count: transformedLeagues.length }),
      });
    }

    return new Response(
      JSON.stringify({ leagues: transformedLeagues, total: count || 0, page, limit }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
