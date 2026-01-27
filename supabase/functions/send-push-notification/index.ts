import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const app = new Hono();

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

// Generate VAPID JWT
async function generateVapidJwt(endpoint: string, vapidPrivateKey: string, vapidSubject: string): Promise<string> {
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

  // Import the private key
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
  
  // Create PKCS8 format for the key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20
  ]);
  const pkcs8Key = new Uint8Array(pkcs8Header.length + privateKeyBytes.length);
  pkcs8Key.set(pkcs8Header);
  pkcs8Key.set(privateKeyBytes, pkcs8Header.length);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Key,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (r || s)
  const signatureArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  
  if (signatureArray[0] === 0x30) {
    // DER format - parse it
    let offset = 2;
    const rLength = signatureArray[offset + 1];
    r = signatureArray.slice(offset + 2, offset + 2 + rLength);
    offset += 2 + rLength;
    const sLength = signatureArray[offset + 1];
    s = signatureArray.slice(offset + 2, offset + 2 + sLength);
    
    // Remove leading zeros if present
    if (r[0] === 0) r = r.slice(1);
    if (s[0] === 0) s = s.slice(1);
    
    // Pad to 32 bytes
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    rPadded.set(r, 32 - r.length);
    sPadded.set(s, 32 - s.length);
    
    const rawSignature = new Uint8Array(64);
    rawSignature.set(rPadded);
    rawSignature.set(sPadded, 32);
    
    return `${unsignedToken}.${uint8ArrayToBase64Url(rawSignature)}`;
  }

  return `${unsignedToken}.${uint8ArrayToBase64Url(signatureArray)}`;
}

// Send push notification using Web Push protocol
async function sendWebPush(
  subscription: PushSubscription,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const jwt = await generateVapidJwt(subscription.endpoint, vapidPrivateKey, vapidSubject);
    
    const body = JSON.stringify(payload);
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Urgency': 'normal'
      },
      body: body
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

app.options('*', (c) => {
  return new Response(null, { headers: corsHeaders });
});

app.post('/send-push-notification', async (c) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error('VAPID keys not configured');
      return c.json({ error: 'VAPID keys not configured' }, 500);
    }

    const payload: PushPayload = await c.req.json();
    const { user_ids, title, message, type, metadata } = payload;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return c.json({ error: 'user_ids array is required' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all subscriptions for the given user_ids
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, preferences')
      .in('user_id', user_ids);

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return c.json({ error: 'Failed to fetch subscriptions' }, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for users:', user_ids);
      return c.json({ sent: 0, message: 'No subscriptions found' }, 200);
    }

    console.log(`Found ${subscriptions.length} push subscriptions`);

    // Filter by preferences
    const preferenceKey = getPreferenceKey(type);
    const filteredSubscriptions = subscriptions.filter((sub: PushSubscription) => {
      if (!preferenceKey) return true; // Send if no specific preference key
      if (!sub.preferences) return true; // Send if no preferences set (defaults to all enabled)
      return sub.preferences[preferenceKey] !== false; // Send unless explicitly disabled
    });

    console.log(`After preference filtering: ${filteredSubscriptions.length} subscriptions`);

    const pushPayload = { title, message, type, metadata };
    const expiredSubscriptionIds: string[] = [];
    let successCount = 0;
    let failCount = 0;

    // Send notifications
    for (const subscription of filteredSubscriptions as PushSubscription[]) {
      const result = await sendWebPush(
        subscription,
        pushPayload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        // Mark expired subscriptions for deletion
        if (result.statusCode === 404 || result.statusCode === 410) {
          expiredSubscriptionIds.push(subscription.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptionIds.length > 0) {
      console.log(`Removing ${expiredSubscriptionIds.length} expired subscriptions`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubscriptionIds);
    }

    return c.json({
      sent: successCount,
      failed: failCount,
      expiredRemoved: expiredSubscriptionIds.length,
      total: filteredSubscriptions.length
    }, 200);

  } catch (error) {
    console.error('Send push notification error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);
