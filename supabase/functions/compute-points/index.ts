import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

console.log('compute-points function starting')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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
    )

    const { course_id, phase_id } = await req.json()

    console.log('Request params:', { course_id, phase_id })

    if (!course_id && !phase_id) {
      return new Response(
        JSON.stringify({ error: 'course_id or phase_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result

    if (course_id) {
      console.log('Computing points for course:', course_id)
      const { data, error } = await supabaseClient.rpc('admin_compute_points_for_course', {
        p_course_id: course_id
      })

      if (error) {
        console.error('Error computing points for course:', error)
        throw error
      }

      result = data
      console.log('Course computation result:', result)
    } else if (phase_id) {
      console.log('Computing points for phase:', phase_id)
      const { data, error } = await supabaseClient.rpc('admin_recompute_points_for_phase', {
        p_phase_id: phase_id
      })

      if (error) {
        console.error('Error computing points for phase:', error)
        throw error
      }

      result = data
      console.log('Phase computation result:', result)
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in compute-points function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
