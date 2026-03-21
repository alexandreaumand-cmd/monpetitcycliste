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

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) continue;

    // Position: first td
    const posText = cells[0]?.textContent?.trim();
    const position = posText && /^\d+$/.test(posText) ? parseInt(posText, 10) : undefined;

    // Skip DNF/DNS rows
    if (posText === "DNF" || posText === "DNS" || posText === "OTL") continue;

    // Rider name: find link to rider (PCS uses relative URLs like "rider/name")
    const riderLink = row.querySelector("a[href*='rider/']");
    // Skip team links
    if (!riderLink || riderLink.getAttribute("href")?.includes("team/")) continue;
    if (!riderLink) continue;

    // Extract last name from span.uppercase, rest is first name
    const uppercaseSpan = riderLink.querySelector("span");
    const lastName = uppercaseSpan?.textContent?.trim() || "";
    const fullText = riderLink.textContent?.trim() || "";
    const firstName = fullText.replace(lastName, "").trim();
    const name = firstName ? `${firstName} ${lastName}` : fullText;
    if (!name) continue;

    // Team: find link to team
    const teamLink = row.querySelector("a[href*='team/']");
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

  const rows = doc.querySelectorAll("tr.rider");
  console.log(`[FC] Found ${rows.length} rider rows`);

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 4) continue;

    const posText = cells[0]?.textContent?.trim();
    const position = posText && /^\d+$/.test(posText) ? parseInt(posText, 10) : undefined;
    if (posText === "DNF" || posText === "DNS") continue;

    const riderLink = row.querySelector("a[href*='rider.php']");
    const name = riderLink?.getAttribute("title") || riderLink?.textContent?.trim() || "";
    if (!name) continue;

    const teamLink = row.querySelector("a[href*='team.php']");
    const team = teamLink?.getAttribute("title") || teamLink?.textContent?.trim() || "";

    const lastCell = cells[cells.length - 1];
    const gap = lastCell?.textContent?.trim() || "";

    riders.push({ name, team, position, gap });
  }

  console.log(`[FC] Parsed ${riders.length} riders`);
  return { riders, events };
}

// ============================================================
// L'ÉQUIPE PARSER — parses lequipe.fr live text pages
// ============================================================

