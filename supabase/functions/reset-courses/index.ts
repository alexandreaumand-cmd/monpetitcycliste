import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetRequest {
  type: 'by_saison' | 'all'
  saison_id?: string
  confirm_phrase: string
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

    const { type, saison_id, confirm_phrase }: ResetRequest = await req.json()

    // Get manager ID for audit
    const { data: manager } = await supabaseClient
      .from('managers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const manager_id = manager?.id

    let deleted_count = 0
    let action = ''
    let payload: any = {}

    if (type === 'by_saison') {
      // Verify confirmation phrase
      if (confirm_phrase !== 'RESET COURSES SAISON') {
        throw new Error('Phrase de confirmation incorrecte')
      }

      if (!saison_id) {
        throw new Error('saison_id is required for by_saison reset')
      }

      // Get phases for this saison
      const { data: phases } = await supabaseClient
        .from('phases')
        .select('id')
        .eq('saison_id', saison_id)

      if (!phases || phases.length === 0) {
        throw new Error('No phases found for this saison')
      }

      const phase_ids = phases.map(p => p.id)

      // Delete courses for these phases
      const { error: deleteError, count } = await supabaseClient
        .from('courses')
        .delete({ count: 'exact' })
        .in('phase_id', phase_ids)

      if (deleteError) throw deleteError

      deleted_count = count || 0
      action = 'admin_courses_reset_by_saison'
      payload = { saison_id, deleted_count }

    } else if (type === 'all') {
      // Verify confirmation phrase
      if (confirm_phrase !== 'RESET ALL COURSES') {
        throw new Error('Phrase de confirmation incorrecte')
      }

      // Delete all courses
      const { error: deleteError, count } = await supabaseClient
        .from('courses')
        .delete({ count: 'exact' })
        .neq('id', '') // Delete all (workaround for RLS)

      if (deleteError) throw deleteError

      deleted_count = count || 0
      action = 'admin_courses_reset_all'
      payload = { deleted_count }
    }

    // Insert audit log
    if (manager_id) {
      await supabaseClient
        .from('audits')
        .insert({
          actor_manager_id: manager_id,
          action,
          payload_json: JSON.stringify(payload),
        })
    }

    console.log(`✅ Deleted ${deleted_count} courses (${action})`)

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count,
        message: `${deleted_count} courses supprimées avec succès`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Reset error:', error)
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
