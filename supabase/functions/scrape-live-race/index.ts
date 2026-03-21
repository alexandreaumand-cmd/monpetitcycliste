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

/** Decode common HTML entities */
function decodeEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function parseLEquipeLive(doc: any, html: string): {
  riders: ScrapedRider[];
  events: ScrapedEvent[];
  situation: { groups: { name: string; gap: string; riders: string[]; riderCount: number; isPeloton: boolean }[]; kmRemaining: number; kmCovered: number; totalKm: number; speed: string };
} {
  const events: ScrapedEvent[] = [];
  const riders: ScrapedRider[] = [];

  const textContent = decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

  // ── Extract km and speed ──
  let kmCovered = 0, totalKm = 0, kmRemaining = 0, speed = "";

  const kmMatch = textContent.match(/(\d+)\s*\/\s*(\d+)\s*km/);
  if (kmMatch) {
    kmCovered = parseInt(kmMatch[1], 10);
    totalKm = parseInt(kmMatch[2], 10);
    kmRemaining = totalKm - kmCovered;
  }

  const speedMatch = textContent.match(/([\d.]+)\s*km\/h/);
  if (speedMatch) speed = speedMatch[1] + " km/h";

  // ── Extract race situation (groups + riders) ──
  // Restrict to the situation zone: between "km/h" and the first "il y a" (timeline start)
  // This avoids picking up groups from article text

  const situationGroups: { name: string; gap: string; riders: string[]; riderCount: number; isPeloton: boolean }[] = [];

  const kmhIdx = textContent.indexOf("km/h");
  const firstEventIdx = textContent.indexOf("il y a ");
  // Situation zone is between km/h and the first timeline event
  const situationZone = kmhIdx >= 0 && firstEventIdx > kmhIdx
    ? textContent.substring(kmhIdx, firstEventIdx)
    : kmhIdx >= 0
      ? textContent.substring(kmhIdx, kmhIdx + 3000)
      : "";

  console.log(`[L'Équipe] Situation zone length: ${situationZone.length}, starts at ${kmhIdx}, events at ${firstEventIdx}`);

  if (situationZone) {
    // Match group headers: "Groupe de tête", "Peloton |+02'41''"
    const groupHeaderPattern = /(Groupe\s+de\s+t[êe]te|Peloton)\s*(?:\|?\s*\+?\s*([\d]+['′'']\s*[\d]+['′''"″]*)?)?/gi;
    const groupHeaders: { name: string; gap: string; index: number }[] = [];
    let gMatch;
    while ((gMatch = groupHeaderPattern.exec(situationZone)) !== null) {
      const rawGap = gMatch[2] || "";
      let gap = "0:00";
      if (rawGap) {
        const gapNums = rawGap.match(/(\d+)/g);
        if (gapNums && gapNums.length >= 2) {
          gap = `+${parseInt(gapNums[0])}:${gapNums[1].padStart(2, '0')}`;
        }
      }
      groupHeaders.push({ name: gMatch[1], gap, index: gMatch.index });
    }

    // Deduplicate (L'Équipe shows expanded + collapsed)
    const seenGroups = new Set<string>();
    const uniqueHeaders = groupHeaders.filter(h => {
      const key = h.name.toLowerCase();
      if (seenGroups.has(key)) return false;
      seenGroups.add(key);
      return true;
    });

    console.log(`[L'Équipe] Found ${uniqueHeaders.length} group headers: ${uniqueHeaders.map(h => `${h.name} (${h.gap})`).join(', ')}`);

    for (let i = 0; i < uniqueHeaders.length; i++) {
      const start = uniqueHeaders[i].index;
      let end = i + 1 < uniqueHeaders.length ? uniqueHeaders[i + 1].index : situationZone.length;
      let section = situationZone.substring(start, end);

      // Cut at "masquer/afficher le détail" which marks end of the rider list
      const detailCut = section.search(/masquer le d[ée]tail|afficher le d[ée]tail/i);
      if (detailCut > 0) section = section.substring(0, detailCut);

      // Extract rider names: "X. LastName (Team)" pattern
      const riderPattern = /([A-ZÀ-Ü][a-zà-ü]*\.?\s+[A-Za-zÀ-ü\- ']+?)\s*\(([^)]+)\)/g;
      const groupRiders: string[] = [];
      let rMatch;
      while ((rMatch = riderPattern.exec(section)) !== null) {
        const riderName = rMatch[1].trim();
        const team = rMatch[2].trim();
        if (riderName.toLowerCase().includes("groupe") || riderName.toLowerCase().includes("peloton")) continue;
        if (riderName.length < 4) continue;
        if (riderName.toLowerCase().startsWith("photo")) continue;
        // Filter out sentence-like matches (contain common words)
        const lc = riderName.toLowerCase();
        if (lc.includes(" sur ") || lc.includes(" la ") || lc.includes(" le ") || lc.includes(" les ") || lc.includes(" un ") || lc.includes(" des ") || lc.includes(" est ") || lc.includes(" qui ") || lc.includes(" point ")) continue;
        
        groupRiders.push(riderName);
        riders.push({ name: riderName, team, position: undefined, gap: uniqueHeaders[i].gap });
      }

      const isPeloton = uniqueHeaders[i].name.toLowerCase().includes("peloton");
      situationGroups.push({
        name: uniqueHeaders[i].name,
        gap: uniqueHeaders[i].gap,
        riders: groupRiders,
        riderCount: groupRiders.length,
        isPeloton,
      });
      console.log(`[L'Équipe] Group "${uniqueHeaders[i].name}": ${groupRiders.length} riders, gap=${uniqueHeaders[i].gap}`);
    }
  }

  // ── Extract timeline events ──
  // Format: "il y a Xmin, Y km <text>" — note the comma and space variations
  const eventPattern = /il y a (\d+)\s*min\s*,?\s*(\d+)\s*km\s+(.*?)(?=il y a \d+\s*min|L['']ÉQUIPE|publicité|$)/gi;
  let eventMatch;

  while ((eventMatch = eventPattern.exec(textContent)) !== null) {
    const minutesAgo = parseInt(eventMatch[1], 10);
    const km = parseInt(eventMatch[2], 10);
    let text = eventMatch[3].trim();

    // Clean up scraped text
    text = text.replace(/\s*lire l['']article.*$/i, '').trim();
    text = text.replace(/\s*photo de\s+\w+,?\s*\w*\s+[\w\s-]+$/i, '').trim();
    text = text.replace(/\s{2,}/g, ' ');

    if (text.length > 500) text = text.substring(0, 500) + "...";
    if (!text || text.length < 10) continue;

    let type = "info";
    const textLower = text.toLowerCase();
    if (textLower.includes("chute") || textLower.includes("tombé")) type = "crash";
    else if (textLower.includes("échapp") || textLower.includes("en tête") || textLower.includes("attaque")) type = "breakaway";
    else if (textLower.includes("écart") || textLower.includes("avance")) type = "gap";
    else if (textLower.includes("sprint") || textLower.includes("intermédiaire")) type = "intermediate";
    else if (textLower.includes("lâché") || textLower.includes("distancé") || textLower.includes("arrière")) type = "dropped";
    else if (textLower.includes("abandon")) type = "abandon";

    const riderNames: string[] = [];
    const namePattern = /([A-ZÀ-Ü][a-zà-ü'-]+(?:\s+[A-ZÀ-Ü][a-zà-ü'-]+)*)\s+\(([^)]+)\)/g;
    let nameMatch;
    while ((nameMatch = namePattern.exec(text)) !== null) {
      riderNames.push(nameMatch[1]);
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() - minutesAgo);
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    events.push({ time: timeStr, type, text: text.substring(0, 300), riders: riderNames });
  }

  console.log(`[L'Équipe] Parsed ${events.length} events, ${riders.length} riders, ${situationGroups.length} groups, km: ${kmCovered}/${totalKm}, speed: ${speed}`);
  return {
    riders,
    events,
    situation: { groups: situationGroups, kmRemaining, kmCovered, totalKm, speed },
  };
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

    let lequipeSituation: any = null;

    if (isLEquipe) {
      const result = parseLEquipeLive(doc, html);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
      lequipeSituation = result.situation;
    } else if (isFirstCycling) {
      const result = parseFirstCyclingResults(doc);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    } else if (isPCS) {
      const result = parsePCSResults(doc);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
    } else {
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

    // Use L'Équipe situation if available (it has structured groups already), otherwise use gap-based groups
    const finalSituation = lequipeSituation && lequipeSituation.groups.length > 0
      ? {
          groups: lequipeSituation.groups,
          kmRemaining: lequipeSituation.kmRemaining,
          kmCovered: lequipeSituation.kmCovered,
          totalKm: lequipeSituation.totalKm,
          speed: lequipeSituation.speed,
        }
      : { groups, kmRemaining: 0 };

    const result = {
      timeline: scrapedEvents,
      situation: finalSituation,
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
