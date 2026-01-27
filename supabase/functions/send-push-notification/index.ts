import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PushPayload {
  user_ids: string[];
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
}

interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  preferences: {
    results?: boolean;
    startlists?: boolean;
    auctions?: boolean;
  } | null;
}

// Helper to determine preference key from notification type
function getPreferenceKey(type: string): 'results' | 'startlists' | 'auctions' | null {
  if (type === 'results_added') return 'results';
  if (type === 'startlist_validated') return 'startlists';
  if (type.startsWith('auction_')) return 'auctions';
  return null;
}

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...uint8Array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert Uint8Array to ArrayBuffer safely
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(arr.length);
  new Uint8Array(buffer).set(arr);
  return buffer;
}

// Extract X and Y coordinates from uncompressed public key (65 bytes: 0x04 || X || Y)
function extractPublicKeyCoordinates(publicKeyBase64Url: string): { x: string; y: string } {
  const publicKeyBytes = base64UrlToUint8Array(publicKeyBase64Url);
  // Uncompressed public key format: 0x04 || X (32 bytes) || Y (32 bytes)
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error('Invalid public key format - expected uncompressed P-256 key');
  }
  const x = uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33));
  const y = uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65));
  return { x, y };
}

// Generate VAPID JWT using JWK format
async function generateVapidJwt(
  endpoint: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  vapidSubject: string
): Promise<string> {
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: vapidSubject
  };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Extract X and Y from public key for JWK
  const { x, y } = extractPublicKeyCoordinates(vapidPublicKey);

  // Import private key using JWK format
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidPrivateKey,
    x: x,
    y: y
  };

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (r || s) if needed
  const signatureArray = new Uint8Array(signature);
  let rawSignature: Uint8Array;

  if (signatureArray[0] === 0x30) {
    // DER format - parse it
    let offset = 2;
    const rLength = signatureArray[offset + 1];
    let r = signatureArray.slice(offset + 2, offset + 2 + rLength);
    offset += 2 + rLength;
    const sLength = signatureArray[offset + 1];
    let s = signatureArray.slice(offset + 2, offset + 2 + sLength);

    // Remove leading zeros if present
    if (r[0] === 0) r = r.slice(1);
    if (s[0] === 0) s = s.slice(1);

    // Pad to 32 bytes
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    rPadded.set(r, 32 - r.length);
    sPadded.set(s, 32 - s.length);

    rawSignature = new Uint8Array(64);
    rawSignature.set(rPadded);
    rawSignature.set(sPadded, 32);
  } else {
    rawSignature = signatureArray;
  }

  return `${unsignedToken}.${uint8ArrayToBase64Url(rawSignature)}`;
}

// HKDF implementation for Web Push encryption
async function hkdf(
  salt: ArrayBuffer,
  ikm: ArrayBuffer,
  info: ArrayBuffer,
  length: number
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: salt,
      info: info,
      hash: 'SHA-256'
    },
    keyMaterial,
    length * 8
  );

  return derivedBits;
}

// Create info for HKDF as per Web Push encryption spec
function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): ArrayBuffer {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(type);
  
  // "Content-Encoding: " + type + "\0" + "P-256" + "\0" + client_public_key_length + client_public_key + server_public_key_length + server_public_key
  const info = new Uint8Array(
    18 + typeBytes.length + 1 + 5 + 1 + 2 + clientPublicKey.length + 2 + serverPublicKey.length
  );
  
  let offset = 0;
  
  // "Content-Encoding: "
  const prefix = encoder.encode('Content-Encoding: ');
  info.set(prefix, offset);
  offset += prefix.length;
  
  // type
  info.set(typeBytes, offset);
  offset += typeBytes.length;
  
  // null byte
  info[offset++] = 0;
  
  // "P-256"
  const curve = encoder.encode('P-256');
  info.set(curve, offset);
  offset += curve.length;
  
  // null byte
  info[offset++] = 0;
  
  // client public key length (2 bytes, big endian)
  info[offset++] = 0;
  info[offset++] = clientPublicKey.length;
  
  // client public key
  info.set(clientPublicKey, offset);
  offset += clientPublicKey.length;
  
  // server public key length (2 bytes, big endian)
  info[offset++] = 0;
  info[offset++] = serverPublicKey.length;
  
  // server public key
  info.set(serverPublicKey, offset);
  
  return toArrayBuffer(info);
}

