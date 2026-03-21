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

// ============================================================
// PCS PARSER — matches actual procyclingstats.com HTML
// ============================================================

function parsePCSResults(doc: any): { riders: ScrapedRider[]; events: ScrapedEvent[] } {
  const riders: ScrapedRider[] = [];

  // PCS result table: table.results tbody tr
  const rows = doc.querySelectorAll("table.results tbody tr");
  console.log(`[PCS] Found ${rows.length} result rows`);

  let debugCount = 0;
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (debugCount < 3) {
      const riderLink = row.querySelector("a[href*='/rider/']");
      const anyLink = row.querySelector("a");
      console.log(`[PCS] Row ${debugCount}: cells=${cells.length}, riderLink=${!!riderLink}, anyLink href=${anyLink?.getAttribute("href")?.substring(0, 60)}, firstTd="${cells[0]?.textContent?.trim()}", html=${row.innerHTML?.substring(0, 200)}`);
      debugCount++;
    }
    if (cells.length < 3) continue;

    // Position: first td
    const posText = cells[0]?.textContent?.trim();
    const position = posText && /^\d+$/.test(posText) ? parseInt(posText, 10) : undefined;

    // Skip DNF/DNS rows
    if (posText === "DNF" || posText === "DNS" || posText === "OTL") continue;

    // Rider name: find link to /rider/ anywhere in the row
    const riderLink = row.querySelector("a[href*='/rider/']");
    if (!riderLink) continue;

    // Extract last name from span.uppercase, rest is first name
    const uppercaseSpan = riderLink.querySelector("span");
    const lastName = uppercaseSpan?.textContent?.trim() || "";
    const fullText = riderLink.textContent?.trim() || "";
    const firstName = fullText.replace(lastName, "").trim();
    const name = firstName ? `${firstName} ${lastName}` : fullText;
    if (!name) continue;

    // Team: find link to /team/ anywhere in the row
    const teamLink = row.querySelector("a[href*='/team/']");
    const team = teamLink?.textContent?.trim() || "";

    // Time/gap: last td or td with time class
    const lastCell = cells[cells.length - 1];
    let gap = "";
    const font = lastCell?.querySelector("font");
    if (font) {
      gap = font.textContent?.trim() || "";
    } else {
      gap = lastCell?.textContent?.trim() || "";
    }
    // Clean up ",," which PCS uses for "same time"
    if (gap === ",," || gap === ",,") gap = "s.t.";

    riders.push({ name, team, position, gap });
  }

  console.log(`[PCS] Parsed ${riders.length} riders`);
  return { riders, events: [] };
}

// ============================================================
// FIRSTCYCLING PARSER — matches actual firstcycling.com HTML
// ============================================================

function parseFirstCyclingResults(doc: any): { riders: ScrapedRider[]; events: ScrapedEvent[] } {
  const riders: ScrapedRider[] = [];
  const events: ScrapedEvent[] = [];

  // FirstCycling: tr.rider rows inside .sortTabell or .tablesorter
  const rows = doc.querySelectorAll("tr.rider");
  console.log(`[FC] Found ${rows.length} rider rows`);

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 4) continue;

    // Position: first td
    const posText = cells[0]?.textContent?.trim();
    const position = posText && /^\d+$/.test(posText) ? parseInt(posText, 10) : undefined;
    if (posText === "DNF" || posText === "DNS") continue;

    // Rider: a[href*='rider.php'] — name from title attribute
    const riderLink = row.querySelector("a[href*='rider.php']");
    const name = riderLink?.getAttribute("title") || riderLink?.textContent?.trim() || "";
    if (!name) continue;

    // Team: a[href*='team.php'] — name from title attribute
    const teamLink = row.querySelector("a[href*='team.php']");
    const team = teamLink?.getAttribute("title") || teamLink?.textContent?.trim() || "";

    // Time/gap: last td (right-aligned)
    const lastCell = cells[cells.length - 1];
    const gap = lastCell?.textContent?.trim() || "";

    riders.push({ name, team, position, gap });
  }

  console.log(`[FC] Parsed ${riders.length} riders`);
  return { riders, events };
}

// ============================================================
// MATCHING
// ============================================================

function matchRiders(
  scrapedRiders: ScrapedRider[],
  startlistEntries: { coureur_id: string; rider_nom: string }[],
  rosterMap: Record<string, string>
): {
  matchedRiders: Record<string, { manager_name: string; rider_nom: string; scraped_name: string }>;
  unmatchedNames: string[];
} {
  const matched: Record<string, { manager_name: string; rider_nom: string; scraped_name: string }> = {};
  const unmatched: string[] = [];

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

    // Fallback: token overlap matching
    if (!entry) {
      const scrapedTokens = norm.split(/\s+/);
      for (const e of startlistEntries) {
        const entryTokens = normalize(e.rider_nom).split(/\s+/);
        const overlap = scrapedTokens.filter(t => entryTokens.includes(t));
        if (overlap.length >= Math.min(2, scrapedTokens.length)) {
          entry = e;
          break;
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
      const result = parseFirstCyclingResults(doc);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    } else if (isPCS) {
      const result = parsePCSResults(doc);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    } else {
      // Try both parsers, use whichever gets more results
      const fc = parseFirstCyclingResults(doc);
      const pcs = parsePCSResults(doc);
      if (fc.riders.length >= pcs.riders.length) {
        scrapedRiders = fc.riders;
        scrapedEvents = fc.events;
      } else {
        scrapedRiders = pcs.riders;
        scrapedEvents = pcs.events;
      }
    }

    console.log(`[scrape-live-race] Parsed ${scrapedRiders.length} riders, ${scrapedEvents.length} events`);

    // 3. Get startlist entries + roster owners from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: startlistEntries } = await supabase
      .from("startlist_entries")
      .select("coureur_id, rider_nom")
      .eq("course_id", course_id);

    const { data: courseData } = await supabase
      .from("courses")
      .select("phase_id")
      .eq("id", course_id)
      .single();

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

    // 5. Build groups by gap
    const groups: { name: string; riders: string[]; riderCount: number; gap: string; isPeloton: boolean }[] = [];

    if (scrapedRiders.length > 0) {
      const gapGroups = new Map<string, ScrapedRider[]>();
      for (const r of scrapedRiders) {
        const gapKey = r.gap || "0:00";
        if (!gapGroups.has(gapKey)) gapGroups.set(gapKey, []);
        gapGroups.get(gapKey)!.push(r);
      }

      let idx = 0;
      for (const [gap, groupRiders] of gapGroups) {
        const isPeloton = groupRiders.length > 20;
        const riderNames: string[] = [];

        for (const r of groupRiders) {
          const matchedEntry = Object.entries(matchedRiders).find(
            ([_, v]) => v.scraped_name === r.name
          );
          riderNames.push(matchedEntry ? matchedEntry[1].rider_nom : r.name);
        }

        groups.push({
          name: isPeloton ? "Peloton" : idx === 0 ? "Tête de course" : `Groupe ${idx + 1}`,
          riders: isPeloton ? riderNames.slice(0, 5) : riderNames.slice(0, 10),
          riderCount: groupRiders.length,
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
