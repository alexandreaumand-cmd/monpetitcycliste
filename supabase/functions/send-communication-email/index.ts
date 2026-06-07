import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ROOT_DOMAIN = Deno.env.get('EMAIL_ROOT_DOMAIN') || 'labordure.app';
const FROM_DOMAIN = Deno.env.get('EMAIL_FROM_DOMAIN') || ROOT_DOMAIN;
const DEFAULT_SENDER_DOMAIN = `notify.${ROOT_DOMAIN}`;
const SENDER_DOMAIN = Deno.env.get('EMAIL_SENDER_DOMAIN') || DEFAULT_SENDER_DOMAIN;
const SITE_NAME = Deno.env.get('EMAIL_SITE_NAME') || 'La Bordure';

const MAX_RECIPIENTS = 500;
const MAX_SUBJECT = 300;
const MAX_BODY = 100_000;

function sanitizeHtml(html: string): string {
  let out = html;
  out = out.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  out = out.replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/javascript\s*:/gi, '');
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function substituteVariables(
  template: string,
  vars: { prenom: string; email: string; nom_manager: string }
): string {
  return template
    .replace(/\{\{\s*prenom\s*\}\}/gi, escapeHtml(vars.prenom))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHtml(vars.email))
    .replace(/\{\{\s*nom_manager\s*\}\}/gi, escapeHtml(vars.nom_manager));
}

