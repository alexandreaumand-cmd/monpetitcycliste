import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { buildOauth1Header, getTwitterCredentials } from '../_shared/oauth1.ts';
import { renderStandingsPng, type StandingRow } from '../_shared/tweetImage.ts';

type Kind = 'stage' | 'gc' | 'oneday';

const SITE_URL = 'Labordure.app';
const BASE_HASHTAG = '#labordure_lejeu';

const courseHashtag = (nom: string) => {
  const cleaned = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return cleaned ? `#${cleaned}` : '';
};

const formatDateFr = (value?: string | null) => {
  if (!value) return '';
  try {
    return new Date(`${value}T12:00:00Z`).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return value;
  }
};

async function uploadMedia(png: Uint8Array): Promise<string> {
  const creds = getTwitterCredentials();
  const endpoints = [
    'https://api.x.com/2/media/upload',
    'https://upload.twitter.com/1.1/media/upload.json',
    'https://upload.x.com/1.1/media/upload.json',
  ];

  let lastError = '';
  for (const url of endpoints) {
    const authHeader = await buildOauth1Header('POST', url, creds);
    const form = new FormData();
    form.append('media', new Blob([png], { type: 'image/png' }), 'standings.png');

    const res = await fetch(url, { method: 'POST', headers: { Authorization: authHeader }, body: form });
    const body = await res.text();
    if (res.ok) {
      const parsed = JSON.parse(body);
      const mediaId = parsed?.data?.id ?? parsed?.media_id_string ?? parsed?.media_key;
      if (mediaId) return String(mediaId);
      lastError = `Réponse média inattendue (${url}): ${body}`;
      continue;
    }
    lastError = `Upload média X échoué sur ${url} [${res.status}]: ${body}`;
    console.error(lastError);
  }
  throw new Error(lastError);
}