function parseLEquipeLive(doc: any, html: string): { riders: ScrapedRider[]; events: ScrapedEvent[] } {
  const events: ScrapedEvent[] = [];
  const riders: ScrapedRider[] = [];

  // Parse timeline events from the live text
  // L'Équipe uses <div> blocks with time info, km, and content
  // We'll parse from the raw HTML using regex patterns since the DOM structure 
  // may vary, but the text patterns are consistent

  // Extract race situation (groups) from the track section
  // Look for group labels like "Groupe de tête" and "Peloton |+XX'XX''"
  const groupRegex = /(Groupe de tête|Peloton|Groupe \d+)\s*(?:\|?\s*\+?([\d''"]+))?/g;
  let groupMatch;
  const groups: { name: string; gap: string; riderNames: string[] }[] = [];
  
  while ((groupMatch = groupRegex.exec(html)) !== null) {
    const groupName = groupMatch[1];
    const gap = groupMatch[2] || "0:00";
    // We'll fill rider names from the surrounding context
    groups.push({ name: groupName, gap, riderNames: [] });
  }

  // Extract rider names from links to CyclismeFicheCoureur pages
  const riderLinkRegex = /CyclismeFicheCoureur\d+\.html[^>]*>(?:[^<]*<[^>]*>)*\s*([A-ZÀ-Ü][a-zà-ü.'-]+(?:\s+[A-ZÀ-Ü]\.)?(?:\s+[A-ZÀ-Ü][a-zà-ü.'-]+)*)\s*(?:\\n|\s)*\s*([^<]*?)\s*(?:\\n|\s)*(?:<|$)/gi;

  // Better approach: parse all timeline entries using the text content
  // L'Équipe live events have pattern: "il y a Xmin, XXX km, [icon], title, text"
  
  // Use regex on full HTML to find live comment blocks
  // Each block typically contains: time ago, km marker, event text
  const liveBlockRegex = /il y a (\d+)min[\s\S]*?(\d+)\s*km[\s\S]*?<\/[^>]+>\s*([\s\S]*?)(?=il y a \d+min|$)/gi;
  
  // Simpler approach: parse from text content
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  
  // Pattern: "il y a Xmin, Y km" followed by event text
  const eventPattern = /il y a (\d+)\s*min\s*,?\s*(\d+)\s*km\s+(.*?)(?=il y a \d+\s*min|L'ÉQUIPE|publicité|$)/gi;
  let eventMatch;
  
  while ((eventMatch = eventPattern.exec(textContent)) !== null) {
    const minutesAgo = parseInt(eventMatch[1], 10);
    const km = parseInt(eventMatch[2], 10);
    let text = eventMatch[3].trim();
    
    // Clean up the text - take first meaningful sentence/paragraph
    // Remove article promos, image refs, etc.
    text = text.replace(/\s*lire l'article.*$/i, '').trim();
    text = text.replace(/\s*photo de .*$/i, '').trim();
    
    // Limit text length
    if (text.length > 500) text = text.substring(0, 500) + "...";
    if (!text || text.length < 10) continue;

    // Detect event type from keywords
    let type = "info";
    const textLower = text.toLowerCase();
    if (textLower.includes("chute") || textLower.includes("tombé")) type = "crash";
    else if (textLower.includes("échapp") || textLower.includes("en tête") || textLower.includes("attaque")) type = "breakaway";
    else if (textLower.includes("écart") || textLower.includes("avance")) type = "gap";
    else if (textLower.includes("sprint") || textLower.includes("intermédiaire")) type = "intermediate";
    else if (textLower.includes("lâché") || textLower.includes("distancé")) type = "dropped";
    else if (textLower.includes("abandon")) type = "abandon";

    // Extract rider names mentioned
    const riderNames: string[] = [];
    const namePattern = /([A-ZÀ-Ü][a-zà-ü'-]+(?:\s+[A-ZÀ-Ü][a-zà-ü'-]+)*)\s+\(([^)]+)\)/g;
    let nameMatch;
    while ((nameMatch = namePattern.exec(text)) !== null) {
      riderNames.push(nameMatch[1]);
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() - minutesAgo);
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    events.push({
      time: timeStr,
      type,
      text: text.substring(0, 300),
      riders: riderNames,
    });
  }

  // Extract km remaining from "XXX / YYY km" pattern
  const kmPattern = /(\d+)\s*\/\s*(\d+)\s*km/;
  const kmMatch = kmPattern.exec(textContent);
  let kmRemaining = 0;
  if (kmMatch) {
    const covered = parseInt(kmMatch[1], 10);
    const total = parseInt(kmMatch[2], 10);
    kmRemaining = total - covered;
  }

  // Extract riders from the situation (group sections in the HTML)
  // Look for rider names in the track/situation section
  const situationRiderRegex = /CyclismeFicheCoureur\d+\.html[^>]*>[^<]*?([A-ZÀ-Ü]\.\s+[A-Za-zÀ-ü'-]+(?:\s+[A-Za-zÀ-ü'-]+)*)/g;
  let srMatch;
  while ((srMatch = situationRiderRegex.exec(html)) !== null) {
    const name = srMatch[1].trim();
    if (name && name.length > 2) {
      riders.push({ name, team: "", position: undefined, gap: "" });
    }
  }

  console.log(`[L'Équipe] Parsed ${events.length} events, ${riders.length} riders from situation`);
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
    const isLEquipe = url.includes("lequipe.fr");

    let scrapedRiders: ScrapedRider[] = [];
    let scrapedEvents: ScrapedEvent[] = [];

    if (isLEquipe) {
      const result = parseLEquipeLive(doc, html);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    } else if (isFirstCycling) {
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
