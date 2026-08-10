// Minimal OAuth 1.0a (HMAC-SHA1) signing helper for the X (Twitter) API.

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export type Oauth1Credentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export function getTwitterCredentials(): Oauth1Credentials {
  const consumerKey = Deno.env.get('TWITTER_CONSUMER_KEY')?.trim();
  const consumerSecret = Deno.env.get('TWITTER_CONSUMER_SECRET')?.trim();
  const accessToken = Deno.env.get('TWITTER_ACCESS_TOKEN')?.trim();
  const accessTokenSecret = Deno.env.get('TWITTER_ACCESS_TOKEN_SECRET')?.trim();


  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error(
      'Identifiants X manquants (TWITTER_CONSUMER_KEY / TWITTER_CONSUMER_SECRET / TWITTER_ACCESS_TOKEN / TWITTER_ACCESS_TOKEN_SECRET)',
    );
  }

  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
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

/**
 * Builds the `Authorization` header value.
 * IMPORTANT: body parameters are intentionally NOT included in the signature
 * (JSON and multipart bodies must not be signed for the X API).
 */
export async function buildOauth1Header(
  method: string,
  url: string,
  creds: Oauth1Credentials,
): Promise<string> {
  const target = new URL(url);

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // Query string params must be part of the signature base string.
  const allParams: Record<string, string> = { ...oauthParams };
  target.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });

  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${enc(k)}=${enc(allParams[k])}`)
    .join('&');

  const baseUrl = `${target.origin}${target.pathname}`;
  const baseString = [method.toUpperCase(), enc(baseUrl), enc(paramString)].join('&');
  const signingKey = `${enc(creds.consumerSecret)}&${enc(creds.accessTokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    'OAuth ' +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${enc(k)}="${enc(headerParams[k as keyof typeof headerParams])}"`)
      .join(', ')
  );
}
