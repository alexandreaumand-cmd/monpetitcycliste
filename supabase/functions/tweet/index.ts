import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const X_API_URL = 'https://api.x.com/2/tweets';
const TWEET_ACCOUNT = 'labordure_game';

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function buildOAuthHeader(
  method: string,
  url: string,
  creds: { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string },
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // JSON body params are NOT part of the OAuth 1.0a signature base string.
  const parameterString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(parameterString),
  ].join('&');

  const signingKey = `${percentEncode(creds.apiSecret)}&${percentEncode(creds.accessSecret)}`;
  const signature = await hmacSha1(signingKey, signatureBase);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return 'OAuth ' + Object.keys(headerParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(', ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const relayPassword = Deno.env.get('RELAY_PASSWORD');
    if (!relayPassword) {
      console.error('tweet: RELAY_PASSWORD is not configured');
      return json({ error: 'server_misconfigured' }, 500);
    }

    let payload: { password?: unknown; text?: unknown };
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    if (typeof payload.password !== 'string' || payload.password !== relayPassword) {
      console.error('tweet: unauthorized request rejected');
      return json({ error: 'unauthorized' }, 401);
    }

    const text = payload.text;
    if (typeof text !== 'string' || text.trim().length === 0) {
      return json({ error: 'text is required' }, 400);
    }
    if ([...text].length > 280) {
      return json({ error: 'text exceeds 280 characters' }, 400);
    }

    const creds = {
      apiKey: Deno.env.get('X_API_KEY') ?? Deno.env.get('TWITTER_CONSUMER_KEY') ?? '',
      apiSecret: Deno.env.get('X_API_SECRET') ?? Deno.env.get('TWITTER_CONSUMER_SECRET') ?? '',
      accessToken: Deno.env.get('X_ACCESS_TOKEN') ?? Deno.env.get('TWITTER_ACCESS_TOKEN') ?? '',
      accessSecret: Deno.env.get('X_ACCESS_SECRET') ?? Deno.env.get('TWITTER_ACCESS_TOKEN_SECRET') ?? '',
    };

    const missing = Object.entries(creds).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      console.error('tweet: missing X credentials for keys:', missing.join(', '));
      return json({ error: 'server_misconfigured' }, 500);
    }

    const authHeader = await buildOAuthHeader('POST', X_API_URL, creds);

    const xResponse = await fetch(X_API_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const rawBody = await xResponse.text();

    if (!xResponse.ok) {
      console.error(`tweet: X API error status=${xResponse.status} body=${rawBody}`);
      return new Response(rawBody, {
        status: xResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let id: string | undefined;
    try {
      id = JSON.parse(rawBody)?.data?.id;
    } catch {
      console.error('tweet: could not parse X API success body');
    }

    if (!id) {
      console.error('tweet: X API success response without tweet id');
      return new Response(rawBody, {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return json({ id, url: `https://x.com/${TWEET_ACCOUNT}/status/${id}` });
  } catch (err) {
    console.error('tweet: unexpected error', err instanceof Error ? err.message : String(err));
    return json({ error: 'internal_error' }, 500);
  }
});
