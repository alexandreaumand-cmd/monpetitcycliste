import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get manager_id for the user
    const { data: manager } = await supabase
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!manager) {
      return new Response(JSON.stringify({ error: 'Manager not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { action, ...params } = await req.json()

    if (action === 'recent_races') {
      return await handleRecentRaces(supabase, manager.id, params)
    } else if (action === 'course_results') {
      return await handleCourseResults(supabase, manager.id, params)
    } else if (action === 'course_leaderboard') {
      return await handleCourseLeaderboard(supabase, params)
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function handleRecentRaces(supabase: any, managerId: string, params: any) {
  const { saison_id, phase_id, search, limit = 10 } = params

  let query = `
    SELECT DISTINCT ON (c.id)
      c.id as course_id,
      c.nom,
      c.date_debut,
      c.date_fin,
      c.categorie,
      c.phase_id,
      MAX(rr.date_classement) as last_result_at,
      ARRAY_AGG(DISTINCT rr.type_classement) as types,
      COALESCE(SUM(pl.points) FILTER (WHERE pl.manager_id = $1), 0) as my_points,
      EXISTS(SELECT 1 FROM points_ledger WHERE course_id = c.id) as has_points
    FROM courses c
    INNER JOIN race_results rr ON rr.course_id = c.id
    LEFT JOIN points_ledger pl ON pl.course_id = c.id AND pl.manager_id = $1
  `

  const queryParams: any[] = [managerId]
  let paramIndex = 2

  if (phase_id) {
    query += ` WHERE c.phase_id = $${paramIndex}`
    queryParams.push(phase_id)
    paramIndex++
  } else if (saison_id) {
    query += ` INNER JOIN phases p ON p.id = c.phase_id WHERE p.saison_id = $${paramIndex}`
    queryParams.push(saison_id)
    paramIndex++
  }

  if (search) {
    query += phase_id || saison_id ? ' AND' : ' WHERE'
    query += ` c.nom ILIKE $${paramIndex}`
    queryParams.push(`%${search}%`)
    paramIndex++
  }

  query += `
    GROUP BY c.id, c.nom, c.date_debut, c.date_fin, c.categorie, c.phase_id
    ORDER BY c.id, last_result_at DESC NULLS LAST, c.date_fin DESC
    LIMIT $${paramIndex}
  `
  queryParams.push(limit)

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: query,
    params: queryParams
  })

  if (error) {
    console.error('Error fetching recent races:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ races: data || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleCourseResults(supabase: any, managerId: string, params: any) {
  const { course_id, type_classement, etape_numero } = params

  if (!course_id || !type_classement) {
    return new Response(JSON.stringify({ error: 'course_id and type_classement required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get course info
  const { data: course } = await supabase
    .from('courses')
    .select('nom, date_debut, date_fin, categorie, phase_id')
    .eq('id', course_id)
    .single()

  if (!course) {
    return new Response(JSON.stringify({ error: 'Course not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get available types and etapes
  const { data: typesData } = await supabase
    .from('race_results')
    .select('type_classement, etape_numero')
    .eq('course_id', course_id)

  const types_disponibles = [...new Set(typesData?.map((r: any) => r.type_classement) || [])]
  const etapesSet = type_classement === 'Etape'
    ? new Set(typesData?.filter((r: any) => r.type_classement === 'Etape').map((r: any) => r.etape_numero).filter(Boolean))
    : new Set()
  const etapes_disponibles = Array.from(etapesSet).sort((a, b) => (a as number) - (b as number))

  // Get results
  let resultsQuery = supabase
    .from('race_results')
    .select(`
      position,
      statut,
      coureur_id,
      coureurs!inner(nom, equipe)
    `)
    .eq('course_id', course_id)
    .eq('type_classement', type_classement)

  if (type_classement === 'Etape' && etape_numero) {
    resultsQuery = resultsQuery.eq('etape_numero', etape_numero)
  }

  const { data: results, error: resultsError } = await resultsQuery

  if (resultsError) {
    console.error('Error fetching results:', resultsError)
    return new Response(JSON.stringify({ error: resultsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check which riders belong to manager
  const { data: myRiders } = await supabase
    .from('rosters')
    .select('coureur_id')
    .eq('phase_id', course.phase_id)
    .eq('manager_id', managerId)

  const myRiderIds = new Set(myRiders?.map((r: any) => r.coureur_id) || [])

  // Get my points for this course
  const { data: myPointsData } = await supabase
    .from('points_ledger')
    .select('points')
    .eq('course_id', course_id)
    .eq('manager_id', managerId)

  const my_points_course = myPointsData?.reduce((sum: number, p: any) => sum + (p.points || 0), 0) || 0

  const rows = results?.map((r: any) => ({
    position: r.position,
    statut: r.statut,
    coureur_id: r.coureur_id,
    coureur_nom: r.coureurs.nom,
    equipe: r.coureurs.equipe,
    is_my_rider: myRiderIds.has(r.coureur_id),
  })).sort((a: any, b: any) => {
    if (a.position === null) return 1
    if (b.position === null) return -1
    return a.position - b.position
  }) || []

  return new Response(JSON.stringify({
    rows,
    meta: {
      course_nom: course.nom,
      date_debut: course.date_debut,
      date_fin: course.date_fin,
      categorie: course.categorie,
      types_disponibles,
      etapes_disponibles,
      my_points_course,
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleCourseLeaderboard(supabase: any, params: any) {
  const { course_id } = params

  if (!course_id) {
    return new Response(JSON.stringify({ error: 'course_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: leaders } = await supabase
    .from('points_ledger')
    .select(`
      manager_id,
      points,
      managers!inner(nom)
    `)
    .eq('course_id', course_id)

  const leaderboard = Object.values(
    leaders?.reduce((acc: any, curr: any) => {
      const managerId = curr.manager_id
      if (!acc[managerId]) {
        acc[managerId] = {
          manager_id: managerId,
          manager_nom: curr.managers.nom,
          total_points: 0
        }
      }
      acc[managerId].total_points += curr.points || 0
      return acc
    }, {}) || {}
  ).sort((a: any, b: any) => b.total_points - a.total_points)

  return new Response(JSON.stringify({ leaders: leaderboard }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
