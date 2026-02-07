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
    const recapType: string = body.type || "daily";

    console.log(`🔄 Starting ${recapType} recap...`);

    // 1. Get all active leagues
    const { data: leagues, error: leaguesErr } = await supabase
      .from("leagues")
      .select("id, name")
      .eq("status", "active");

    if (leaguesErr) throw leaguesErr;
    if (!leagues || leagues.length === 0) {
      return new Response(JSON.stringify({ message: "No active leagues" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { league: string; sent: boolean; type: string }[] = [];

    for (const league of leagues) {
      try {
        // Get the #general channel for this league
        const { data: channel } = await supabase
          .from("arena_channels")
          .select("id")
          .eq("league_id", league.id)
          .eq("slug", "general")
          .maybeSingle();

        if (!channel) {
          console.log(`No #general channel for league ${league.name}`);
          results.push({ league: league.name, sent: false, type: recapType });
          continue;
        }

        if (recapType === "weekly") {
          await sendWeeklyRecap(supabase, league, channel.id, supabaseUrl, serviceKey);
          results.push({ league: league.name, sent: true, type: "weekly" });
        } else {
          const sent = await sendDailyRecap(supabase, league, channel.id);
          results.push({ league: league.name, sent, type: "daily" });
        }
      } catch (err) {
        console.error(`Error processing league ${league.name}:`, err);
        results.push({ league: league.name, sent: false, type: recapType });
      }
    }

    console.log(`✅ Recap complete:`, results);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Recap error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Daily Recap ───────────────────────────────────────────────

async function sendDailyRecap(
  supabase: any,
  league: { id: string; name: string },
  channelId: string
): Promise<boolean> {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const startIso = startOfDay.toISOString();
  const endIso = endOfDay.toISOString();

  // Get race points for today, joined with rosters to get manager ownership per league
  const { data: racePoints } = await supabase.rpc("get_daily_points_by_manager", {
    p_league_id: league.id,
    p_start: startIso,
    p_end: endIso,
  });

  // Get bonus points for today
  const { data: bonusPoints } = await supabase
    .from("bonus_points")
    .select("manager_id, points")
    .eq("league_id", league.id)
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  // Aggregate
  const managerPoints: Record<string, { race: number; bonus: number }> = {};

  if (racePoints) {
    for (const row of racePoints) {
      if (!managerPoints[row.manager_id]) {
        managerPoints[row.manager_id] = { race: 0, bonus: 0 };
      }
      managerPoints[row.manager_id].race += Number(row.total_points || 0);
    }
  }

  if (bonusPoints) {
    for (const row of bonusPoints) {
      if (!row.manager_id) continue;
      if (!managerPoints[row.manager_id]) {
        managerPoints[row.manager_id] = { race: 0, bonus: 0 };
      }
      managerPoints[row.manager_id].bonus += Number(row.points || 0);
    }
  }

  const entries = Object.entries(managerPoints)
    .map(([managerId, pts]) => ({
      managerId,
      total: Math.round(pts.race + pts.bonus),
    }))
    .filter((e) => e.total !== 0)
    .sort((a, b) => b.total - a.total);

  if (entries.length === 0) {
    console.log(`No points today for league ${league.name}, skipping daily recap`);
    return false;
  }

  // Get manager names
  const managerIds = entries.map((e) => e.managerId);
  const { data: managers } = await supabase
    .from("managers")
    .select("id, nom")
    .in("id", managerIds);

  const managerMap: Record<string, string> = {};
  if (managers) {
    for (const m of managers) {
      managerMap[m.id] = m.nom;
    }
  }

  // Format date
  const dayStr = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Get current league standings via the edge function RPC
  const { data: standingsData } = await supabase.rpc("get_league_standings_for_recap", {
    p_league_id: league.id,
  });

  // Build message
  const lines = [`📊 **Récap du ${dayStr}**\n`];
  const medals = ["🥇", "🥈", "🥉"];

  // Daily point changes
  lines.push("**Mouvements du jour :**");
  entries.forEach((entry, i) => {
    const name = managerMap[entry.managerId] || "Inconnu";
    const medal = i < 3 ? medals[i] : "▪️";
    const sign = entry.total > 0 ? "+" : "";
    lines.push(`${medal} ${name}: ${sign}${entry.total} pts`);
  });

  // Current standings with gaps
  if (standingsData && standingsData.length > 0) {
    lines.push("");
    lines.push("**📈 Classement général :**");
    const leader = standingsData[0];
    standingsData.forEach((entry: any, i: number) => {
      const gap = i === 0 ? "" : ` (${entry.total_points - leader.total_points} pts)`;
      const rankEmoji = i < 3 ? medals[i] : `${i + 1}.`;
      lines.push(`${rankEmoji} ${entry.manager_nom}: ${entry.total_points} pts${gap}`);
    });
  }

  const content = lines.join("\n");

  // Insert system message
  const { error } = await supabase.from("arena_messages").insert({
    league_id: league.id,
    channel_id: channelId,
    content,
    message_type: "system",
    author_manager_id: null,
  });

  if (error) {
    console.error(`Error inserting daily recap for ${league.name}:`, error);
    return false;
  }

  console.log(`📊 Daily recap sent for ${league.name}`);
  return true;
}

// ─── Weekly Recap ──────────────────────────────────────────────

async function sendWeeklyRecap(
  supabase: any,
  league: { id: string; name: string },
  channelId: string,
  supabaseUrl: string,
  serviceKey: string
) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setUTCHours(0, 0, 0, 0);

  const startIso = weekAgo.toISOString();
  const endIso = now.toISOString();

  // 1. Get race points for the week
  const { data: racePoints } = await supabase.rpc("get_daily_points_by_manager", {
    p_league_id: league.id,
    p_start: startIso,
    p_end: endIso,
  });

  // 2. Get bonus points for the week
  const { data: bonusPoints } = await supabase
    .from("bonus_points")
    .select("manager_id, points")
    .eq("league_id", league.id)
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  // Aggregate manager points
  const managerPoints: Record<string, number> = {};

  if (racePoints) {
    for (const row of racePoints) {
      managerPoints[row.manager_id] = (managerPoints[row.manager_id] || 0) + Number(row.total_points || 0);
    }
  }

  if (bonusPoints) {
    for (const row of bonusPoints) {
      if (!row.manager_id) continue;
      managerPoints[row.manager_id] = (managerPoints[row.manager_id] || 0) + Number(row.points || 0);
    }
  }

  const managerEntries = Object.entries(managerPoints)
    .map(([id, pts]) => ({ id, points: Math.round(pts) }))
    .sort((a, b) => b.points - a.points);

  // 3. Get top riders of the week
  const { data: topRiders } = await supabase.rpc("get_weekly_top_riders", {
    p_league_id: league.id,
    p_start: startIso,
    p_end: endIso,
  });

  // 4. Get upcoming races for next week
  const nextWeekStart = new Date(now);
  nextWeekStart.setDate(nextWeekStart.getDate() + 1);
  const nextWeekEnd = new Date(now);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 8);

  const { data: upcomingRaces } = await supabase
    .from("courses")
    .select("nom, categorie, date_debut")
    .gte("date_debut", nextWeekStart.toISOString().split("T")[0])
    .lte("date_debut", nextWeekEnd.toISOString().split("T")[0])
    .order("date_debut", { ascending: true })
    .limit(10);

  // Get all manager names
  const allManagerIds = managerEntries.map((e) => e.id);
  const { data: managers } = await supabase
    .from("managers")
    .select("id, nom")
    .in("id", allManagerIds.length > 0 ? allManagerIds : ["00000000-0000-0000-0000-000000000000"]);

  const managerMap: Record<string, string> = {};
  if (managers) {
    for (const m of managers) {
      managerMap[m.id] = m.nom;
    }
  }

  // Build the weekly recap message
  const lines: string[] = ["🏆 **Bilan de la semaine**\n"];

  // Top 3 managers
  if (managerEntries.length > 0) {
    const medals = ["🥇", "🥈", "🥉"];
    lines.push("**Top managers :**");
    const top3 = managerEntries.slice(0, 3);
    top3.forEach((entry, i) => {
      const name = managerMap[entry.id] || "Inconnu";
      const sign = entry.points > 0 ? "+" : "";
      lines.push(`${medals[i]} ${name}: ${sign}${entry.points} pts`);
    });

    // Bottom managers (those with least/negative points)
    if (managerEntries.length > 3) {
      lines.push("");
      lines.push("**Lanternes rouges :**");
      const bottom = managerEntries.slice(-2);
      for (const entry of bottom) {
        const name = managerMap[entry.id] || "Inconnu";
        const sign = entry.points > 0 ? "+" : "";
        lines.push(`🔻 ${name}: ${sign}${entry.points} pts`);
      }
    }
  } else {
    lines.push("Aucun point marqué cette semaine.");
  }

  // Top riders
  if (topRiders && topRiders.length > 0) {
    lines.push("");
    lines.push("**🚴 Meilleurs coureurs :**");
    const topN = topRiders.slice(0, 5);
    for (const rider of topN) {
      const ownerName = rider.manager_nom ? ` (${rider.manager_nom})` : "";
      lines.push(`⭐ ${rider.coureur_nom}: ${Math.round(rider.total_points)} pts${ownerName}`);
    }
  }

  // Upcoming races
  if (upcomingRaces && upcomingRaces.length > 0) {
    lines.push("");
    lines.push("**📅 Programme de la semaine :**");
    for (const race of upcomingRaces) {
      const date = new Date(race.date_debut + "T00:00:00");
      const dateStr = date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const cat = race.categorie ? ` (${race.categorie})` : "";
      lines.push(`• ${dateStr} — ${race.nom}${cat}`);
    }
  }

  const content = lines.join("\n");

  // Insert system message
  const { error } = await supabase.from("arena_messages").insert({
    league_id: league.id,
    channel_id: channelId,
    content,
    message_type: "system",
    author_manager_id: null,
  });

  if (error) {
    console.error(`Error inserting weekly recap for ${league.name}:`, error);
    return;
  }

  console.log(`🏆 Weekly recap sent for ${league.name}`);

  // Send push notification for weekly recap
  try {
    const { data: leagueMembers } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id);

    if (leagueMembers && leagueMembers.length > 0) {
      const userIds = leagueMembers.map((m: any) => m.user_id);

      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          user_ids: userIds,
          title: `🏆 Bilan de la semaine — ${league.name}`,
          message: managerEntries.length > 0
            ? `${managerMap[managerEntries[0].id] || "?"} en tête avec ${managerEntries[0].points > 0 ? "+" : ""}${managerEntries[0].points} pts !`
            : "Consultez le récap de la semaine dans l'Arène",
          type: "arena_weekly_recap",
          metadata: { league_id: league.id },
        }),
      });

      console.log(`📲 Push notification sent for weekly recap of ${league.name}`);
    }
  } catch (pushErr) {
    console.error("Push notification error:", pushErr);
  }
}