function wrapEmail(bodyHtml: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1f5132;color:#ffffff;padding:20px 24px;">
          <h1 style="margin:0;font-size:20px;font-weight:600;">${escapeHtml(SITE_NAME)}</h1>
        </td></tr>
        <tr><td style="padding:24px;font-size:15px;line-height:1.6;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center;">
          <p style="margin:0 0 8px 0;">Vous recevez cet email parce que vous êtes inscrit sur ${escapeHtml(SITE_NAME)}.</p>
          <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Se désinscrire</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !ANON_KEY) {
      console.error('[send-communication-email] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return jsonResponse({ error: 'Configuration serveur manquante' }, 500);
    }
    if (!SERVICE_ROLE) {
      console.error('[send-communication-email] Missing SUPABASE_SERVICE_ROLE_KEY');
      return jsonResponse({ error: 'SERVICE_ROLE_MISSING' }, 500);
    }

    // Extract JWT explicitly from Authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      console.error('[send-communication-email] No Authorization header / token');
      return jsonResponse({ error: 'Non authentifié (token manquant)' }, 401);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve user from token using service role (most reliable)
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error('[send-communication-email] getUser failed:', userErr?.message);
      return jsonResponse({ error: 'Non authentifié (token invalide)' }, 401);
    }
    const user = userData.user;

    // Verify super-admin via direct table read with service role
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    if (rolesErr) {
      console.error('[send-communication-email] roles read error:', rolesErr.message);
      return jsonResponse({ error: 'Erreur de vérification des permissions' }, 500);
    }
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isSuperAdmin = roleSet.has('superadmin') || roleSet.has('admin');
    if (!isSuperAdmin) {
      console.warn('[send-communication-email] user is not super-admin', user.id, [...roleSet]);
      return jsonResponse({ error: 'Réservé aux super-administrateurs' }, 403);
    }

    const body = await req.json();
    const subject = (body.subject ?? '').toString().trim();
    const bodyHtmlRaw = (body.body_html ?? '').toString();
    const templateId = body.template_id ?? null;
    const recipientUserIds: string[] = Array.isArray(body.recipient_user_ids) ? body.recipient_user_ids : [];
    const scheduledAtRaw = body.scheduled_at ?? null;

    // Validate scheduled_at if provided
    let scheduledAt: Date | null = null;
    if (scheduledAtRaw !== null && scheduledAtRaw !== undefined && scheduledAtRaw !== '') {
      const d = new Date(scheduledAtRaw);
      if (isNaN(d.getTime())) {
        return jsonResponse({ error: 'Date programmée invalide' }, 400);
      }
      const now = Date.now();
      const minTs = now + 60_000; // +60s
      const maxTs = now + 90 * 24 * 3600_000; // +90 days
      if (d.getTime() < minTs) {
        return jsonResponse({ error: 'La date programmée doit être au moins dans 1 minute' }, 400);
      }
      if (d.getTime() > maxTs) {
        return jsonResponse({ error: 'La date programmée doit être dans les 90 jours' }, 400);
      }
      scheduledAt = d;
    }

    if (!subject || subject.length > MAX_SUBJECT) {
      return jsonResponse({ error: `Sujet invalide (1-${MAX_SUBJECT} caractères)` }, 400);
    }
    if (!bodyHtmlRaw || bodyHtmlRaw.length > MAX_BODY) {
      return jsonResponse({ error: `Corps invalide (1-${MAX_BODY} caractères)` }, 400);
    }
    if (recipientUserIds.length === 0) {
      return jsonResponse({ error: 'Aucun destinataire' }, 400);
    }
    if (recipientUserIds.length > MAX_RECIPIENTS) {
      return jsonResponse({ error: `Maximum ${MAX_RECIPIENTS} destinataires par envoi` }, 400);
    }

    const bodyHtml = sanitizeHtml(bodyHtmlRaw);

    // Resolve recipients (email + manager name)
    const recipients: { user_id: string; email: string; manager_name: string }[] = [];
    for (const uid of recipientUserIds) {
      const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (uErr) {
        console.warn('[send-communication-email] getUserById failed for', uid, uErr.message);
        continue;
      }
      if (u?.user?.email) {
        recipients.push({
          user_id: uid,
          email: u.user.email,
          manager_name: '',
        });
      }
    }

    if (recipients.length === 0) {
      console.error('[send-communication-email] No resolvable recipients from input', recipientUserIds);
      return jsonResponse({ error: 'Aucun destinataire valide' }, 400);
    }

    // Manager names
    const { data: managersData } = await supabaseAdmin
      .from('managers')
      .select('user_id, nom')
      .in('user_id', recipients.map((r) => r.user_id));
    const nameMap = new Map<string, string>();
    (managersData ?? []).forEach((m: any) => nameMap.set(m.user_id, m.nom ?? ''));
    recipients.forEach((r) => { r.manager_name = nameMap.get(r.user_id) ?? ''; });

    // Exclude unsubscribed
    const { data: unsubs } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('email, used_at')
      .in('email', recipients.map((r) => r.email.toLowerCase()));
    const unsubscribed = new Set<string>(
      (unsubs ?? []).filter((u: any) => u.used_at).map((u: any) => (u.email as string).toLowerCase())
    );
    const finalRecipients = recipients.filter((r) => !unsubscribed.has(r.email.toLowerCase()));

    if (finalRecipients.length === 0) {
      return jsonResponse({ error: 'Tous les destinataires sont désinscrits' }, 400);
    }

    // Get template snapshot name
    let templateName: string | null = null;
    if (templateId) {
      const { data: tpl } = await supabaseAdmin
        .from('communication_templates')
        .select('name')
        .eq('id', templateId)
        .maybeSingle();
      templateName = tpl?.name ?? null;
    }

    // Create batch
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('communication_batches')
      .insert({
        template_id: templateId,
        template_name_snapshot: templateName,
        subject,
        body_html: bodyHtml,
        recipient_count: finalRecipients.length,
        sent_by: user.id,
        scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      })
      .select('id')
      .single();
    if (batchErr) {
      console.error('[send-communication-email] batch insert error', batchErr);
      return jsonResponse({ error: `Erreur lors de la création du lot: ${batchErr.message}` }, 500);
    }
    const batchId = batch!.id;

    // Enqueue one email per recipient
    let queued = 0;
    let failed = 0;
    for (const r of finalRecipients) {
      const prenom = (r.manager_name || r.email.split('@')[0]).split(' ')[0];
      const personalizedHtml = substituteVariables(bodyHtml, {
        prenom,
        email: r.email,
        nom_manager: r.manager_name,
      });
      const personalizedSubject = subject
        .replace(/\{\{\s*prenom\s*\}\}/gi, prenom)
        .replace(/\{\{\s*email\s*\}\}/gi, r.email)
        .replace(/\{\{\s*nom_manager\s*\}\}/gi, r.manager_name);

      const token = crypto.randomUUID().replace(/-/g, '');
      await supabaseAdmin.from('email_unsubscribe_tokens').insert({
        email: r.email.toLowerCase(),
        token,
      });
      const unsubscribeUrl = `https://${ROOT_DOMAIN}/unsubscribe?token=${token}`;
      const finalHtml = wrapEmail(personalizedHtml, unsubscribeUrl);
      const finalText = htmlToPlain(personalizedHtml) + `\n\n---\nSe désinscrire : ${unsubscribeUrl}`;

      const messageId = crypto.randomUUID();

      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'communication_general',
        recipient_email: r.email,
        status: 'pending',
        metadata: {
          batch_id: batchId,
          user_id: r.user_id,
          ...(scheduledAt ? { scheduled_at: scheduledAt.toISOString() } : {}),
        },
      });

      const queuePayload = {
        message_id: messageId,
        idempotency_key: messageId,
        unsubscribe_token: token,
        to: r.email,
        from: `${SITE_NAME} <contact@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: personalizedSubject,
        html: finalHtml,
        text: finalText,
        purpose: 'transactional',
        label: 'communication_general',
        queued_at: new Date().toISOString(),
        ...(scheduledAt ? { scheduled_at: scheduledAt.toISOString() } : {}),
        metadata: { batch_id: batchId, user_id: r.user_id },
      };

      const { error: enqueueError } = scheduledAt
        ? await supabaseAdmin.rpc('enqueue_email_at', {
            queue_name: 'transactional_emails',
            payload: queuePayload,
            send_at: scheduledAt.toISOString(),
          })
        : await supabaseAdmin.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: queuePayload,
          });

      if (enqueueError) {
        console.error('[send-communication-email] enqueue failed', enqueueError);
        await supabaseAdmin.from('email_send_log').update({
          status: 'failed',
          error_message: `enqueue: ${enqueueError.message}`,
        }).eq('message_id', messageId);
        failed += 1;
      } else {
        queued += 1;
      }
    }

    console.log(`[send-communication-email] batch=${batchId} queued=${queued} failed=${failed}`);

    return jsonResponse({
      success: true,
      batch_id: batchId,
      queued,
      failed,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      skipped_unsubscribed: recipients.length - finalRecipients.length,
    }, 200);
  } catch (error: any) {
    console.error('[send-communication-email] error:', error);
    return jsonResponse({ error: error?.message || 'Erreur inconnue' }, 500);
  }
});
