import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { normalize, tokenSig } from "../_shared/normalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScrapedRider {
  name: string;
  team: string;
  position?: number;
  gap?: string;
}

interface ScrapedEvent {
  time: string;
  type: string;
  text: string;
  riders: string[];
}

interface ScrapedGroup {
  name: string;
  riders: string[];
  riderCount: number;
  gap: string;
  isPeloton: boolean;
}

// ============================================================
// FIRSTCYCLING PARSER
// ============================================================

function parseFirstCyclingResults(doc: any, url: string): { riders: ScrapedRider[]; events: ScrapedEvent[] } {
  const riders: ScrapedRider[] = [];
  const events: ScrapedEvent[] = [];

  // Parse result table rows
  const rows = doc.querySelectorAll("tr.rider");
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 4) continue;

    const posText = cells[0]?.textContent?.trim();
    const position = posText ? parseInt(posText, 10) : undefined;

    // Rider name from link title attribute
    const riderLink = row.querySelector("td a[href*='rider.php']");
    const name = riderLink?.getAttribute("title") || riderLink?.textContent?.trim() || "";
    if (!name) continue;

    // Team
    const teamLink = row.querySelector("td a[href*='team.php']");
    const team = teamLink?.getAttribute("title") || teamLink?.textContent?.trim() || "";

    // Time/gap (last cell)
    const timeCell = cells[cells.length - 1];
    const gap = timeCell?.textContent?.trim() || "";

    riders.push({ name, team, position, gap });
  }

  // Try to parse intermediate results or live events from tabs
  const tabContents = doc.querySelectorAll(".tab-content");
  for (const tab of tabContents) {
    const heading = tab.querySelector("h3, h4, .headline");
    if (!heading) continue;
    const headingText = heading.textContent?.trim() || "";
    
    // Check for intermediate sprint or climb results
    if (/sprint|intermediate|climb|col|gpm/i.test(headingText)) {
      const tabRows = tab.querySelectorAll("tr.rider");
      const riderNames: string[] = [];
      for (const r of tabRows) {
        const link = r.querySelector("a[href*='rider.php']");
        if (link) riderNames.push(link.getAttribute("title") || link.textContent?.trim() || "");
      }
      if (riderNames.length > 0) {
        events.push({
          time: "",
          type: /sprint/i.test(headingText) ? "sprint" : "climb",
          text: headingText,
          riders: riderNames.slice(0, 10),
        });
      }
    }
  }

  return { riders, events };
}

// ============================================================
// PCS PARSER (basic)
// ============================================================

function parsePCSResults(doc: any): { riders: ScrapedRider[]; events: ScrapedEvent[] } {
  const riders: ScrapedRider[] = [];
  const rows = doc.querySelectorAll("table.results tbody tr, table.basic tbody tr");
  
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) continue;

    const posText = cells[0]?.textContent?.trim();
    const position = posText ? parseInt(posText, 10) : undefined;

    const riderLink = row.querySelector("a[href*='/rider/']");
    const name = riderLink?.textContent?.trim() || "";
    if (!name) continue;

    const teamSpan = row.querySelector(".team, td:nth-child(4)");
    const team = teamSpan?.textContent?.trim() || "";

    const timeCell = cells[cells.length - 1];
    const gap = timeCell?.textContent?.trim() || "";

    riders.push({ name, team, position, gap });
  }

  return { riders, events: [] };
}

// ============================================================
// MATCHING
// ============================================================

function matchRiders(
  scrapedRiders: ScrapedRider[],
  startlistEntries: { coureur_id: string; rider_nom: string }[],
  rosterMap: Record<string, string> // coureur_id -> manager_nom
): {
  matchedRiders: Record<string, { manager_name: string; rider_nom: string; scraped_name: string }>;
  unmatchedNames: string[];
} {
  const matched: Record<string, { manager_name: string; rider_nom: string; scraped_name: string }> = {};
  const unmatched: string[] = [];

  // Build lookup maps
  const sigToEntry = new Map<string, { coureur_id: string; rider_nom: string }>();
  const normToEntry = new Map<string, { coureur_id: string; rider_nom: string }>();
  
  for (const e of startlistEntries) {
    sigToEntry.set(tokenSig(e.rider_nom), e);
    normToEntry.set(normalize(e.rider_nom), e);
  }

  for (const sr of scrapedRiders) {
    const sig = tokenSig(sr.name);
    const norm = normalize(sr.name);

    let entry = sigToEntry.get(sig) || normToEntry.get(norm);

    // Fallback: try last name match
    if (!entry) {
      const scrapedTokens = norm.split(/\s+/);
      for (const e of startlistEntries) {
        const entryNorm = normalize(e.rider_nom);
        const entryTokens = entryNorm.split(/\s+/);
        // Check if last name tokens overlap
        const scrapedLast = scrapedTokens[scrapedTokens.length - 1];
        if (entryTokens.includes(scrapedLast) || entryTokens.some(t => t === scrapedTokens[0])) {
          // Additional check: at least 2 token overlap
          const overlap = scrapedTokens.filter(t => entryTokens.includes(t));
          if (overlap.length >= Math.min(2, scrapedTokens.length)) {
            entry = e;
            break;
          }
        }
      }
    }

    if (entry) {
      matched[entry.coureur_id] = {
        manager_name: rosterMap[entry.coureur_id] || "",
        rider_nom: entry.rider_nom,
        scraped_name: sr.name,
      };
    } else {
      unmatched.push(sr.name);
    }
  }

  return { matchedRiders: matched, unmatchedNames: unmatched };
}

