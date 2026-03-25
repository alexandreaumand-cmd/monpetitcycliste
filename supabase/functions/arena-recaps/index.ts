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

    // Auth guard: verify caller is superadmin OR has valid cron secret
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");

    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      // Valid cron invocation via x-cron-secret header
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      if (token === anonKey) {
        // Allow cron calls that use the anon key as Bearer token
        console.log("✅ Cron call authenticated via anon key");
      } else {
        // Verify user is superadmin
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: isSuperAdmin } = await userClient.rpc("is_superadmin");
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const recapType: string = body.type || "daily";
    const dateOverride: string | undefined = body.date; // optional "YYYY-MM-DD"

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
          const sent = await sendDailyRecap(supabase, league, channel.id, supabaseUrl, serviceKey);
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
  channelId: string,
  supabaseUrl: string,
  serviceKey: string
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

  // Get startlist movements for today (coureurs with prix_initial >= 50)
  let startlistChanges: any[] = [];
  try {
    // Get the season_id for this league
    const { data: leagueScope } = await supabase
      .from("league_scopes")
      .select("season_id")
      .eq("league_id", league.id)
      .maybeSingle();

    if (leagueScope?.season_id) {
      // Determine the active phase for this season
      const { data: phases } = await supabase
        .from("phases")
        .select("id, date_debut, date_fin, index_dans_saison")
        .eq("saison_id", leagueScope.season_id)
        .order("index_dans_saison", { ascending: true });

      let activePhaseId: string | null = null;
      if (phases && phases.length > 0) {
        const todayDate = today.toISOString().split("T")[0];
        const currentPhase = phases.find((p: any) => p.date_debut <= todayDate && todayDate <= p.date_fin);
        if (currentPhase) {
          activePhaseId = currentPhase.id;
        } else {
          const nextPhase = phases.find((p: any) => p.date_debut > todayDate);
          activePhaseId = nextPhase ? nextPhase.id : phases[phases.length - 1].id;
        }
      }

      // Get startlist changes detected today
      const { data: changes } = await supabase
        .from("startlist_tracker_changes")
        .select("coureur_id, rider_name, team_name, course_name, change_type, course_id")
        .gte("detected_at", startIso)
        .lte("detected_at", endIso)
        .not("coureur_id", "is", null);

      if (changes && changes.length > 0 && activePhaseId) {
        // Filter to only courses belonging to the active phase
        const changeCourseIds = [...new Set(changes.map((c: any) => c.course_id).filter(Boolean))];
        let activeCoursesSet = new Set<string>();
        if (changeCourseIds.length > 0) {
          const { data: coursesInPhase } = await supabase
            .from("courses")
            .select("id")
            .eq("phase_id", activePhaseId)
            .in("id", changeCourseIds);
          activeCoursesSet = new Set((coursesInPhase || []).map((c: any) => c.id));
        }
        const phaseFilteredChanges = changes.filter((c: any) => activeCoursesSet.has(c.course_id));

      if (phaseFilteredChanges.length > 0) {
        // Get coureur_ids with prix_initial >= 50 for this season
        const coureurIds = [...new Set(phaseFilteredChanges.map((c: any) => c.coureur_id))];
        const { data: csData } = await supabase
          .from("coureurs_saisons")
          .select("coureur_id, prix_initial")
          .eq("saison_id", leagueScope.season_id)
          .in("coureur_id", coureurIds)
          .gte("prix_initial", 50);

        const eligibleIds = new Set((csData || []).map((cs: any) => cs.coureur_id));
        const filteredChanges = phaseFilteredChanges.filter((c: any) => eligibleIds.has(c.coureur_id));

        if (filteredChanges.length > 0) {
          // Get roster ownership for these coureurs in this league
          const filteredCoureurIds = [...new Set(filteredChanges.map((c: any) => c.coureur_id))];
          const { data: rosterData } = await supabase
            .from("rosters")
            .select("coureur_id, manager_id")
            .eq("league_id", league.id)
            .in("coureur_id", filteredCoureurIds);

          // Get manager names for owners
          const ownerManagerIds = [...new Set((rosterData || []).map((r: any) => r.manager_id))];
          let ownerManagerMap: Record<string, string> = {};
          if (ownerManagerIds.length > 0) {
            const { data: ownerManagers } = await supabase
              .from("managers")
              .select("id, nom")
              .in("id", ownerManagerIds);
            if (ownerManagers) {
              for (const m of ownerManagers) {
                ownerManagerMap[m.id] = m.nom;
              }
            }
          }

          // Build coureur -> manager name map
          const coureurOwnerMap: Record<string, string> = {};
          if (rosterData) {
            for (const r of rosterData) {
              coureurOwnerMap[r.coureur_id] = ownerManagerMap[r.manager_id] || "Inconnu";
            }
          }

          startlistChanges = filteredChanges.map((c: any) => ({
            ...c,
            ownerName: coureurOwnerMap[c.coureur_id] || null,
          }));
        }
        }
      }
    }
  } catch (slErr) {
    console.error(`Error fetching startlist changes for ${league.name}:`, slErr);
  }

  // Skip recap if no points AND no startlist movements
  if (entries.length === 0 && startlistChanges.length === 0) {
    console.log(`No points and no startlist changes today for league ${league.name}, skipping daily recap`);
    return false;
  }

  // Get manager names for points entries
  const managerIds = entries.map((e) => e.managerId);
  const { data: managers } = await supabase
    .from("managers")
    .select("id, nom")
    .in("id", managerIds.length > 0 ? managerIds : ["00000000-0000-0000-0000-000000000000"]);

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
  if (entries.length > 0) {
    lines.push("**Mouvements du jour :**");
    entries.forEach((entry, i) => {
      const name = managerMap[entry.managerId] || "Inconnu";
      const medal = i < 3 ? medals[i] : "▪️";
      const sign = entry.total > 0 ? "+" : "";
      lines.push(`${medal} ${name}: ${sign}${entry.total} pts`);
    });
  }

  // Current standings with gaps
  if (entries.length > 0 && standingsData && standingsData.length > 0) {
    lines.push("");
    lines.push("**📈 Classement général :**");
    const leader = standingsData[0];
    standingsData.forEach((entry: any, i: number) => {
      const gap = i === 0 ? "" : ` (${entry.total_points - leader.total_points} pts)`;
      const rankEmoji = i < 3 ? medals[i] : `${i + 1}.`;
      lines.push(`${rankEmoji} ${entry.manager_nom}: ${entry.total_points} pts${gap}`);
    });
  }

  // Startlist movements
  if (startlistChanges.length > 0) {
    lines.push("");
    lines.push("**🔄 Mouvements startlists :**");
    // Sort: added first, then removed
    const sorted = startlistChanges.sort((a: any, b: any) => {
      if (a.change_type === b.change_type) return 0;
      return a.change_type === "added" ? -1 : 1;
    });
    for (const change of sorted) {
      const emoji = change.change_type === "added" ? "➕" : "➖";
      const team = change.team_name ? ` (${change.team_name})` : "";
      const course = change.course_name || "?";
      const owner = change.ownerName ? `Manager: ${change.ownerName}` : "Libre";
      lines.push(`${emoji} ${change.rider_name}${team} → ${course} — ${owner}`);
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
    console.error(`Error inserting daily recap for ${league.name}:`, error);
    return false;
  }

  console.log(`📊 Daily recap sent for ${league.name}`);

  // Send push notification for daily recap
  try {
    const topManagerName = managerMap[entries[0].managerId] || "?";

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
          title: `📊 Récap du jour — ${league.name}`,
          message: `Bravo à ${topManagerName}, manager du jour !`,
          type: "arena_daily_recap",
          metadata: { league_id: league.id },
        }),
      });

      console.log(`📲 Push notification sent for daily recap of ${league.name}`);
    }
  } catch (pushErr) {
    console.error("Push notification error (daily):", pushErr);
  }

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

  // Calculate Monday 00:00 UTC of the current week
  // getUTCDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayOfWeek = now.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);

  // Sunday 23:59:59 UTC (end of current week)
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const startIso = monday.toISOString();
  const endIso = sunday.toISOString();

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
  // Next week: Monday to Sunday
  const nextMonday = new Date(sunday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 1);
  nextMonday.setUTCHours(0, 0, 0, 0);
  const nextSunday = new Date(nextMonday);
  nextSunday.setUTCDate(nextSunday.getUTCDate() + 6);

  const { data: upcomingRaces } = await supabase
    .from("courses")
    .select("nom, categorie, date_debut")
    .gte("date_debut", nextMonday.toISOString().split("T")[0])
    .lte("date_debut", nextSunday.toISOString().split("T")[0])
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
