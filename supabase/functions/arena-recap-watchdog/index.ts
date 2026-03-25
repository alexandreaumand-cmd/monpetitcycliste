import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const checkType: string = body.type || "daily"; // 'daily' or 'weekly'

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Check if a successful run exists for today
    const { data: runs, error } = await supabase
      .from("arena_recap_runs")
      .select("id, status, leagues_sent, created_at")
      .eq("run_type", checkType)
      .eq("target_date", todayStr)
      .in("status", ["success", "partial"])
      .limit(1);

    if (error) throw error;

    if (runs && runs.length > 0) {
      console.log(`✅ Watchdog: ${checkType} recap for ${todayStr} found (status: ${runs[0].status})`);
      return new Response(JSON.stringify({ ok: true, message: "Recap found", run: runs[0] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No successful run found — alert!
    console.warn(`⚠️ Watchdog: NO ${checkType} recap found for ${todayStr}! Attempting recovery...`);

    // Try to trigger the recap directly
    const recapResponse = await fetch(`${supabaseUrl}/functions/v1/arena-recaps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || serviceKey}`,
      },
      body: JSON.stringify({ type: checkType, date: todayStr }),
    });

    const recapResult = await recapResponse.text();
    console.log(`🔄 Recovery attempt result (${recapResponse.status}):`, recapResult);

    // Also send a notification to superadmins
    const { data: superadmins } = await supabase
      .from("managers")
      .select("id")
      .eq("is_superadmin", true);

    if (superadmins && superadmins.length > 0) {
      const notifications = superadmins.map((admin: any) => ({
        manager_id: admin.id,
        type: "system_alert",
        title: `⚠️ Récap ${checkType} manquant`,
        message: `Le récap ${checkType} du ${todayStr} n'a pas été trouvé. Une tentative de récupération automatique a été lancée (HTTP ${recapResponse.status}).`,
        metadata: { check_type: checkType, date: todayStr, recovery_status: recapResponse.status },
        is_read: false,
      }));

      await supabase.from("notifications").insert(notifications);
      console.log(`📢 Alert sent to ${superadmins.length} superadmin(s)`);
    }

    return new Response(JSON.stringify({
      ok: false,
      message: "Recap missing - recovery attempted",
      recovery_status: recapResponse.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Watchdog error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