async function postTweet(text: string, mediaId: string): Promise<string> {
  const creds = getTwitterCredentials();
  const url = 'https://api.x.com/2/tweets';
  const authHeader = await buildOauth1Header('POST', url, creds);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Publication X échouée [${res.status}]: ${body}`);
  const parsed = JSON.parse(body);
  return parsed?.data?.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const isInternal = token === serviceKey;

    if (!isInternal) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return json({ error: 'Unauthorized' }, 401);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isSuperAdmin = (roles || []).some((r: { role: string }) => r.role === 'superadmin');
      if (!isSuperAdmin) return json({ error: 'Accès refusé: réservé aux superadministrateurs' }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const course_id: string | undefined = payload?.course_id;
    const kind: Kind | undefined = payload?.kind;
    const etapeRaw = payload?.etape_numero;
    const etape_numero: number | null =
      etapeRaw === null || etapeRaw === undefined ? null : Number(etapeRaw);
    const force = payload?.force === true;

    // Diagnostic: validates the X credentials without publishing anything.
    if (payload?.diagnose === true) {
      const creds = getTwitterCredentials();
      const vcUrl = 'https://api.x.com/1.1/account/verify_credentials.json';
      const vcHeader = await buildOauth1Header('GET', vcUrl, creds);
      const vcRes = await fetch(vcUrl, { headers: { Authorization: vcHeader } });
      const vcBody = await vcRes.text();
      return json({
        diagnose: true,
        verify_credentials_status: vcRes.status,
        verify_credentials_body: vcBody.slice(0, 500),
        shapes: {
          consumerKey_len: creds.consumerKey.length,
          consumerSecret_len: creds.consumerSecret.length,
          accessToken_len: creds.accessToken.length,
          accessToken_has_dash: creds.accessToken.includes('-'),
          accessTokenSecret_len: creds.accessTokenSecret.length,
        },
      });
    }


    if (!course_id || !kind || !['stage', 'gc', 'oneday'].includes(kind)) {
      return json({ error: 'course_id et kind (stage|gc|oneday) sont requis' }, 400);
    }
    if (kind === 'stage' && (etape_numero === null || !Number.isFinite(etape_numero))) {
      return json({ error: 'etape_numero est requis pour une étape' }, 400);
    }

    const targetEtape = kind === 'stage' ? etape_numero : null;
    const typeClassement = kind === 'stage' ? 'Etape' : 'General';

    // Feature flag (bypassed for a manual/forced publication)
    const { data: flag } = await supabase
      .from('app_feature_flags')
      .select('is_enabled')
      .eq('flag_name', 'auto_tweet_results')
      .maybeSingle();

    if (!force && flag && flag.is_enabled === false) {
      return json({ skipped: true, reason: 'Publication automatique désactivée' });
    }

    const matchEtape = <T extends { eq: any; is: any }>(query: T): T =>
      (targetEtape === null ? query.is('etape_numero', null) : query.eq('etape_numero', targetEtape)) as T;

    // Anti-duplicate
    const { data: existingExact } = await matchEtape(
      supabase
        .from('tweet_posts')
        .select('id, status, tweet_id')
        .eq('course_id', course_id)
        .eq('kind', kind),
    ).maybeSingle();

    if (existingExact?.status === 'sent' && !force) {
      return json({ skipped: true, reason: 'Déjà publié', tweet_id: existingExact.tweet_id });
    }

    // Cancelled stage -> never tweet
    const { data: resultSetExact } = await matchEtape(
      supabase
        .from('race_result_sets')
        .select('is_cancelled')
        .eq('course_id', course_id)
        .eq('type_classement', typeClassement),
    )
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resultSetExact?.is_cancelled) {
      return json({ skipped: true, reason: 'Étape annulée' });
    }


    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, nom, categorie, type_course, date_debut, date_fin')
      .eq('id', course_id)
      .single();

    if (courseError || !course) return json({ error: 'Course introuvable' }, 404);

    // Top 10
    let resultsQuery = supabase
      .from('race_results')
      .select('coureur_id, position, position_decimal, statut, points')
      .eq('course_id', course_id)
      .eq('type_classement', typeClassement)
      .eq('statut', 'finished')
      .order('position', { ascending: true })
      .limit(10);

    resultsQuery = targetEtape === null
      ? resultsQuery.is('etape_numero', null)
      : resultsQuery.eq('etape_numero', targetEtape);

    const { data: results, error: resultsError } = await resultsQuery;
    if (resultsError) throw resultsError;

    if (!results || results.length === 0) {
      return json({ skipped: true, reason: 'Aucun résultat à publier' });
    }

    const riderIds = results.map((r) => r.coureur_id);

    const { data: riders } = await supabase
      .from('coureurs')
      .select('id, nom, equipe')
      .in('id', riderIds);

    const ridersById = new Map((riders || []).map((r) => [r.id, r]));

    // Points scored in the game for this stage / classification
    let pointsQuery = supabase
      .from('points_ledger')
      .select('coureur_id, points')
      .eq('course_id', course_id)
      .eq('type_classement', typeClassement)
      .in('coureur_id', riderIds);

    pointsQuery = targetEtape === null
      ? pointsQuery.is('etape_numero', null)
      : pointsQuery.eq('etape_numero', targetEtape);

    const { data: ledger } = await pointsQuery;
    const pointsByRider = new Map<string, number>();
    for (const row of ledger || []) {
      pointsByRider.set(row.coureur_id, Number(row.points) || 0);
    }

    const rows: StandingRow[] = results.map((r) => {
      const rider = ridersById.get(r.coureur_id);
      const ledgerPoints = pointsByRider.get(r.coureur_id);
      const rawPoints = r.points === null || r.points === undefined ? null : Number(r.points);
      return {
        position: Number(r.position),
        riderName: rider?.nom || r.coureur_id,
        teamName: rider?.equipe || null,
        points: rawPoints !== null && rawPoints > 0 ? rawPoints : ledgerPoints ?? rawPoints,
      };
    });


    const title = kind === 'stage'
      ? `${course.nom} — Étape ${targetEtape}`
      : kind === 'gc'
        ? `${course.nom} — Classement général`
        : course.nom;

    const dateLabel = kind === 'stage' || kind === 'oneday'
      ? formatDateFr(course.date_debut)
      : formatDateFr(course.date_fin || course.date_debut);

    const subtitle = [course.categorie, dateLabel, 'Top 10 et points marqués']
      .filter(Boolean)
      .join(' · ');

    const png = await renderStandingsPng({ title, subtitle, rows });

    // Store the image for the superadmin preview (best effort)
    const imagePath = `${course_id}/${kind}-${targetEtape ?? 'final'}-${Date.now()}.png`;
    const { error: storageError } = await supabase.storage
      .from('tweets')
      .upload(imagePath, png, { contentType: 'image/png', upsert: true });
    if (storageError) console.error('Storage upload failed:', storageError.message);

    const hashtags = [BASE_HASHTAG, courseHashtag(course.nom)].filter(Boolean).join(' ');
    const podium = rows
      .slice(0, 3)
      .map((r) => `${r.position}. ${r.riderName}${r.teamName ? ` (${r.teamName})` : ''}`)
      .join('\n');

    const heading = kind === 'stage'
      ? `🚴 ${course.nom} — Étape ${targetEtape}`
      : kind === 'gc'
        ? `🏆 ${course.nom} — Classement général`
        : `🚴 ${course.nom}`;

    let text = `${heading}\n\n${podium}\n\nTous les points sur ${SITE_URL}\n${hashtags}`;
    if (text.length > 280) {
      text = `${heading}\n\n${rows[0].position}. ${rows[0].riderName}\n\n${SITE_URL}\n${hashtags}`.slice(0, 280);
    }

    const baseRow = {
      course_id,
      etape_numero: targetEtape,
      kind,
      text,
      image_path: imagePath,
    };

    try {
      const mediaId = await uploadMedia(png);
      const tweetId = await postTweet(text, mediaId);

      const sentRow = { ...baseRow, status: 'sent', tweet_id: tweetId, error: null };
      if (existingExact?.id) {
        await supabase.from('tweet_posts').update(sentRow).eq('id', existingExact.id);
      } else {
        await supabase.from('tweet_posts').insert(sentRow);
      }

      return json({ success: true, tweet_id: tweetId, text, image_path: imagePath });

    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : 'Erreur inconnue';
      console.error('Tweet publication failed:', message);

      if (existingExact?.id) {
        await supabase
          .from('tweet_posts')
          .update({ ...baseRow, status: 'error', error: message })
          .eq('id', existingExact.id);
      } else {
        await supabase.from('tweet_posts').insert({ ...baseRow, status: 'error', error: message });
      }

      return json({ error: message }, 502);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in tweet-race-result:', message);
    return json({ error: message }, 500);
  }
});
