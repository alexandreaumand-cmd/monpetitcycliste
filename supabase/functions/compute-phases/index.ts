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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify admin role
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roles) {
      throw new Error('Admin access required')
    }

    console.log('Computing phases for courses...')

    // Get all courses with dates
    const { data: courses, error: coursesError } = await supabaseClient
      .from('courses')
      .select('id, nom, date_debut, date_fin')
      .not('date_debut', 'is', null)

    if (coursesError) {
      throw coursesError
    }

    // Get all phases
    const { data: phases, error: phasesError } = await supabaseClient
      .from('phases')
      .select('id, date_debut, date_fin')
      .order('date_debut')

    if (phasesError) {
      throw phasesError
    }

    let assigned = 0
    let unassigned = 0

    for (const course of courses || []) {
      // Find matching phase
      const matchedPhase = phases?.find(p => {
        const courseStart = new Date(course.date_debut!)
        const phaseStart = new Date(p.date_debut)
        const phaseEnd = new Date(p.date_fin)
        
        return courseStart >= phaseStart && courseStart <= phaseEnd
      })

      if (matchedPhase) {
        const { error: updateError } = await supabaseClient
          .from('courses')
          .update({ phase_id: matchedPhase.id })
          .eq('id', course.id)

        if (updateError) {
          console.error(`Error assigning phase to ${course.nom}:`, updateError)
        } else {
          assigned++
        }
      } else {
        console.log(`No phase found for ${course.nom} (${course.date_debut})`)
        unassigned++
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        assigned,
        unassigned,
        message: `Assigned ${assigned} courses to phases. ${unassigned} courses remain unassigned.` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Compute phases error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
