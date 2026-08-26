import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { normalize, tokenSig } from "../_shared/normalization.ts";
import { fetchPcs } from "../_shared/pcsFetch.ts";

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

function parsePCSLive(doc: any, html: string, opts: { isStageRace?: boolean } = {}): {
  riders: ScrapedRider[];
  events: ScrapedEvent[];
  situation: { groups: { name: string; gap: string; riders: string[]; riderIds: string[]; riderCount: number; isPeloton: boolean }[]; kmRemaining: number; kmCovered: number; totalKm: number; speed: string };
} {
  const isStageRace = !!opts.isStageRace;
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
  // PCS DOM (Nov 2025+):
  //   ul.situ5b > li.group
  //     ├ div.bol            → <font>rank</font> <span data-nr="N">N</span>   (N = rider count)
  //     ├ div.groupname      → group name (often empty for breakaway/peloton)
  //     ├ div.time[data-sec] → "+M:SS" (group gap to leader)
  //     └ ul > li            → one rider per <li>
  //         ├ span.nr        → rank within group
  //         ├ span.shirt_icon20 teamXXXX[title="..."]   → team name
  //         ├ div.bib        → bib number
  //         ├ a[href*='rider/'] → name (e.g. "BJERG Mikkel")
  //         └ div.gc         → "+H:MM:SS" GC gap
  //
  // Legacy DOM (pre-Nov 2025) used .sit-grp — kept as fallback.

  type RawGroup = {
    name: string;
    gap: string;
    riders: string[];
    pcsSlugs: string[];
    bibs: string[];
    teams: string[];
    gcGaps: string[];
    riderCount: number;
  };

  const rawGroups: RawGroup[] = [];

  const newGroupEls = Array.from(doc.querySelectorAll("ul.situ5b > li.group"));
  console.log(`[PCS Live] Using ul.situ5b parser, found ${newGroupEls.length} li.group`);

  if (newGroupEls.length > 0) {
    for (const grp of newGroupEls as any[]) {
      // gap
      const timeEl = grp.querySelector(":scope > div.time, div.time");
      let gap = "0:00";
      if (timeEl) {
        const dataSec = timeEl.getAttribute?.("data-sec");
        if (dataSec && /^\d+$/.test(dataSec)) {
          const s = parseInt(dataSec, 10);
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60);
          const sec = s % 60;
          gap = h > 0
            ? `+${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
            : `+${m}:${String(sec).padStart(2, "0")}`;
        } else {
          // strip any nested <font>??</font>
          const clone = timeEl.cloneNode(true);
          clone.querySelectorAll?.("font").forEach((f: any) => f.remove());
          const t = (clone.textContent || "").trim();
          if (t) gap = t.startsWith("+") ? t : `+${t}`;
        }
      }

      // rider count from .bol span[data-nr]
      let riderCount = 0;
      const countSpan = grp.querySelector("div.bol span[data-nr]");
      if (countSpan) {
        const n = parseInt(countSpan.getAttribute("data-nr") || "0", 10);
        if (!Number.isNaN(n)) riderCount = n;
      }

      // group name (often empty)
      const nameEl = grp.querySelector("div.groupname");
      let groupName = (nameEl?.textContent || "").trim();

      // riders
      const riderLis = Array.from(grp.querySelectorAll(":scope > ul > li, ul > li"));
      const seenSlugs = new Set<string>();
      const names: string[] = [];
      const slugs: string[] = [];
      const bibs: string[] = [];
      const teams: string[] = [];
      const gcGaps: string[] = [];

      for (const li of riderLis as any[]) {
        const link = li.querySelector("a[href*='rider/']");
        if (!link) continue;
        const href = link.getAttribute("href") || "";
        const slug = href.match(/rider\/([^/?#]+)/)?.[1] || "";
        if (slug && seenSlugs.has(slug)) continue;
        if (slug) seenSlugs.add(slug);

        const fullText = (link.textContent || "").trim();
        let name = fullText;
        if ((!name || name.length < 2) && slug) {
          name = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
        if (!name || name.length < 2) continue;

        const bib = (li.querySelector("div.bib")?.textContent || "").trim();
        const teamIcon = li.querySelector("span[class*='shirt_icon']");
        const team = (teamIcon?.getAttribute?.("title") || "").trim();
        const gcGap = (li.querySelector("div.gc")?.textContent || "").trim();

        names.push(name);
        slugs.push(slug);
        bibs.push(bib);
        teams.push(team);
        gcGaps.push(gcGap);

        riders.push({ name, team, position: undefined, gap });
      }

      if (riderCount === 0) riderCount = names.length;

      rawGroups.push({
        name: groupName,
        gap,
        riders: names,
        pcsSlugs: slugs,
        bibs,
        teams,
        gcGaps,
        riderCount,
      });
    }
  } else {
    // ── Legacy fallback: .sit-grp parser ──
    const allSitGrps = Array.from(doc.querySelectorAll(".sit-grp"));
    console.log(`[PCS Live] Legacy fallback: found ${allSitGrps.length} .sit-grp elements`);

    const topLevelSitGrps = allSitGrps.filter((el: any) => {
      let parent = el.parentElement;
      while (parent) {
        if (parent.classList?.contains("sit-grp")) return false;
        parent = parent.parentElement;
      }
      return true;
    });

    const countDirectRiderLinks = (el: any): number => {
      const all = el.querySelectorAll("a[href*='rider/']");
      const nested = new Set(Array.from(el.querySelectorAll(".sit-grp")));
      let count = 0;
      for (const link of all) {
        let p = (link as any).parentElement;
        let inNested = false;
        while (p && p !== el) {
          if (nested.has(p)) { inNested = true; break; }
          p = p.parentElement;
        }
        if (!inNested) count++;
      }
      return count;
    };

    const groupNameRx = /(peloton|^group\b|^groupe\b|head of|chase|leaders?|breakaway|échappée|echappee)/i;
    let sitGroups = topLevelSitGrps.filter((el: any) => {
      const direct = countDirectRiderLinks(el);
      if (direct >= 2) return true;
      const text = (el.textContent || "").trim();
      if (groupNameRx.test(text)) return true;
      return false;
    });
    if (sitGroups.length === 0 && topLevelSitGrps.length > 0) sitGroups = topLevelSitGrps;

    for (const grp of sitGroups as any[]) {
      const grpText = grp.textContent?.trim() || "";
      let groupName = "";
      let gap = "0:00";
      const groupRiders: string[] = [];
      const groupPcsSlugs: string[] = [];
      const groupBibs: string[] = [];
      const groupGcGaps: string[] = [];

      const firstRiderLink = grp.querySelector("a[href*='rider/']");
      const firstRiderText = firstRiderLink?.textContent || "";
      const headerText = firstRiderText && grpText.includes(firstRiderText)
        ? grpText.substring(0, grpText.indexOf(firstRiderText))
        : grpText.split("\n").slice(0, 3).join("\n");
      const headerLines = headerText.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      for (const line of headerLines) {
        if (/^\d+$/.test(line)) continue;
        if (/^\+?\d+:\d+/.test(line)) { gap = line.startsWith("+") ? line : `+${line}`; break; }
        if (!groupName && !/^\d/.test(line) && line.length > 2 && line.length < 60) groupName = line;
      }

      const nestedSitGrps = new Set(Array.from(grp.querySelectorAll(".sit-grp")));
      const riderLinks = Array.from(grp.querySelectorAll("a[href*='rider/']")).filter((link: any) => {
        let parent = link.parentElement;
        while (parent && parent !== grp) {
          if (nestedSitGrps.has(parent)) return false;
          parent = parent.parentElement;
        }
        return true;
      });

      for (const link of riderLinks as any[]) {
        const href = link.getAttribute("href") || "";
        const slug = href.match(/rider\/([^/]+)/)?.[1] || "";
        const fullText = (link.textContent || "").trim();
        const uppercaseSpan = link.querySelector("span");
        let name = fullText;
        if (uppercaseSpan) {
          const lastName = uppercaseSpan.textContent?.trim() || "";
          if (lastName && fullText.includes(lastName)) {
            const firstName = fullText.replace(lastName, "").trim();
            name = firstName ? `${firstName} ${lastName}` : fullText;
          }
        }
        if ((!name || name.length < 2) && slug) {
          name = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
        if (!name || name.length < 2) continue;

        groupRiders.push(name);
        groupPcsSlugs.push(slug);

        const parentEl = link.parentElement;
        let bib = "";
        let gcGap = "";
        if (parentEl) {
          const parentText = parentEl.textContent || "";
          const riderLastName = name.split(" ").pop() || name;
          const nameIdx = parentText.indexOf(riderLastName);
          if (nameIdx > 0) {
            const beforeName = parentText.substring(0, nameIdx).trim();
            const allNumbers = beforeName.match(/\d+/g);
            if (allNumbers && allNumbers.length >= 2) bib = allNumbers[allNumbers.length - 1];
            else if (allNumbers && allNumbers.length === 1) bib = allNumbers[0];
          }
          const gcMatch = parentText.match(/(\+\d+:\d{2}(?::\d{2})?)\s*$/);
          if (gcMatch) gcGap = gcMatch[1];
        }
        groupBibs.push(bib);
        groupGcGaps.push(gcGap);

        riders.push({ name, team: "", position: undefined, gap });
      }

      rawGroups.push({
        name: groupName,
        gap,
        riders: groupRiders,
        pcsSlugs: groupPcsSlugs,
        bibs: groupBibs,
        teams: groupRiders.map(() => ""),
        gcGaps: groupGcGaps,
        riderCount: groupRiders.length,
      });
    }
  }

  // ── Normalize raw groups into situationGroups ──
  if (rawGroups.length > 0) {
    // Peloton detection:
    //  - explicit name containing "peloton"
    //  - OR riderCount >= 20 (true bunch)
    //  - OR (multi-group case) last group with the largest gap and no/few listed riders
    //    → matches PCS Live which marks "P PELOTON" without enumerating riders
    let lastIdx = -1;
    let lastSec = -1;
    const gapToSec = (s: string): number => {
      const m = s.replace(/^\+/, "").match(/^(?:(\d+):)?(\d+):(\d+)$/);
      if (!m) return 0;
      return (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2], 10) * 60) + parseInt(m[3], 10);
    };
    rawGroups.forEach((g, idx) => {
      const sec = gapToSec(g.gap);
      if (sec > lastSec) { lastSec = sec; lastIdx = idx; }
    });

    rawGroups.forEach((g, idx) => {
      let groupName = g.name;
      const explicitPeloton = /peloton/i.test(groupName);
      const trailingEmpty = rawGroups.length > 1 && idx === lastIdx && g.riders.length <= 2 && lastSec > 0;
      const isPeloton = explicitPeloton || g.riderCount >= 20 || trailingEmpty;
      if (!groupName) {
        if (isPeloton) groupName = "Peloton";
        else if (idx === 0) groupName = "Tête de course";
        else groupName = `Groupe ${idx + 1}`;
      }

      situationGroups.push({
        name: groupName,
        gap: g.gap,
        riders: g.riders.slice(0, 200),
        riderIds: [],
        riderCount: g.riderCount,
        isPeloton,
        riderBibs: g.bibs.slice(0, 200),
        riderGcGaps: g.gcGaps.slice(0, 200),

      } as any);

      console.log(`[PCS Live] Group "${groupName}": ${g.riderCount} riders, gap=${g.gap}, peloton=${isPeloton}`);
    });

    // ── Stage-race defensive cleanup ──
    if (isStageRace && situationGroups.length > 1) {
      const gapToSeconds = (s: string): number => {
        const m = s.replace(/^\+/, "").match(/^(?:(\d+):)?(\d+):(\d+)$/);
        if (!m) return 0;
        return (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2], 10) * 60) + parseInt(m[3], 10);
      };
      const before = situationGroups.length;
      const cleaned = situationGroups.filter((g) => {
        if (g.isPeloton) return true;
        if (g.riders.length >= 2) return true;
        if (g.riders.length === 1 && gapToSeconds(g.gap) > 600) {
          console.log(`[PCS Live] Stage-race cleanup: drop polluted group "${g.name}" gap=${g.gap}`);
          return false;
        }
        return true;
      });
      situationGroups.length = 0;
      situationGroups.push(...cleaned);
      if (situationGroups.length !== before) {
        console.log(`[PCS Live] Stage-race cleanup: ${before} → ${situationGroups.length} groups`);
      }
    }
  }

  // ── Extract PCS slugs for matching (needed by fallback too) ──
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

  // Fallback: parse from text if no DOM groups found
  // Skipped for stage races — text fallback's regex confuses individual GC gaps with group gaps.
  if (situationGroups.length === 0 && !isStageRace) {
    console.log(`[PCS Live] No .sit-grp found, trying text-based parsing`);

    // Look for "Situation" section in text
    const sitIdx = textContent.indexOf("Situation");
    if (sitIdx >= 0) {
      const sitText = textContent.substring(sitIdx, sitIdx + 8000);
      console.log(`[PCS Live] Situation text (first 500): ${sitText.substring(0, 500)}`);
      
      // Parse groups: pattern is "NUMBER_OR_P GroupName +M:SS"
      // Examples: "1 THE BREAKAWAY +0:00", "P PELOTON +4:50", "2 CHASERS +1:30"
      const groupRx = /(?:^|\s)(\d+|P)\s+((?:THE\s+)?[A-Z][A-Za-zÀ-ÿé\s]+?)\s+\+(\d+:\d+)/g;
      let gm;
      const foundGroups: { name: string; gap: string; index: number; endIndex: number }[] = [];
      
      while ((gm = groupRx.exec(sitText)) !== null) {
        foundGroups.push({
          name: gm[2].trim(),
          gap: `+${gm[3]}`,
          index: gm.index,
          endIndex: gm.index + gm[0].length,
        });
      }

      console.log(`[PCS Live] Found ${foundGroups.length} group markers in text`);

      // For each group, extract riders from the text between this group marker and the next
      for (let i = 0; i < foundGroups.length; i++) {
        const fg = foundGroups[i];
        const isPeloton = fg.name.toLowerCase().includes("peloton");
        const nextGroupStart = i + 1 < foundGroups.length ? foundGroups[i + 1].index : Math.min(fg.endIndex + 3000, sitText.length);
        // Clean trailing single uppercase letters (e.g. "P" from next group marker like "P PELOTON")
        const groupText = sitText.substring(fg.endIndex, nextGroupStart).trim().replace(/\s+[A-Z]\s*$/, '');
        
        const groupRiders: string[] = [];
        const groupBibs: string[] = [];
        const groupGcGaps: string[] = [];
        const groupPcsSlugs: string[] = [];
        
        // Only extract riders for non-peloton groups
        if (!isPeloton && groupText.length > 3) {
          // Pattern: "RANK BIB LASTNAME Firstname" repeated
          // Use lookahead that stops at next "rank bib UPPERCASE" pattern OR end of string
          const riderRx = /(\d{1,2})\s+(\d{1,3})\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ][A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸa-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ \u0027'-]+[a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+)(?=\s+\d{1,2}\s+\d{1,3}\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ]|[^A-Za-z0-9]*$)/g;
          let rm;
          
          while ((rm = riderRx.exec(groupText)) !== null) {
            const rank = rm[1];
            const bib = rm[2];
            let name = rm[3].trim();
            
            // Clean trailing single uppercase letters (next group marker like "P")
            name = name.replace(/\s+[A-Z]$/, '').trim();
            
            const rankNum = parseInt(rank, 10);
            const bibNum = parseInt(bib, 10);
            if (rankNum > 0 && rankNum < 500 && bibNum > 0 && bibNum < 999 && name.length >= 3) {
              groupRiders.push(name);
              groupBibs.push(bib);
              groupGcGaps.push("");
              const slugMatch = pcsSlugs.find(s => {
                const normalizedSlugName = s.name.toLowerCase().replace(/[^a-z]/g, '');
                const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
                return normalizedSlugName === normalizedName || 
                       normalizedSlugName.includes(normalizedName) || 
                       normalizedName.includes(normalizedSlugName);
              });
              groupPcsSlugs.push(slugMatch?.slug || "");
              riders.push({ name, team: "", position: undefined, gap: fg.gap });
            }
          }
          
          // Simpler fallback if primary regex didn't match
          if (groupRiders.length === 0) {
            const simpleRx = /\b(\d{1,2})\s+(\d{1,3})\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ][A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŸ\s \u0027'-]+[a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]+)/g;
            let sm;
            while ((sm = simpleRx.exec(groupText)) !== null) {
              const bib = sm[2];
              let name = sm[3].trim();
              name = name.replace(/\s+[A-Z]$/, '').trim();
              const bibNum = parseInt(bib, 10);
              if (bibNum > 0 && bibNum < 999 && name.length >= 3) {
                groupRiders.push(name);
                groupBibs.push(bib);
                groupGcGaps.push("");
                groupPcsSlugs.push("");
                riders.push({ name, team: "", position: undefined, gap: fg.gap });
              }
            }
          }
        }

        const riderCountFinal = isPeloton ? 150 : groupRiders.length;
        const riderCount = groupRiders.length > 0 ? groupRiders.length : riderCountFinal;
        
        situationGroups.push({
          name: fg.name,
          gap: fg.gap,
          riders: groupRiders.slice(0, 200),
          riderIds: [],
          riderCount,
          isPeloton,
          riderBibs: groupBibs.slice(0, 200),
          riderGcGaps: groupGcGaps.slice(0, 200),

        });
        
        console.log(`[PCS Live] Fallback group "${fg.name}": ${groupRiders.length} riders parsed, gap=${fg.gap}, peloton=${isPeloton}`);
      }
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
// PCS LIVETEXT PARSER — extracts the 6 tracked rider events
// from the live commentary feed (ul > li.event blocks)
// ============================================================

export type LiveTextEventType =
  | "pulling"
  | "position"
  | "back_of_peloton"
  | "crash"
  | "team_car"
  | "abandon";

export interface LiveTextEvent {
  uid: string;
  type: LiveTextEventType;
  rider_name: string;
  rider_slug: string;
  team: string;
  km_to_go: number | null;
  ts: number | null;
  position?: number;
  raw: string;
  coureur_id?: string;
  manager_name?: string;
}

function classifyLiveText(text: string): { type: LiveTextEventType; position?: number } | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (/abandon(ed|s)?\b/i.test(t) || /has left the race/i.test(t)) return { type: "abandon" };
  if (/^crash by\b/i.test(t) || /\bcrash(ed)?\b/i.test(t)) return { type: "crash" };
  if (/at the team car/i.test(t)) return { type: "team_car" };
  if (/at the back of the (peloton|group|bunch)/i.test(t)) return { type: "back_of_peloton" };
  const pos = t.match(/in position\s+(\d+)/i);
  if (pos) return { type: "position", position: Number(pos[1]) };
  if (/\bpulling\b/i.test(t)) return { type: "pulling" };
  return null;
}

function parsePCSLiveText(doc: any): LiveTextEvent[] {
  const out: LiveTextEvent[] = [];
  const items = doc.querySelectorAll("li.event");
  for (const li of items) {
    const uid = li.getAttribute?.("data-uid") || li.getAttribute?.("data-tid") || "";
    if (!uid) continue;

    const textCont = li.querySelector?.("div.textCont");
    if (!textCont) continue;
    const rawText = (textCont.textContent || "").replace(/\s+/g, " ").trim();
    if (!rawText || rawText.length < 5) continue;

    const classified = classifyLiveText(rawText);
    if (!classified) continue;

    // Rider link — team-only events (e.g. "Team X pulling in peloton") are skipped
    const riderLink = textCont.querySelector?.("a[href*='rider/']");
    if (!riderLink) continue;
    const href = riderLink.getAttribute("href") || "";
    const slug = href.match(/rider\/([^/?#]+)/)?.[1] || "";
    const lastName = riderLink.querySelector?.("span")?.textContent?.trim() || "";
    const fullText = (riderLink.textContent || "").replace(/\s+/g, " ").trim();
    const firstName = lastName ? fullText.replace(lastName, "").trim() : "";
    const riderName = firstName ? `${firstName} ${lastName}` : fullText;
    if (!riderName || riderName.length < 3) continue;

    const team = rawText.match(/\(([^)]{2,60})\)/)?.[1]?.trim() || "";

    const bol = li.querySelector?.("div.bol")?.textContent?.trim() || "";
    const kmToGo = /^\d+(\.\d+)?$/.test(bol) ? Number(bol) : null;

    const tsAttr = li.querySelector?.("div.timeago2")?.getAttribute?.("data-ts") || "";
    const ts = /^\d+$/.test(tsAttr) ? Number(tsAttr) : null;

    out.push({
      uid: String(uid),
      type: classified.type,
      position: classified.position,
      rider_name: riderName,
      rider_slug: slug,
      team,
      km_to_go: kmToGo,
      ts,
      raw: rawText.slice(0, 300),
    });
  }

  // Oldest first (PCS lists newest first)
  out.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  console.log(`[PCS Livetext] ${out.length} tracked event(s) parsed`);
  return out;
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
    // --- Auth: superadmin OR cron (service-role + x-cron-secret) ---
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedCronSecret =
      Deno.env.get("CRON_SECRET") ?? Deno.env.get("LIVE_BROADCAST_CRON_SECRET");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;
    const isCron =
      (!!expectedCronSecret && cronSecret === expectedCronSecret) ||
      (!!serviceRoleKey && bearer === serviceRoleKey);

    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isSuperAdmin, error: roleErr } = await userClient.rpc("is_superadmin");
      if (roleErr || !isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    const { url, course_id, is_stage_race } = await req.json();
    if (!url || !course_id) {
      return new Response(JSON.stringify({ error: "url and course_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- URL allowlist (anti-SSRF) ---
    const ALLOWED_HOSTS = ["procyclingstats.com", "firstcycling.com", "lequipe.fr"];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "URL protocol not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const host = parsedUrl.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return new Response(JSON.stringify({ error: "URL not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the page
    console.log(`[scrape-live-race] Fetching ${url}`);
    const resp = await fetchPcs(url);

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
    let liveTextEvents: LiveTextEvent[] = [];

    let liveSituation: any = null;
    const isPCSLive = isPCS && /\/live\b/i.test(url);

    if (isLEquipe) {
      const result = parseLEquipeLive(doc, html);
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
      liveSituation = result.situation;
    } else if (isPCSLive) {
      const result = parsePCSLive(doc, html, { isStageRace: !!is_stage_race });
      scrapedRiders = result.riders;
      scrapedEvents = result.events;
      liveSituation = result.situation;
      liveTextEvents = parsePCSLiveText(doc);
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
          riders: riderNames.slice(0, 200),
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