// Encrypt payload using aes128gcm content encoding
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: ArrayBuffer; serverPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlToUint8Array(p256dhKey);
  const authSecretBytes = base64UrlToUint8Array(authSecret);
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate ephemeral ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export server public key
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(clientPublicKeyBytes),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );

  // Generate salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Key derivation for aes128gcm
  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || client_public_key || server_public_key)
  const keyInfoPrefix = new TextEncoder().encode('WebPush: info\0');
  const keyInfo = new Uint8Array(keyInfoPrefix.length + clientPublicKeyBytes.length + serverPublicKey.length);
  keyInfo.set(keyInfoPrefix, 0);
  keyInfo.set(clientPublicKeyBytes, keyInfoPrefix.length);
  keyInfo.set(serverPublicKey, keyInfoPrefix.length + clientPublicKeyBytes.length);

  const ikm = await hkdf(toArrayBuffer(authSecretBytes), sharedSecretBits, toArrayBuffer(keyInfo), 32);

  // Derive content encryption key
  const cekInfo = createInfo('aes128gcm', clientPublicKeyBytes, serverPublicKey);
  const contentEncryptionKey = await hkdf(toArrayBuffer(salt), ikm, cekInfo, 16);

  // Derive nonce
  const nonceInfo = createInfo('nonce', clientPublicKeyBytes, serverPublicKey);
  const nonce = await hkdf(toArrayBuffer(salt), ikm, nonceInfo, 12);

  // Pad the payload (add padding delimiter 0x02 followed by zeros)
  const paddingLength = 0; // Minimal padding
  const paddedPayload = new Uint8Array(payloadBytes.length + 1 + paddingLength);
  paddedPayload.set(payloadBytes, 0);
  paddedPayload[payloadBytes.length] = 0x02; // Padding delimiter

  // Encrypt with AES-128-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    key,
    paddedPayload
  );

  // Build aes128gcm encrypted content encoding header + ciphertext
  // Format: salt (16 bytes) || rs (4 bytes) || idlen (1 byte) || keyid (idlen bytes) || ciphertext
  const recordSize = 4096;
  const idlen = serverPublicKey.length;
  
  const encryptedContent = new Uint8Array(16 + 4 + 1 + idlen + ciphertext.byteLength);
  let encOffset = 0;
  
  // Salt (16 bytes)
  encryptedContent.set(salt, encOffset);
  encOffset += 16;
  
  // Record size (4 bytes, big endian)
  encryptedContent[encOffset++] = (recordSize >> 24) & 0xff;
  encryptedContent[encOffset++] = (recordSize >> 16) & 0xff;
  encryptedContent[encOffset++] = (recordSize >> 8) & 0xff;
  encryptedContent[encOffset++] = recordSize & 0xff;
  
  // ID length (1 byte)
  encryptedContent[encOffset++] = idlen;
  
  // Key ID (server public key)
  encryptedContent.set(serverPublicKey, encOffset);
  encOffset += idlen;
  
  // Ciphertext
  encryptedContent.set(new Uint8Array(ciphertext), encOffset);

  return { encrypted: toArrayBuffer(encryptedContent), serverPublicKey };
}

// Send push notification using Web Push protocol with proper encryption
async function sendWebPush(
  subscription: PushSubscription,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const payloadString = JSON.stringify(payload);
    
    // Encrypt the payload
    const { encrypted } = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth
    );

    // Generate VAPID JWT
    const jwt = await generateVapidJwt(
      subscription.endpoint,
      vapidPrivateKey,
      vapidPublicKey,
      vapidSubject
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': encrypted.byteLength.toString(),
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Urgency': 'normal'
      },
      body: encrypted
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Push failed for ${subscription.endpoint}: ${response.status} ${errorText}`);
      return { success: false, statusCode: response.status, error: errorText };
    }

    return { success: true, statusCode: response.status };
  } catch (error) {
    console.error(`Push error for ${subscription.endpoint}:`, error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  console.log('[push] Request received:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error('[push] VAPID keys not configured');
      return new Response(JSON.stringify({ error: 'VAPID keys not configured', code: 'VAPID_MISSING' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[push] VAPID keys loaded');

    const payload: PushPayload = await req.json();
    const { user_ids, title, message, type, metadata } = payload;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      console.error('[push] Invalid payload: missing user_ids');
      return new Response(JSON.stringify({ error: 'user_ids array is required', code: 'INVALID_PAYLOAD' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[push] Processing for ${user_ids.length} user(s), type: ${type}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all subscriptions for the given user_ids
    console.log('[push] Fetching subscriptions...');
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, preferences')
      .in('user_id', user_ids);

    if (fetchError) {
      console.error('[push] Error fetching subscriptions:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions', code: 'DB_ERROR', details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[push] No subscriptions found for users:', user_ids);
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found', code: 'NO_SUBS' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[push] Found ${subscriptions.length} subscription(s)`);

    // Filter by preferences
    const preferenceKey = getPreferenceKey(type);
    const filteredSubscriptions = subscriptions.filter((sub: PushSubscription) => {
      if (!preferenceKey) return true; // Send if no specific preference key
      if (!sub.preferences) return true; // Send if no preferences set (defaults to all enabled)
      return sub.preferences[preferenceKey] !== false; // Send unless explicitly disabled
    });

    console.log(`[push] After preference filter: ${filteredSubscriptions.length} subscription(s)`);

    const pushPayload = { title, message, type, metadata };
    const expiredSubscriptionIds: string[] = [];
    let successCount = 0;
    let failCount = 0;
    const errors: { endpoint: string; error: string; statusCode?: number }[] = [];

    // Send notifications
    for (const subscription of filteredSubscriptions as PushSubscription[]) {
      console.log(`[push] Sending to endpoint: ${subscription.endpoint.substring(0, 60)}...`);
      
      const result = await sendWebPush(
        subscription,
        pushPayload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );

      if (result.success) {
        successCount++;
        console.log(`[push] Success for user ${subscription.user_id}`);
      } else {
        failCount++;
        errors.push({
          endpoint: subscription.endpoint.substring(0, 50),
          error: result.error || 'Unknown error',
          statusCode: result.statusCode
        });
        console.error(`[push] Failed for user ${subscription.user_id}: ${result.statusCode} - ${result.error}`);
        
        // Mark expired subscriptions for deletion
        if (result.statusCode === 404 || result.statusCode === 410) {
          expiredSubscriptionIds.push(subscription.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptionIds.length > 0) {
      console.log(`[push] Removing ${expiredSubscriptionIds.length} expired subscription(s)`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubscriptionIds);
    }

    console.log(`[push] Complete: ${successCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({
      sent: successCount,
      failed: failCount,
      expiredRemoved: expiredSubscriptionIds.length,
      total: filteredSubscriptions.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[push] Unhandled error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
