import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROOT_DOMAIN = Deno.env.get('EMAIL_ROOT_DOMAIN') || 'labordure.app';
const FROM_DOMAIN = Deno.env.get('EMAIL_FROM_DOMAIN') || ROOT_DOMAIN;
const DEFAULT_SENDER_DOMAIN = `notify.${ROOT_DOMAIN}`;
const SENDER_DOMAIN = Deno.env.get('EMAIL_SENDER_DOMAIN') || DEFAULT_SENDER_DOMAIN;
const SITE_NAME = Deno.env.get('EMAIL_SITE_NAME') || 'La Bordure';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function htmlToPlain(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function substituteVariables(template: string, vars: { prenom: string; email: string; nom_manager: string }) {
  return template
    .replace(/\{\{\s*prenom\s*\}\}/gi, escapeHtml(vars.prenom))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHtml(vars.email))
    .replace(/\{\{\s*nom_manager\s*\}\}/gi, escapeHtml(vars.nom_manager));
}
function wrapEmail(bodyHtml: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:24px 0;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#1f5132;color:#ffffff;padding:20px 24px;"><h1 style="margin:0;font-size:20px;font-weight:600;">${escapeHtml(SITE_NAME)}</h1></td></tr>
      <tr><td style="padding:24px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center;">
        <p style="margin:0 0 8px 0;">Vous recevez cet email parce que vous êtes inscrit sur ${escapeHtml(SITE_NAME)}.</p>
        <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline;">Se désinscrire</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'Configuration serveur manquante' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return jsonResponse({ error: 'Non authentifié' }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return jsonResponse({ error: 'Non authentifié' }, 401);
    const user = userData.user;

    const { data: roles } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has('superadmin') && !roleSet.has('admin')) {
      return jsonResponse({ error: 'Réservé aux super-administrateurs' }, 403);
    }

    const body = await req.json();
    const batchId = (body.batch_id ?? '').toString();
    const includePending = body.include_pending === true;
    if (!batchId) return jsonResponse({ error: 'batch_id requis' }, 400);

    // Load batch
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('communication_batches').select('*').eq('id', batchId).maybeSingle();
    if (batchErr || !batch) return jsonResponse({ error: 'Lot introuvable' }, 404);

    // Load failed logs for this batch
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('email_send_log').select('id, message_id, recipient_email, status, metadata')
      .order('created_at', { ascending: false }).limit(5000);
    if (logsErr) return jsonResponse({ error: logsErr.message }, 500);

    const failedLogs = (logs ?? []).filter((r: any) => {
      const s = String(r.status ?? '').toLowerCase();
      if (r.metadata?.batch_id !== batchId) return false;
      if (s === 'failed' || s === 'error' || s === 'dlq' || s === 'bounced') return true;
      if (includePending && (s === 'pending' || s === 'queued')) return true;
      return false;
    });

    // Dedupe by recipient (most recent first already)
    const seen = new Set<string>();
    const toResend: any[] = [];
    for (const r of failedLogs) {
      const email = (r.recipient_email ?? '').toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      toResend.push(r);
    }

    if (toResend.length === 0) return jsonResponse({ success: true, requeued: 0, failed: 0 }, 200);

    // Skip unsubscribed
    const { data: unsubs } = await supabaseAdmin
      .from('email_unsubscribe_tokens').select('email, used_at')
      .in('email', toResend.map((r) => r.recipient_email.toLowerCase()));
    const unsubscribed = new Set<string>(
      (unsubs ?? []).filter((u: any) => u.used_at).map((u: any) => (u.email as string).toLowerCase())
    );

    // Resolve manager names from metadata.user_id
    const userIds = [...new Set(toResend.map((r) => r.metadata?.user_id).filter(Boolean))];
    const { data: managersData } = await supabaseAdmin
      .from('managers').select('user_id, nom').in('user_id', userIds);
    const nameMap = new Map<string, string>();
    (managersData ?? []).forEach((m: any) => nameMap.set(m.user_id, m.nom ?? ''));

    let requeued = 0;
    let failed = 0;
    for (const r of toResend) {
      const email = r.recipient_email as string;
      if (unsubscribed.has(email.toLowerCase())) continue;

      const userId = r.metadata?.user_id ?? null;
      const managerName = userId ? (nameMap.get(userId) ?? '') : '';
      const prenom = (managerName || email.split('@')[0]).split(' ')[0];

      const personalizedHtml = substituteVariables(batch.body_html, { prenom, email, nom_manager: managerName });
      const personalizedSubject = batch.subject
        .replace(/\{\{\s*prenom\s*\}\}/gi, prenom)
        .replace(/\{\{\s*email\s*\}\}/gi, email)
        .replace(/\{\{\s*nom_manager\s*\}\}/gi, managerName);

      const unsubToken = crypto.randomUUID().replace(/-/g, '');
      await supabaseAdmin.from('email_unsubscribe_tokens').insert({ email: email.toLowerCase(), token: unsubToken });
      const unsubscribeUrl = `https://${ROOT_DOMAIN}/unsubscribe?token=${unsubToken}`;
      const finalHtml = wrapEmail(personalizedHtml, unsubscribeUrl);
      const finalText = htmlToPlain(personalizedHtml) + `\n\n---\nSe désinscrire : ${unsubscribeUrl}`;

      const messageId = crypto.randomUUID();

      await supabaseAdmin.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'communication_general',
        recipient_email: email,
        status: 'pending',
        metadata: { batch_id: batchId, user_id: userId, resend_of: r.message_id ?? null },
      });

      const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          message_id: messageId,
          idempotency_key: messageId,
          to: email,
          from: `${SITE_NAME} <contact@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: personalizedSubject,
          html: finalHtml,
          text: finalText,
          purpose: 'transactional',
          label: 'communication_general',
          queued_at: new Date().toISOString(),
          metadata: { batch_id: batchId, user_id: userId, resend_of: r.message_id ?? null },
        },
      });

      if (enqueueError) {
        await supabaseAdmin.from('email_send_log').update({
          status: 'failed', error_message: `enqueue: ${enqueueError.message}`,
        }).eq('message_id', messageId);
        failed++;
      } else {
        requeued++;
      }
    }

    console.log(`[resend-failed-communication] batch=${batchId} requeued=${requeued} failed=${failed}`);
    return jsonResponse({ success: true, requeued, failed, skipped_unsubscribed: toResend.length - requeued - failed }, 200);
  } catch (error: any) {
    console.error('[resend-failed-communication] error:', error);
    return jsonResponse({ error: error?.message || 'Erreur inconnue' }, 500);
  }
});
