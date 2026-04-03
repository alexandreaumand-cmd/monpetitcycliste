import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const raceId = formData.get('race_id') as string;
    const file = formData.get('file') as File;
    const etapeNumeroRaw = formData.get('etape_numero') as string | null;
    const label = formData.get('label') as string | null;

    if (!raceId || !file) {
      return new Response(
        JSON.stringify({ error: 'race_id and file are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'File must be PNG, JPG, or WebP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const etapeNumero = etapeNumeroRaw ? parseInt(etapeNumeroRaw, 10) : null;
    const suffix = etapeNumero !== null ? `_etape${etapeNumero}` : '';
    const filename = `${raceId}${suffix}_${timestamp}.${ext}`;
    const path = `courses/${raceId}/${filename}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('startlist-route-images')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('startlist-route-images')
      .getPublicUrl(path);

    // Multi-stage mode: upsert into course_route_images
    if (etapeNumero !== null) {
      const sortOrder = etapeNumero;
      
      // Upsert: use the unique index (course_id, COALESCE(etape_numero, -1))
      // First try to find existing
      const { data: existing } = await supabaseAdmin
        .from('course_route_images')
        .select('id')
        .eq('course_id', raceId)
        .eq('etape_numero', etapeNumero)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('course_route_images')
          .update({ image_url: publicUrl, label: label || null, sort_order: sortOrder })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('course_route_images')
          .insert({ 
            course_id: raceId, 
            etape_numero: etapeNumero, 
            image_url: publicUrl, 
            label: label || null, 
            sort_order: sortOrder 
          });
      }

      console.log(`Route image uploaded for course ${raceId}, étape ${etapeNumero}: ${publicUrl}`);

      return new Response(
        JSON.stringify({ route_image_url: publicUrl, etape_numero: etapeNumero }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single image mode (overview or one-day race): update courses table
    // Also upsert into course_route_images with etape_numero = NULL for overview
    const { error: updateError } = await supabaseAdmin
      .from('courses')
      .update({ route_image_url: publicUrl })
      .eq('id', raceId);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    // Also store in course_route_images as overview (etape_numero = NULL)
    const { data: existingOverview } = await supabaseAdmin
      .from('course_route_images')
      .select('id')
      .eq('course_id', raceId)
      .is('etape_numero', null)
      .maybeSingle();

    if (existingOverview) {
      await supabaseAdmin
        .from('course_route_images')
        .update({ image_url: publicUrl, label: label || 'Vue d\'ensemble', sort_order: 0 })
        .eq('id', existingOverview.id);
    } else {
      await supabaseAdmin
        .from('course_route_images')
        .insert({ 
          course_id: raceId, 
          etape_numero: null, 
          image_url: publicUrl, 
          label: label || 'Vue d\'ensemble', 
          sort_order: 0 
        });
    }

    console.log(`Route image uploaded for course ${raceId}: ${publicUrl}`);

    return new Response(
      JSON.stringify({ route_image_url: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});