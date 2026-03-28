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
// PCS LIVE PARSER — parses procyclingstats.com /live pages
// ============================================================

function parsePCSLive(doc: any, html: string): {
  riders: ScrapedRider[];
  events: ScrapedEvent[];
  situation: { groups: { name: string; gap: string; riders: string[]; riderIds: string[]; riderCount: number; isPeloton: boolean }[]; kmRemaining: number; kmCovered: number; totalKm: number; speed: string };
} {
  const riders: ScrapedRider[] = [];
  const events: ScrapedEvent[] = [];
  const situationGroups: { name: string; gap: string; riders: string[]; riderIds: string[]; riderCount: number; isPeloton: boolean }[] = [];

  // ── Extract race metrics from livestats header ──
  let kmRemaining = 0, kmCovered = 0, totalKm = 0, speed = "";

  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const kmToGoMatch = textContent.match(/KM\s+to\s+go[:\s]*(\d+[\d.]*)/i);
  if (kmToGoMatch) kmRemaining = parseFloat(kmToGoMatch[1]);

  const kmDoneMatch = textContent.match(/km\s+done[:\s]*(\d+[\d.]*)/i);
  if (kmDoneMatch) kmCovered = parseFloat(kmDoneMatch[1]);

  if (kmRemaining > 0 && kmCovered > 0) totalKm = kmRemaining + kmCovered;

  const avgMatch = textContent.match(/Avg\.\s*(\d+[\d.]*)/i);
  if (avgMatch) speed = avgMatch[1] + " km/h";

  console.log(`[PCS Live] km remaining: ${kmRemaining}, km done: ${kmCovered}, speed: ${speed}`);

  // ── Parse situation groups ──
  // PCS structure: div.sit-grp contains groups, each with:
  //   - span with rider count
  //   - group name text
  //   - gap text (e.g., "+0:10")
  //   - nested rider rows with bib, rider link, GC time

  // Strategy: Use markdown-like structure from the text since PCS HTML is consistent
  // Look for the "Situation" section and parse groups

  // Try DOM-based parsing first (more reliable)
  const sitGroups = doc.querySelectorAll(".sit-grp");
  console.log(`[PCS Live] Found ${sitGroups.length} .sit-grp elements`);

  if (sitGroups.length > 0) {
    for (const grp of sitGroups) {
      const grpText = grp.textContent?.trim() || "";
      
      // Extract group name - first significant text line
      const lines = grpText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      
      let groupName = "";
      let gap = "0:00";
      let riderCount = 0;
      const groupRiders: string[] = [];
      const groupPcsSlugs: string[] = [];

      // Find group name and gap from text lines
      for (const line of lines) {
        if (/^\d+$/.test(line)) continue; // skip pure numbers (bib numbers)
        if (/^\+?\d+:\d+/.test(line)) {
          gap = line.startsWith('+') ? line : `+${line}`;
          continue;
        }
        if (!groupName && !/^\d/.test(line) && line.length > 2 && line.length < 60) {
          groupName = line;
        }
      }

      // Extract riders from links with bib + GC gap
      const riderLinks = grp.querySelectorAll("a[href*='rider/']");
      const groupBibs: string[] = [];
      const groupGcGaps: string[] = [];
      for (const link of riderLinks) {
        const href = link.getAttribute("href") || "";
        const slug = href.match(/rider\/([^/]+)/)?.[1] || "";
        const uppercaseSpan = link.querySelector("span");
        const lastName = uppercaseSpan?.textContent?.trim() || "";
        const fullText = link.textContent?.trim() || "";
        const firstName = fullText.replace(lastName, "").trim();
        const name = firstName ? `${firstName} ${lastName}` : fullText;
        
        if (name && name.length >= 3) {
          groupRiders.push(name);
          groupPcsSlugs.push(slug);

          // Extract bib: look for previous sibling text or parent text before the link
          const parentEl = link.parentElement;
          let bib = "";
          let gcGap = "";
          if (parentEl) {
            const parentText = parentEl.textContent || "";
            // Bib is typically a number before the rider name
            const bibMatch = parentText.match(/^\s*(\d{1,3})\s/);
            if (bibMatch) bib = bibMatch[1];
            // GC gap is typically after the rider name, format +H:MM:SS or +MM:SS
            const gcMatch = parentText.match(/(\+\d+:\d{2}(?::\d{2})?)\s*$/);
            if (gcMatch) gcGap = gcMatch[1];
          }
          groupBibs.push(bib);
          groupGcGaps.push(gcGap);

          riders.push({ name, team: "", position: undefined, gap });
        }
      }

      riderCount = groupRiders.length;
      if (!groupName) groupName = riderCount > 20 ? "Peloton" : `Groupe`;

      const isPeloton = groupName.toLowerCase().includes("peloton");

      situationGroups.push({
        name: groupName,
        gap,
        riders: isPeloton ? groupRiders.slice(0, 5) : groupRiders.slice(0, 15),
        riderIds: [],
        riderCount,
        isPeloton,
        riderBibs: isPeloton ? [] : groupBibs.slice(0, 15),
        riderGcGaps: isPeloton ? [] : groupGcGaps.slice(0, 15),
      });

      console.log(`[PCS Live] Group "${groupName}": ${riderCount} riders, gap=${gap}, peloton=${isPeloton}`);
    }
  }

  // Fallback: parse from text if no DOM groups found
  if (situationGroups.length === 0) {
    console.log(`[PCS Live] No .sit-grp found, trying text-based parsing`);

    // Look for "Situation" section in text
    const sitIdx = textContent.indexOf("Situation");
    if (sitIdx >= 0) {
      const sitText = textContent.substring(sitIdx, sitIdx + 5000);
      
      // Parse groups: pattern is "COUNT GroupName +M:SS" followed by rider entries
      const groupRx = /(\d+)\s+((?:The\s+)?[A-Z][a-zA-Zé\s]+?)\s+\+(\d+:\d+)/g;
      let gm;
      const foundGroups: { name: string; gap: string; count: number; index: number }[] = [];
      
      while ((gm = groupRx.exec(sitText)) !== null) {
        foundGroups.push({
          count: parseInt(gm[1], 10),
          name: gm[2].trim(),
          gap: `+${gm[3]}`,
          index: gm.index,
        });
      }

      for (let i = 0; i < foundGroups.length; i++) {
        const fg = foundGroups[i];
        const isPeloton = fg.name.toLowerCase().includes("peloton") || fg.count > 50;
        situationGroups.push({
          name: fg.name,
          gap: fg.gap,
          riders: [],
          riderIds: [],
          riderCount: fg.count,
          isPeloton,
        });
      }
    }
  }

  // ── Extract PCS slugs for matching ──
  // Collect all rider links with their PCS slugs for enhanced matching
  const allRiderLinks = doc.querySelectorAll("a[href*='rider/']");
  const pcsSlugs: { slug: string; name: string }[] = [];
  for (const link of allRiderLinks) {
    const href = link.getAttribute("href") || "";
    const slug = href.match(/rider\/([^/]+)/)?.[1] || "";
    if (!slug) continue;
    const uppercaseSpan = link.querySelector("span");
    const lastName = uppercaseSpan?.textContent?.trim() || "";
    const fullText = link.textContent?.trim() || "";
    const firstName = fullText.replace(lastName, "").trim();
    const name = firstName ? `${firstName} ${lastName}` : fullText;
    if (name && name.length >= 3) {
      pcsSlugs.push({ slug, name });
    }
  }

  console.log(`[PCS Live] Total: ${situationGroups.length} groups, ${riders.length} riders, ${pcsSlugs.length} PCS slugs`);

  return {
    riders,
    events,
    situation: { groups: situationGroups, kmRemaining, kmCovered, totalKm, speed },
  };
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

  // L'Équipe can expose several "X/Y" ratios in the page; keep the most relevant live one
  // by preferring the ratio closest to the speed anchor (km/h), then highest covered distance.
  const kmAnchorIdx = textContent.indexOf("km/h");
  const kmCandidates = [...textContent.matchAll(/(\d{1,3})\s*\/\s*(\d{1,3})(?:\s*km)?/gi)]
    .map((m) => ({
      covered: parseInt(m[1], 10),
      total: parseInt(m[2], 10),
      index: m.index ?? -1,
    }))
    .filter((v) => Number.isFinite(v.covered) && Number.isFinite(v.total) && v.total >= v.covered && v.total <= 400);

  if (kmCandidates.length > 0) {
    kmCandidates.sort((a, b) => {
      const aDist = kmAnchorIdx >= 0 ? Math.abs(a.index - kmAnchorIdx) : Number.MAX_SAFE_INTEGER;
      const bDist = kmAnchorIdx >= 0 ? Math.abs(b.index - kmAnchorIdx) : Number.MAX_SAFE_INTEGER;
      if (aDist !== bDist) return aDist - bDist;
      return b.covered - a.covered;
    });

    kmCovered = kmCandidates[0].covered;
    totalKm = kmCandidates[0].total;
    kmRemaining = Math.max(totalKm - kmCovered, 0);
  }

  const speedMatch = textContent.match(/([\d.]+)\s*km\/h/);
  if (speedMatch) speed = speedMatch[1] + " km/h";

  // ── Extract race situation (groups + riders) ──
  // Strategy: find a tight zone containing structured group data.
  // L'Équipe format examples:
  //   "Échappée" (leading, no gap)
  //   "Gr. Van Dijke | +01'18""
  //   "Van der Poel | +00'31""
  //   "Peloton | +02'41""

  const situationGroups: { name: string; gap: string; riders: string[]; riderCount: number; isPeloton: boolean }[] = [];

  // Build situation zone: restrict tightly to avoid commentary leaking in
  const kmhIdx = textContent.indexOf("km/h");
  const firstEventIdx = textContent.indexOf("il y a ");

  // Try to find a tighter zone by looking for the first group-like pattern after km/h
  let situationZone = "";
  if (kmhIdx >= 0) {
    const afterKmh = textContent.substring(kmhIdx);
    // Look for first group indicator to start the zone
    const groupIndicator = afterKmh.search(/(?:Échapp[ée]e|Peloton|Gr\.\s|Groupe\s+de|Poursuivants?|Favoris|T[eê]te\s+de\s+course)/i);
    // Back up ~200 chars before the first group keyword to capture the leader name
    const zoneStart = groupIndicator >= 0 ? kmhIdx + Math.max(0, groupIndicator - 200) : kmhIdx;
    // End at timeline or limit
    const zoneEnd = firstEventIdx > zoneStart ? firstEventIdx : zoneStart + 3000;
    situationZone = textContent.substring(zoneStart, zoneEnd);
  }

  console.log(`[L'Équipe] Situation zone length: ${situationZone.length}`);
  if (situationZone) {
    console.log(`[L'Équipe] Situation zone preview: ${situationZone.substring(0, 600)}`);
  }

  if (situationZone) {
    // ─── Detect group headers ───
    // Pattern 1: Known keywords (Échappée, Peloton, Poursuivants, Groupe de X, Contre, Favoris, etc.)
    // Pattern 2: "Gr. Name" prefix
    // Pattern 3: Rider name followed by gap (e.g. "Van der Poel | +00'31"")
    //
    // Gap formats supported:
    //   +01'18"  +01'18''  +1'18"  à 01'18"  | +01:18  +1min18s

    const gapRx = `[|·,\\s]*(?:[àa]\\s*)?\\+?\\s*(\\d{1,3})\\s*['′':min]\\s*(\\d{1,2})\\s*["″''s]?\\s*["″''s]?`;

    const groupHeaders: { name: string; gap: string; index: number }[] = [];

    // Pass 1: known keywords with optional gap
    const knownKwSource = `(?:Échapp[ée]e|[EÉ]chapp[ée]e|Poursuivants?|Peloton|Groupe\\s+de\\s+\\w+|Contre|Maillot\\s+\\w+|Favoris|Chasse|T[eê]te\\s+de\\s+course)`;
    const kwRx = new RegExp(`(${knownKwSource})\\s*${gapRx}?`, 'gi');
    let m;
    while ((m = kwRx.exec(situationZone)) !== null) {
      let gap = "0:00";
      if (m[2] && m[3]) {
        gap = `+${parseInt(m[2])}:${m[3].padStart(2, '0')}`;
      }
      groupHeaders.push({ name: m[1], gap, index: m.index });
    }

    // Pass 2: "Gr. Name" prefix groups (e.g. "Gr. Van Dijke | +01'18"")
    const grPrefixRx = new RegExp(`Gr\\.\\s+([A-ZÀ-Ü][a-zà-ü'-]+(?:\\s+[A-Za-zÀ-ü'-]+)*)\\s*${gapRx}`, 'g');
    while ((m = grPrefixRx.exec(situationZone)) !== null) {
      const alreadyCovered = groupHeaders.some(h => Math.abs(h.index - m!.index) < 30);
      if (alreadyCovered) continue;
      const gap = `+${parseInt(m[2])}:${m[3].padStart(2, '0')}`;
      groupHeaders.push({ name: `Gr. ${m[1]}`, gap, index: m.index });
    }

    // Pass 3: Rider name + gap as group header (e.g. "Van der Poel | +00'31"")
    // Must have explicit separator (| or ·) to avoid matching random text
    const riderGrpRx = new RegExp(
      `([A-ZÀ-Ü][a-zà-ü'-]+(?:\\s+(?:de|van|von|el|di|du|le|la|ter|den|der|dos|da))?(?:\\s+[A-Za-zÀ-ü'-]+)+)\\s*[|·]\\s*(?:[àa]\\s*)?\\+?\\s*(\\d{1,3})\\s*['′':min]\\s*(\\d{1,2})\\s*["″''s]?\\s*["″''s]?`,
      'g'
    );
    while ((m = riderGrpRx.exec(situationZone)) !== null) {
      const alreadyCovered = groupHeaders.some(h => Math.abs(h.index - m!.index) < 30);
      if (alreadyCovered) continue;
      // Validate it's a plausible name (not commentary)
      const nameLc = m[1].toLowerCase();
      const badWords = ['il ', 'elle ', 'ils ', ' est ', ' sont ', ' a ', ' ont ', ' va ', ' fait ', ' sur ', ' dans ', ' pour ', ' avec ', ' qui ', ' que ', ' les ', ' des ', ' une '];
      if (badWords.some(w => nameLc.includes(w))) continue;
      if (m[1].length < 4 || m[1].length > 40) continue;
      const gap = `+${parseInt(m[2])}:${m[3].padStart(2, '0')}`;
      groupHeaders.push({ name: m[1], gap, index: m.index });
    }

    // Sort by position in text
    groupHeaders.sort((a, b) => a.index - b.index);

    // Deduplicate (L'Équipe shows expanded + collapsed views)
    const seenGroups = new Set<string>();
    const uniqueHeaders = groupHeaders.filter(h => {
      const key = h.name.toLowerCase().replace(/^gr\.\s*/, '');
      if (seenGroups.has(key)) return false;
      seenGroups.add(key);
      return true;
    });

    // Pass 4: Leader detection — if no group has gap "0:00", look for a rider name before the first group
    if (uniqueHeaders.length > 0 && !uniqueHeaders.some(h => h.gap === "0:00")) {
      const firstGroupIdx = uniqueHeaders[0].index;
      // Search in a wider window: up to 300 chars before the first group
      const searchStart = Math.max(0, firstGroupIdx - 300);
      const beforeFirst = situationZone.substring(searchStart, firstGroupIdx).trim();
      console.log(`[L'Équipe] Pass 4 — beforeFirst (${beforeFirst.length} chars): "${beforeFirst.substring(Math.max(0, beforeFirst.length - 200))}"`);
      
      // Look for a rider name pattern: "M. Van der Poel" or "Van der Poel" (possibly with flag emoji)
      // Search for the LAST plausible name match (closest to the first group)
      const leaderRx = /(?:[\u{1F1E0}-\u{1F1FF}]{2}\s*)?([A-ZÀ-Ü][a-zà-ü]*\.?\s+(?:(?:de|van|von|el|di|du|le|la|ter|den|der|dos|da)\s+)*[A-ZÀ-Ü][a-zà-ü'-]+(?:\s+[A-Za-zÀ-ü'-]+)*)/giu;
      let leaderMatch;
      let lastLeaderMatch: RegExpExecArray | null = null;
      while ((leaderMatch = leaderRx.exec(beforeFirst)) !== null) {
        lastLeaderMatch = leaderMatch;
      }
      if (lastLeaderMatch && lastLeaderMatch[1].length >= 4 && lastLeaderMatch[1].length <= 40) {
        const leaderName = lastLeaderMatch[1].trim();
        const lc = leaderName.toLowerCase();
        const badWords = ['il ', 'elle ', 'ils ', ' est ', ' sont ', ' a ', ' ont ', ' va ', ' fait ', 'afficher', 'masquer', 'détail', 'course', 'étape'];
        if (!badWords.some(w => lc.includes(w))) {
          console.log(`[L'Équipe] Leader detected before first group: "${leaderName}"`);
          uniqueHeaders.unshift({ name: leaderName, gap: "0:00", index: 0 });
        }
      }
    }

    console.log(`[L'Équipe] Found ${uniqueHeaders.length} group headers: ${uniqueHeaders.map(h => `${h.name} (${h.gap})`).join(', ')}`);

    // Extract riders for each group section
    for (let i = 0; i < uniqueHeaders.length; i++) {
      const start = uniqueHeaders[i].index;
      const end = i + 1 < uniqueHeaders.length ? uniqueHeaders[i + 1].index : situationZone.length;
      let section = situationZone.substring(start, end);

      // Cut only at "masquer le détail" (end of expanded view), NOT "afficher le détail"
      const detailCut = section.search(/masquer le d[ée]tail/i);
      if (detailCut > 0) section = section.substring(0, detailCut);

      // Extract rider names: handle optional flag emojis before name
      const riderPattern = /(?:[\u{1F1E0}-\u{1F1FF}]{2}\s*)?([A-ZÀ-Ü][a-zà-ü]*\.?\s+[A-Za-zÀ-ü\- ']+?)\s*\(([^)]+)\)/gu;
      const groupRiders: string[] = [];
      let rMatch;
      while ((rMatch = riderPattern.exec(section)) !== null) {
        const riderName = rMatch[1].trim();
        const team = rMatch[2].trim();
        // Filter out false positives
        if (riderName.length < 4 || riderName.length > 50) continue;
        const lc = riderName.toLowerCase();
        if (lc.includes("groupe") || lc.includes("peloton") || lc.startsWith("photo")) continue;
        // Reject sentence fragments
        if (/\b(sur|la|le|les|un|des|est|qui|point|dans|pour|avec|que|cette|son|ses|leur|nous|vous|ils|elle|elles|ont|sont|fait|mais|donc|car|comme)\b/.test(lc)) continue;
        // Reject if team name looks like a sentence (contains verbs/articles)
        if (/\b(est|sont|a été|ont été|fait|dans|pour)\b/.test(team.toLowerCase())) continue;

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

  // If no structured groups found, do NOT create a fake "peloton" with all content
  // Return empty situation instead of corrupted data

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
    // Remove trailing tag-like names that L'Équipe appends (e.g., "Lozano, David Novo Nordisk")
    // These are comma-separated name fragments after the last sentence-ending period
    const lastDotIdx = text.lastIndexOf('.');
    if (lastDotIdx > 0 && lastDotIdx < text.length - 2) {
      const trailing = text.substring(lastDotIdx + 1).trim();
      // If trailing part has no verb-like structure (short, comma-separated words), remove it
      const hasVerb = /\b(est|sont|a|ont|va|fait|prend|vient|roule|reste|passe|lance|attaque|tente|rejoint)\b/i.test(trailing);
      if (!hasVerb && trailing.length < 150) {
        text = text.substring(0, lastDotIdx + 1).trim();
      }
    }
    text = text.replace(/\s{2,}/g, ' ');

    if (text.length > 500) text = text.substring(0, 500) + "...";
    if (!text || text.length < 10) continue;

    // Split into title + body (L'Équipe style)
    let title = "";
    let body = text;
    const splitMatch = text.match(/^([^.]{10,120}\.)\s+([A-ZÀ-Ü])/);
    if (splitMatch) {
      title = splitMatch[1];
      body = text.substring(splitMatch[1].length).trim();
    } else if (text.length > 80) {
      const dotIdx = text.indexOf('.');
      if (dotIdx > 10 && dotIdx < 120) {
        title = text.substring(0, dotIdx + 1);
        body = text.substring(dotIdx + 1).trim();
      }
    }

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

    events.push({ time: timeStr, type, title, text: body.substring(0, 300), riders: riderNames });
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

    // Fallback: initial + lastname matching (e.g., "J. Alaphilippe" → "ALAPHILIPPE Julian")
    if (!entry) {
      const initialMatch = sr.name.match(/^([A-ZÀ-Ü])\.\s+(.+)$/i);
      if (initialMatch) {
        const initial = initialMatch[1].toLowerCase();
        const lastNamePart = normalize(initialMatch[2]).toLowerCase();
        for (const e of startlistEntries) {
          const entryNorm = normalize(e.rider_nom).toLowerCase();
          const entryTokens = entryNorm.split(/\s+/);
          // Check if any token starts with the initial AND the lastname tokens are all present
          const lastNameTokens = lastNamePart.split(/\s+/);
          const allLastNameMatch = lastNameTokens.every(t => entryTokens.some(et => et === t || et.startsWith(t)));
          const initialMatches = entryTokens.some(t => t.startsWith(initial) && !lastNameTokens.includes(t));
          if (allLastNameMatch && initialMatches) {
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
    const isLEquipe = url.includes("lequipe.fr");

    let scrapedRiders: ScrapedRider[] = [];
    let scrapedEvents: ScrapedEvent[] = [];

    let liveSituation: any = null;
    const isPCSLive = isPCS && /\/live\b/i.test(url);

    if (isLEquipe) {
      const result = parseLEquipeLive(doc, html);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
      liveSituation = result.situation;
    } else if (isPCSLive) {
      const result = parsePCSLive(doc, html);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
      liveSituation = result.situation;
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

    const { data: courseData } = await supabase
      .from("courses")
      .select("phase_id")
      .eq("id", course_id)
      .single();

    // startlist_entries links via startlist_imports (startlist_id → startlist_imports.id, race_id = course_id)
    const { data: startlistImport } = await supabase
      .from("startlist_imports")
      .select("id")
      .eq("race_id", course_id)
      .limit(1)
      .single();

    let startlistEntries: { coureur_id: string; rider_nom: string }[] = [];
    if (startlistImport) {
      const { data: entries } = await supabase
        .from("startlist_entries")
        .select("coureur_id, source_name")
        .eq("startlist_id", startlistImport.id)
        .not("coureur_id", "is", null);
      
      if (entries) {
        startlistEntries = entries.map(e => ({ coureur_id: e.coureur_id!, rider_nom: e.source_name || "" }));
      }
      console.log(`[scrape-live-race] Found ${startlistEntries.length} startlist entries for course ${course_id}`);
    } else {
      console.log(`[scrape-live-race] No startlist import found for course ${course_id}, trying coureurs_saisons fallback`);
      if (courseData?.phase_id) {
        const { data: phaseData } = await supabase
          .from("phases")
          .select("saison_id")
          .eq("id", courseData.phase_id)
          .single();
        if (phaseData) {
          const { data: cs } = await supabase
            .from("coureurs_saisons")
            .select("coureur_id, coureurs!inner(nom)")
            .eq("saison_id", phaseData.saison_id)
            .eq("actif", true)
            .limit(2000);
          if (cs) {
            startlistEntries = cs.map((c: any) => ({ coureur_id: c.coureur_id, rider_nom: c.coureurs?.nom || "" }));
          }
          console.log(`[scrape-live-race] Fallback: ${startlistEntries.length} coureurs for season`);
        }
      }
    }

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

    // Build a reverse map: normalized rider name → coureur_id
    const nameToIdMap: Record<string, string> = {};
    for (const [coureurId, info] of Object.entries(matchedRiders)) {
      const v = info as any;
      // Index by scraped_name and rider_nom (both normalized to lowercase)
      if (v.scraped_name) nameToIdMap[v.scraped_name.toLowerCase()] = coureurId;
      if (v.rider_nom) nameToIdMap[v.rider_nom.toLowerCase()] = coureurId;
      // Also index by last name only for "J. Alaphilippe" style matching
      const lastNameMatch = v.rider_nom?.match(/\S+$/);
      if (lastNameMatch) nameToIdMap[lastNameMatch[0].toLowerCase()] = coureurId;
      const scrapedLastName = v.scraped_name?.match(/\S+$/);
      if (scrapedLastName) nameToIdMap[scrapedLastName[0].toLowerCase()] = coureurId;
    }

    // Enrich groups with riderIds
    function enrichGroupsWithIds(grps: any[]) {
      return grps.map((g: any) => {
        const riderIds = (g.riders || []).map((name: string) => {
          const lc = name.toLowerCase().trim();
          // Try exact match first, then last name
          let id = nameToIdMap[lc];
          if (!id) {
            const lastN = lc.match(/\S+$/);
            if (lastN) id = nameToIdMap[lastN[0]];
          }
          return id || "";
        });
        return { ...g, riderIds };
      });
    }

    // Use live situation (L'Équipe or PCS live) if available, otherwise use gap-based groups
    const finalSituation = liveSituation && liveSituation.groups.length > 0
      ? {
          groups: enrichGroupsWithIds(liveSituation.groups),
          kmRemaining: liveSituation.kmRemaining,
          kmCovered: liveSituation.kmCovered,
          totalKm: liveSituation.totalKm,
          speed: liveSituation.speed,
        }
      : { groups: enrichGroupsWithIds(groups), kmRemaining: 0 };

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
