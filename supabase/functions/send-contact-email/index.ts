import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message } = await req.json();

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return new Response(JSON.stringify({ error: 'Nom invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return new Response(JSON.stringify({ error: 'Email invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 5000) {
      return new Response(JSON.stringify({ error: 'Message invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (subject && (typeof subject !== 'string' || subject.length > 200)) {
      return new Response(JSON.stringify({ error: 'Sujet invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase.from('contact_messages').insert({
      name: name.trim(),
      email: email.trim(),
      subject: subject?.trim() || null,
      message: message.trim(),
    });

    if (dbError) {
      console.error('DB error:', dbError);
      throw new Error('Erreur lors de l\'enregistrement du message');
    }

    console.log(`Contact form submission stored from ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error processing contact form:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