// ============================================================
// MAIN
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, course_id } = await req.json();
    if (!url || !course_id) {
      return new Response(JSON.stringify({ error: "url and course_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the page
    console.log(`[scrape-live-race] Fetching ${url}`);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${resp.status} fetching URL` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) throw new Error("Failed to parse HTML");

    // 2. Detect source and parse
    const isFirstCycling = url.includes("firstcycling.com");
    const isPCS = url.includes("procyclingstats.com");

    let scrapedRiders: ScrapedRider[] = [];
    let scrapedEvents: ScrapedEvent[] = [];

    if (isFirstCycling) {
      const result = parseFirstCyclingResults(doc, url);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    } else if (isPCS) {
      const result = parsePCSResults(doc);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    } else {
      // Generic: try FirstCycling-style parsing
      const result = parseFirstCyclingResults(doc, url);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    }

    console.log(`[scrape-live-race] Parsed ${scrapedRiders.length} riders, ${scrapedEvents.length} events`);

    // 3. Get startlist entries + roster owners from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get startlist entries for this course
    const { data: startlistEntries } = await supabase
      .from("startlist_entries")
      .select("coureur_id, rider_nom")
      .eq("course_id", course_id);

    // Get active phase for course
    const { data: courseData } = await supabase
      .from("courses")
      .select("phase_id")
      .eq("id", course_id)
      .single();

    // Get roster owners for matching
    let rosterMap: Record<string, string> = {};
    if (courseData?.phase_id) {
      const { data: rosters } = await supabase
        .from("rosters")
        .select("coureur_id, manager_id, managers!inner(nom)")
        .eq("phase_id", courseData.phase_id);

      if (rosters) {
        for (const r of rosters) {
          const managerNom = (r as any).managers?.nom || "";
          rosterMap[r.coureur_id] = managerNom;
        }
      }
    }

    // 4. Match riders
    const { matchedRiders, unmatchedNames } = matchRiders(
      scrapedRiders,
      startlistEntries || [],
      rosterMap
    );

    // 5. Build situation (basic: all riders in one group for now)
    // The admin can reorganize into groups manually
    const groups: ScrapedGroup[] = [];
    
    if (scrapedRiders.length > 0) {
      // Group by gap time
      const gapGroups = new Map<string, ScrapedRider[]>();
      for (const r of scrapedRiders) {
        const gapKey = r.gap || "0:00";
        if (!gapGroups.has(gapKey)) gapGroups.set(gapKey, []);
        gapGroups.get(gapKey)!.push(r);
      }

      let idx = 0;
      for (const [gap, riders] of gapGroups) {
        const isPeloton = riders.length > 20;
        const riderNames: string[] = [];
        const riderIds: string[] = [];

        for (const r of riders) {
          // Try to find matched coureur_id
          const matchedEntry = Object.entries(matchedRiders).find(
            ([_, v]) => v.scraped_name === r.name
          );
          if (matchedEntry) {
            riderNames.push(matchedEntry[1].rider_nom);
            riderIds.push(matchedEntry[0]);
          } else {
            riderNames.push(r.name);
            riderIds.push("");
          }
        }

        groups.push({
          name: isPeloton ? "Peloton" : idx === 0 ? "Tête de course" : `Groupe ${idx + 1}`,
          riders: isPeloton ? riderNames.slice(0, 5) : riderNames.slice(0, 10),
          riderCount: riders.length,
          gap: gap.replace(/^\+\s*/, "+").trim() || "0:00",
          isPeloton,
        });
        idx++;
      }
    }

    const result = {
      timeline: scrapedEvents,
      situation: { groups, kmRemaining: 0 },
      matched_riders: matchedRiders,
      unmatched_names: unmatchedNames,
      total_scraped: scrapedRiders.length,
      total_matched: Object.keys(matchedRiders).length,
    };

    console.log(`[scrape-live-race] Done: ${result.total_matched}/${result.total_scraped} matched`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[scrape-live-race] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
