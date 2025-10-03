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

  // Build query for races with results
  let racesQuery = supabase
    .from('race_results')
    .select('course_id, date_classement')
    .order('date_classement', { ascending: false })

  const { data: resultsData, error: resultsError } = await racesQuery

  if (resultsError) {
    console.error('Error fetching race results:', resultsError)
    return new Response(JSON.stringify({ error: resultsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get unique course IDs
  const courseIds = [...new Set(resultsData?.map((r: any) => r.course_id) || [])]
  
  if (courseIds.length === 0) {
    return new Response(JSON.stringify({ races: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get course details
  let coursesQuery = supabase
    .from('courses')
    .select(`
      id,
      nom,
      date_debut,
      date_fin,
      categorie,
      phase_id,
      phases!inner(saison_id)
    `)
    .in('id', courseIds.slice(0, 50)) // Limit to 50 courses

  if (phase_id) {
    coursesQuery = coursesQuery.eq('phase_id', phase_id)
  } else if (saison_id) {
    coursesQuery = coursesQuery.eq('phases.saison_id', saison_id)
  }

  if (search) {
    coursesQuery = coursesQuery.ilike('nom', `%${search}%`)
  }

  const { data: courses, error: coursesError } = await coursesQuery

  if (coursesError) {
    console.error('Error fetching courses:', coursesError)
    return new Response(JSON.stringify({ error: coursesError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // For each course, get additional data
  const racesWithData = await Promise.all(
    courses?.slice(0, limit).map(async (course: any) => {
      // Get types of classifications available
      const { data: typesData } = await supabase
        .from('race_results')
        .select('type_classement')
        .eq('course_id', course.id)

      const types = [...new Set(typesData?.map((t: any) => t.type_classement) || [])]

      // Get last result date
      const { data: lastResultData } = await supabase
        .from('race_results')
        .select('date_classement')
        .eq('course_id', course.id)
        .order('date_classement', { ascending: false })
        .limit(1)
        .single()

      // Get my points for this course
      const { data: pointsData } = await supabase
        .from('points_ledger')
        .select('points')
        .eq('course_id', course.id)
        .eq('manager_id', managerId)

      const my_points = pointsData?.reduce((sum: number, p: any) => sum + (p.points || 0), 0) || 0

      // Check if any points exist for this course
      const { data: hasPointsData } = await supabase
        .from('points_ledger')
        .select('id')
        .eq('course_id', course.id)
        .limit(1)

      return {
        course_id: course.id,
        nom: course.nom,
        date_debut: course.date_debut,
        date_fin: course.date_fin,
        categorie: course.categorie,
        phase_id: course.phase_id,
        last_result_at: lastResultData?.date_classement || null,
        types,
        my_points,
        has_points: (hasPointsData?.length || 0) > 0
      }
    }) || []
  )

  // Sort by last_result_at desc
  racesWithData.sort((a, b) => {
    if (!a.last_result_at) return 1
    if (!b.last_result_at) return -1
    return new Date(b.last_result_at).getTime() - new Date(a.last_result_at).getTime()
  })

  return new Response(JSON.stringify({ races: racesWithData }), {
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
