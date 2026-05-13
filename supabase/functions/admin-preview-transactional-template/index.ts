import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import {
  EDITABLE_TEMPLATES,
  renderTemplateString,
} from '../_shared/transactional-email-templates/_overrides.ts'

// Preview a transactional template with optional draft overrides applied.
// Auth: requires a superadmin JWT. The frontend calls this from the admin UI
// to render an HTML preview before saving the override.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Missing auth' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Identify caller via anon-key client
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: hasSuper } = await admin.rpc('has_role', {
    _user_id: userRes.user.id,
    _role: 'superadmin',
  }).catch(() => ({ data: null }))
  if (!hasSuper) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const templateKey = body?.templateKey as string
  const draft = (body?.override ?? {}) as {
    subject?: string | null
    intro_html?: string | null
    cta_label?: string | null
  }

  const entry = TEMPLATES[templateKey]
  const meta = EDITABLE_TEMPLATES[templateKey]
  if (!entry || !meta) {
    return new Response(JSON.stringify({ error: 'Unknown template' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Build sample data from variable examples + the template's own previewData
  const sample: Record<string, unknown> = { ...(entry.previewData ?? {}) }
  for (const v of meta.variables) {
    if (sample[v.key] === undefined) sample[v.key] = v.example
  }

  const intro = draft.intro_html ?? meta.defaults.intro_html
  const cta = draft.cta_label ?? meta.defaults.cta_label
  const subject = draft.subject ?? meta.defaults.subject

  const renderedOverride = {
    intro_html: renderTemplateString(intro, sample),
    cta_label: cta || null,
  }

  const html = await renderAsync(
    React.createElement(entry.component, { ...sample, __override: renderedOverride })
  )
  const resolvedSubject = renderTemplateString(subject, sample)

  return new Response(
    JSON.stringify({ html, subject: resolvedSubject, sample }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
