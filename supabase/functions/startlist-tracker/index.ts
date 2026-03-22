import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// NORMALIZATION (robust, shared with startlist-import)
// ============================================================

const CHAR_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
  'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y', 'ß': 'ss', 'œ': 'oe',
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
  'Ç': 'C', 'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
  'Ñ': 'N', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
  'Ý': 'Y', 'Ÿ': 'Y', 'Œ': 'OE'
};

const PARTICLES = ['VAN', 'VAN DER', 'VAN DEN', 'VAN DE', 'DE', 'DI', 'DA', 'DEL', 'DELLA', 'VON', 'LE', 'LA'];

function normalize(s: string): string {
  if (!s) return '';
  let result = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  result = result.split('').map(c => CHAR_MAP[c] || c).join('');
  result = result.replace(/['']/g, "'").replace(/[.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return result.toUpperCase();
}

function tokenSig(s: string): string {
  return normalize(s).split(/\s+/).filter(t => t.length > 0).sort().join(' ');
}

function extractLastName(s: string): string {
  const norm = normalize(s);
  const tokens = norm.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return '';
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!PARTICLES.includes(tokens[i])) return tokens[i];
  }
  return tokens[tokens.length - 1];
}

function levenshtein(a: string, b: string): number {
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const matrix: number[][] = [];
  for (let i = 0; i <= n; i++) matrix[i] = [i];
  for (let j = 0; j <= m; j++) matrix[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[n][m];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - (levenshtein(a, b) / maxLen);
}

function canonizeName(raw: string): string {
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 2) return raw;
  const firstToken = tokens[0];
  const isFirstAllCaps = firstToken === firstToken.toUpperCase() && firstToken.length > 1;
  if (isFirstAllCaps) {
    let lastNameEndIdx = 0;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if ((tok === tok.toUpperCase() && tok.length > 1) || PARTICLES.includes(tok)) {
        lastNameEndIdx = i;
      } else {
        break;
      }
    }
    const lastName = tokens.slice(0, lastNameEndIdx + 1).join(' ');
    const firstName = tokens.slice(lastNameEndIdx + 1).join(' ');
    if (firstName && lastName) return `${firstName} ${lastName}`;
  }
  return raw;
}

// ============================================================
// INTERFACES
// ============================================================

interface DbCourse {
  id: string;
  nom: string;
  pcs_slug: string | null;
  date_debut: string;
}

interface RiderRef {
  id: string;
  nom: string;
  equipe: string | null;
}

interface AliasRef {
  alias_text: string;
  coureur_id: string;
  source_team: string | null;
}

interface MatchResult {
  coureur_id: string | null;
  confidence: number;
  status: 'confirmed' | 'unmatched';
  match_type?: string;
  on_roster?: boolean;
}

// Maximum courses to process per run to avoid timeout (150s limit)
const MAX_COURSES_PER_RUN = 3;
// Re-check interval: don't re-scrape a course checked less than 6h ago
const RECHECK_INTERVAL_HOURS = 6;
// Urgent re-check interval for courses starting within 7 days (30 min)
const RECHECK_INTERVAL_MINUTES_URGENT = 30;
// Number of days ahead to consider a course "urgent"
const URGENT_HORIZON_DAYS = 7;

/** Returns true if the course starts within the next URGENT_HORIZON_DAYS days */
function isUrgentCourse(dateDebut: string | null, now: Date): boolean {
  if (!dateDebut) return false;
  const start = new Date(dateDebut + "T00:00:00Z");
  const horizonMs = URGENT_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  return start.getTime() - now.getTime() <= horizonMs;
}

/** Returns true if the course needs re-checking based on its proximity */
function needsRecheck(course: { date_debut: string | null; last_tracker_check: string | null }, now: Date): boolean {
  if (!course.last_tracker_check) return true;
  const lastCheck = new Date(course.last_tracker_check);
  const elapsed = now.getTime() - lastCheck.getTime();
  if (isUrgentCourse(course.date_debut, now)) {
    return elapsed >= RECHECK_INTERVAL_MINUTES_URGENT * 60 * 1000;
  }
  return elapsed >= RECHECK_INTERVAL_HOURS * 60 * 60 * 1000;
}

// ============================================================
// MATCHING (same multi-strategy as startlist-import)
// ============================================================

function matchRider(
  scraped_name: string,
  rosterRiders: RiderRef[],
  allRiders: RiderRef[],
  aliases: AliasRef[]
): MatchResult {
  const canonical = canonizeName(scraped_name);
  const entryNorm = normalize(canonical);
  const sourceNorm = normalize(scraped_name);
  const entrySig = tokenSig(canonical);
  const sourceSig = tokenSig(scraped_name);

  // 1) Alias (highest priority)
  for (const alias of aliases) {
    const aliasNorm = normalize(alias.alias_text);
    const aliasSig = tokenSig(alias.alias_text);
    if (aliasNorm === sourceNorm || aliasNorm === entryNorm || aliasSig === sourceSig || aliasSig === entrySig) {
      const isOnRoster = rosterRiders.some(r => r.id === alias.coureur_id);
      return { coureur_id: alias.coureur_id, confidence: 1.0, status: 'confirmed', match_type: 'alias', on_roster: isOnRoster };
    }
  }

  // 2) Exact normalized (roster)
  for (const rider of rosterRiders) {
    if (normalize(rider.nom) === entryNorm || normalize(rider.nom) === sourceNorm) {
      return { coureur_id: rider.id, confidence: 1.0, status: 'confirmed', match_type: 'exact', on_roster: true };
    }
  }

  // 3) Token signature (roster)
  for (const rider of rosterRiders) {
    const riderSig = tokenSig(rider.nom);
    if (riderSig === entrySig || riderSig === sourceSig) {
      return { coureur_id: rider.id, confidence: 0.95, status: 'confirmed', match_type: 'tokens', on_roster: true };
    }
  }

  // 4) Fuzzy Levenshtein (roster, >= 0.90)
  let best = { id: null as string | null, score: 0 };
  for (const rider of rosterRiders) {
    const score = Math.max(similarity(entryNorm, normalize(rider.nom)), similarity(sourceNorm, normalize(rider.nom)));
    if (score > best.score) best = { id: rider.id, score };
  }
  if (best.id && best.score >= 0.90) {
    return { coureur_id: best.id, confidence: best.score, status: 'confirmed', match_type: 'fuzzy_roster', on_roster: true };
  }

  // 5) Off-roster: exact
  for (const rider of allRiders) {
    const riderNorm = normalize(rider.nom);
    if (riderNorm === entryNorm || riderNorm === sourceNorm) {
      return { coureur_id: rider.id, confidence: 1.0, status: 'confirmed', match_type: 'exact_off_roster', on_roster: false };
    }
  }

  // 5b) Off-roster: token sig
  for (const rider of allRiders) {
    const riderSig = tokenSig(rider.nom);
    if (riderSig === entrySig || riderSig === sourceSig) {
      return { coureur_id: rider.id, confidence: 0.95, status: 'confirmed', match_type: 'tokens_off_roster', on_roster: false };
    }
  }

  // 5c) Off-roster: fuzzy (>= 0.90)
  let bestOff = { id: null as string | null, score: 0 };
  for (const rider of allRiders) {
    const riderNorm = normalize(rider.nom);
    const score = Math.max(similarity(entryNorm, riderNorm), similarity(sourceNorm, riderNorm));
    if (score > bestOff.score) bestOff = { id: rider.id, score };
  }
  if (bestOff.id && bestOff.score >= 0.90) {
    return { coureur_id: bestOff.id, confidence: bestOff.score, status: 'confirmed', match_type: 'fuzzy_off_roster', on_roster: false };
  }

  return { coureur_id: null, confidence: 0, status: 'unmatched' };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { source_type = "global", race_url } = await req.json().catch(() => ({}));

    // Handle list_courses separately (no run record needed)
    if (source_type === "list_courses") {
      const now = new Date();
      const twelveWeeksLater = new Date(now);
      twelveWeeksLater.setDate(twelveWeeksLater.getDate() + 84);
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, nom, pcs_slug, date_debut, last_tracker_check")
        .gte("date_debut", threeDaysAgo.toISOString().split("T")[0])
        .lte("date_debut", twelveWeeksLater.toISOString().split("T")[0])
        .order("date_debut", { ascending: true });

      const coursesList = (allCourses || []).map((c: any) => {
        const url = buildPcsStartlistUrl(c);
        return {
          id: c.id,
          nom: c.nom,
          pcs_slug: c.pcs_slug,
          date_debut: c.date_debut,
          last_tracker_check: c.last_tracker_check,
          derived_url: url,
        };
      });

      return new Response(
        JSON.stringify({ success: true, courses: coursesList }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a run record
    const { data: run, error: runError } = await supabase
      .from("startlist_tracker_runs")
      .insert({ source_type, status: "running" })
      .select()
      .single();

    if (runError) throw runError;
    const runId = run.id;

    try {
      let totalAdded = 0;
      let totalRemoved = 0;
      let racesAnalyzed = 0;
      let racesMatched = 0;
      let coursesProcessed: string[] = [];

      let scrapeErrors: { course_id: string; course_name: string; url_tried: string; error: string }[] = [];

      if (source_type === "global") {
        const result = await handleGlobalSync(supabase);
        totalAdded = result.totalAdded;
        totalRemoved = result.totalRemoved;
        racesAnalyzed = result.racesAnalyzed;
        racesMatched = result.racesMatched;
        coursesProcessed = result.coursesProcessed;
        scrapeErrors = result.scrapeErrors || [];
      } else if (source_type === "race" && race_url) {
        racesAnalyzed = 1;
        const scrapedRiders = await scrapeRaceStartlist(race_url);
        if (scrapedRiders.length > 0) {
          racesMatched = 1;
          const courseSlug = extractPcsRaceSlug(race_url);
          if (courseSlug) {
            const { data: course } = await supabase
              .from("courses")
              .select("id, nom, date_debut, pcs_slug, phase_id")
              .or(`pcs_slug.eq.${courseSlug},id.ilike.%${courseSlug}%`)
              .limit(1)
              .maybeSingle();
            if (course) {
              const result = await syncCourseStartlist(supabase, course, scrapedRiders);
              totalAdded = result.added;
              totalRemoved = result.removed;
              coursesProcessed = [course.nom];
            }
          }
        }
      }

      const changesTotal = totalAdded + totalRemoved;

      // Update run as completed
      await supabase
        .from("startlist_tracker_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          changes_detected: changesTotal,
          changes_processed: changesTotal,
          courses_processed: coursesProcessed,
          scrape_errors: scrapeErrors,
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          success: true,
          run_id: runId,
          races_analyzed: racesAnalyzed,
          races_matched: racesMatched,
          changes_detected: changesTotal,
          changes_processed: changesTotal,
          added: totalAdded,
          removed: totalRemoved,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      await supabase
        .from("startlist_tracker_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", runId);
      throw error;
    }
  } catch (error) {
    console.error("Startlist tracker error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// GLOBAL SYNC: DB-BASED APPROACH
// ============================================================

async function handleGlobalSync(supabase: any): Promise<{
  totalAdded: number;
  totalRemoved: number;
  racesAnalyzed: number;
  racesMatched: number;
  coursesProcessed: string[];
  scrapeErrors: { course_id: string; course_name: string; url_tried: string; error: string }[];
}> {
  const now = new Date();
  const twelveWeeksLater = new Date(now);
  twelveWeeksLater.setDate(twelveWeeksLater.getDate() + 84);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  console.log(`Global sync: looking for courses from ${threeDaysAgo.toISOString().split("T")[0]} to ${twelveWeeksLater.toISOString().split("T")[0]}`);

  // Fetch race IDs that have a validated startlist to exclude
  const { data: validatedImports } = await supabase
    .from("startlist_imports")
    .select("race_id")
    .eq("pcs_validated", true);

  const validatedRaceIds = new Set((validatedImports || []).map((si: any) => si.race_id));
  console.log(`Excluding ${validatedRaceIds.size} courses with validated startlists`);

  const today = now.toISOString().split("T")[0];

  // Fetch ALL eligible courses without recheck filter — adaptive filtering applied in JS
  const { data: allCourses, error: coursesError } = await supabase
    .from("courses")
    .select("id, nom, pcs_slug, date_debut, date_fin, last_tracker_check, phase_id")
    .gte("date_debut", threeDaysAgo.toISOString().split("T")[0])
    .lte("date_debut", twelveWeeksLater.toISOString().split("T")[0])
    .order("last_tracker_check", { ascending: true, nullsFirst: true })
    .limit(200);

  if (coursesError) throw coursesError;

  // Apply adaptive recheck filter + exclusions in JS
  const URGENT_SLOTS = 2;
  const STANDARD_SLOTS = 1;

  const byOldestCheck = (a: any, b: any) => {
    if (!a.last_tracker_check && b.last_tracker_check) return -1;
    if (a.last_tracker_check && !b.last_tracker_check) return 1;
    if (!a.last_tracker_check && !b.last_tracker_check) return 0;
    return new Date(a.last_tracker_check).getTime() - new Date(b.last_tracker_check).getTime();
  };

  const eligible = (allCourses || [])
    .filter((c: any) => !validatedRaceIds.has(c.id))
    .filter((c: any) => {
      const endDate = c.date_fin || c.date_debut;
      return endDate >= today;
    })
    .filter((c: any) => needsRecheck(c, now));

  // Split into two pools with dedicated slots
  const urgentPool = eligible.filter((c: any) => isUrgentCourse(c.date_debut, now)).sort(byOldestCheck);
  const standardPool = eligible.filter((c: any) => !isUrgentCourse(c.date_debut, now)).sort(byOldestCheck);

  // Fill slots with redistribution if a pool is short
  let urgentPick = urgentPool.slice(0, URGENT_SLOTS);
  let standardPick = standardPool.slice(0, STANDARD_SLOTS);

  const urgentVacant = URGENT_SLOTS - urgentPick.length;
  const standardVacant = STANDARD_SLOTS - standardPick.length;

  if (standardVacant > 0) {
    urgentPick = urgentPool.slice(0, URGENT_SLOTS + standardVacant);
  }
  if (urgentVacant > 0) {
    standardPick = standardPool.slice(0, STANDARD_SLOTS + urgentVacant);
  }

  const courses = [...urgentPick, ...standardPick];

  console.log(`Slot distribution: ${urgentPick.length}/${URGENT_SLOTS} urgent, ${standardPick.length}/${STANDARD_SLOTS} standard (pools: ${urgentPool.length} urgent eligible, ${standardPool.length} standard eligible)`);

  if (!courses || courses.length === 0) {
    console.log("No courses need checking right now");
    return { totalAdded: 0, totalRemoved: 0, racesAnalyzed: 0, racesMatched: 0, coursesProcessed: [], scrapeErrors: [] };
  }

  console.log(`Found ${courses.length} courses to check:`);
  courses.forEach((c: any, i: number) => {
    const urgent = isUrgentCourse(c.date_debut, now);
    console.log(`  ${i + 1}. ${urgent ? "⚡" : "◻️"} ${c.nom} (${c.id}) - last check: ${c.last_tracker_check || "never"}${urgent ? " [URGENT – 30min interval]" : ""}`);
  });

  let totalAdded = 0;
  let totalRemoved = 0;
  let racesMatched = 0;
  const coursesProcessed: string[] = [];
  const scrapeErrors: { course_id: string; course_name: string; url_tried: string; error: string }[] = [];

  for (const course of courses) {
    const pcsUrl = buildPcsStartlistUrl(course);
    if (!pcsUrl) {
      console.log(`Could not build PCS URL for "${course.nom}" (${course.id}), skipping`);
      scrapeErrors.push({ course_id: course.id, course_name: course.nom, url_tried: "", error: "Impossible de construire l'URL PCS (pas de pcs_slug)" });
      await markCourseChecked(supabase, course.id);
      continue;
    }

    console.log(`\n--- Processing: ${course.nom} ---`);
    console.log(`PCS URL: ${pcsUrl}`);

    try {
      const scrapedRiders = await scrapeRaceStartlist(pcsUrl);
      
      if (scrapedRiders.length === 0) {
        console.log(`No riders found for ${course.nom}, startlist may not be published yet`);
        scrapeErrors.push({ course_id: course.id, course_name: course.nom, url_tried: pcsUrl, error: "0 coureurs trouvés (startlist pas encore publiée ou URL incorrecte)" });
        await markCourseChecked(supabase, course.id);
        continue;
      }

      racesMatched++;
      coursesProcessed.push(course.nom);

      const result = await syncCourseStartlist(supabase, course, scrapedRiders);
      totalAdded += result.added;
      totalRemoved += result.removed;

      await markCourseChecked(supabase, course.id);
    } catch (raceError) {
      console.error(`Error processing ${course.nom}:`, raceError);
      scrapeErrors.push({ course_id: course.id, course_name: course.nom, url_tried: pcsUrl, error: raceError instanceof Error ? raceError.message : "Erreur inconnue" });
      await markCourseChecked(supabase, course.id);
    }
  }

  console.log(`\nGlobal sync complete: ${courses.length} analyzed, ${racesMatched} matched, ${totalAdded} added, ${totalRemoved} removed`);

  return { totalAdded, totalRemoved, racesAnalyzed: courses.length, racesMatched, coursesProcessed, scrapeErrors };
}

// ============================================================
// CORE: SYNC A SINGLE COURSE (direct approach)
// ============================================================

/**
 * Compare PCS scraped riders with existing startlist_entries.
 * - Present in both → do nothing
 * - On PCS but not in DB → ADD (with full matching)
 * - In DB but not on PCS → REMOVE
 * Actions are performed directly on startlist_entries.
 */
async function syncCourseStartlist(
  supabase: any,
  course: any,
  scrapedRiders: { rider_name: string; team_name: string; team_confirmed: boolean }[]
): Promise<{ added: number; removed: number }> {
  const courseId = course.id;
  const courseName = course.nom;
  const phaseId = course.phase_id;

  console.log(`[SYNC] ${courseName}: ${scrapedRiders.length} riders scraped from PCS`);

  // 1. Find or create startlist import
  let startlistId: string;
  const { data: imports } = await supabase
    .from("startlist_imports")
    .select("id")
    .eq("race_id", courseId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!imports || imports.length === 0) {
    // Need saison_id to create import
    const { data: currentSeason } = await supabase
      .from("saisons")
      .select("id")
      .eq("annee", new Date().getFullYear())
      .maybeSingle();

    const { data: newImport, error: importError } = await supabase
      .from("startlist_imports")
      .insert({
        race_id: courseId,
        file_url: `https://www.procyclingstats.com/race/${course.pcs_slug || courseId}`,
        saison_id: currentSeason?.id,
      })
      .select("id")
      .single();

    if (importError) {
      console.error(`Failed to create startlist import: ${importError.message}`);
      return { added: 0, removed: 0 };
    }
    startlistId = newImport.id;
    console.log(`[SYNC] Created new startlist import ${startlistId}`);
  } else {
    startlistId = imports[0].id;
  }

  // 2. Load existing entries with their coureur names
  const { data: existingEntries, error: entriesError } = await supabase
    .from("startlist_entries")
    .select("id, source_name, coureur_id, coureurs(nom)")
    .eq("startlist_id", startlistId);

  if (entriesError) {
    console.error(`Failed to load existing entries: ${entriesError.message}`);
    return { added: 0, removed: 0 };
  }

  const existing = existingEntries || [];
  console.log(`[SYNC] ${existing.length} existing entries in DB`);

  // 3. Build tokenSig sets for comparison
  // For scraped riders: tokenSig of their PCS name
  const scrapedSigSet = new Set<string>();
  const scrapedByKey = new Map<string, { rider_name: string; team_name: string; team_confirmed: boolean }>();
  for (const r of scrapedRiders) {
    const sig = tokenSig(r.rider_name);
    scrapedSigSet.add(sig);
    if (!scrapedByKey.has(sig)) {
      scrapedByKey.set(sig, r);
    }
  }

  // For existing entries: tokenSig of source_name AND coureur.nom
  // Map from tokenSig -> entry (deduplicated)
  const existingSigMap = new Map<string, { id: string; source_name: string; coureur_id: string | null }>();
  const existingEntryIds = new Set<string>(); // track which entries are covered
  for (const entry of existing) {
    const sourceSig = tokenSig(entry.source_name || "");
    const coureurNom = (entry.coureurs as any)?.nom || "";
    const coureurSig = coureurNom ? tokenSig(coureurNom) : "";

    // Register by source_name sig
    if (sourceSig && !existingSigMap.has(sourceSig)) {
      existingSigMap.set(sourceSig, { id: entry.id, source_name: entry.source_name, coureur_id: entry.coureur_id });
      existingEntryIds.add(entry.id);
    }
    // Also register by coureur nom sig (if different)
    if (coureurSig && coureurSig !== sourceSig && !existingSigMap.has(coureurSig)) {
      existingSigMap.set(coureurSig, { id: entry.id, source_name: entry.source_name, coureur_id: entry.coureur_id });
      existingEntryIds.add(entry.id);
    }
  }

  // 4. Determine additions and removals
  const toAdd: { rider_name: string; team_name: string }[] = [];
  const toRemoveEntryIds: { id: string; source_name: string; coureur_id: string | null }[] = [];

  // Additions: scraped riders whose tokenSig is NOT in existing map
  for (const [sig, rider] of scrapedByKey) {
    if (!existingSigMap.has(sig)) {
      toAdd.push(rider);
    }
  }

  // Removals: existing entries whose tokenSig is NOT in scraped set
  // Use a set to avoid removing the same entry twice (when both source and coureur sigs point to same entry)
  const removedIds = new Set<string>();
  for (const [sig, entry] of existingSigMap) {
    if (!scrapedSigSet.has(sig) && !removedIds.has(entry.id)) {
      // Double-check: make sure no OTHER sig for this entry is in the scraped set
      const otherSigsCovered = [...existingSigMap.entries()]
        .filter(([, e]) => e.id === entry.id)
        .some(([s]) => scrapedSigSet.has(s));
      
      if (!otherSigsCovered) {
        toRemoveEntryIds.push({ id: entry.id, source_name: entry.source_name, coureur_id: entry.coureur_id });
        removedIds.add(entry.id);
      }
    }
  }

  // Safety check: if we'd remove more than 50% of entries, skip removals
  const removalThreshold = 0.5;
  const shouldProcessRemovals = scrapedRiders.length >= existing.length * removalThreshold;

  if (!shouldProcessRemovals && toRemoveEntryIds.length > 0) {
    console.warn(`[SYNC] SAFETY: Scraped ${scrapedRiders.length} riders vs ${existing.length} existing (< ${removalThreshold * 100}%). Skipping ${toRemoveEntryIds.length} removals.`);
    toRemoveEntryIds.length = 0;
  }

  console.log(`[SYNC] ${toAdd.length} additions, ${toRemoveEntryIds.length} removals`);

  if (toAdd.length === 0 && toRemoveEntryIds.length === 0) {
    console.log(`[SYNC] No changes for ${courseName}`);
    return { added: 0, removed: 0 };
  }

  // 5. Load matching data (once per course, only if needed for additions)
  let rosterRiders: RiderRef[] = [];
  let allRiders: RiderRef[] = [];
  let aliases: AliasRef[] = [];

  if (toAdd.length > 0) {
    // Load roster for this course's phase
    if (phaseId) {
      const { data: rostersData } = await supabase
        .from("rosters")
        .select("coureur_id")
        .eq("phase_id", phaseId);

      const rosterIds = [...new Set((rostersData || []).map((r: any) => r.coureur_id))];

      if (rosterIds.length > 0) {
        // Get phase's saison_id
        const { data: phaseData } = await supabase
          .from("phases")
          .select("saison_id")
          .eq("id", phaseId)
          .single();

        const saisonId = phaseData?.saison_id;

        if (saisonId) {
          const { data: csData } = await supabase
            .from("coureurs_saisons")
            .select("coureur_id, coureurs!inner(id, nom), equipe_id")
            .eq("saison_id", saisonId)
            .in("coureur_id", rosterIds);

          const equipeIds = [...new Set((csData || []).map((cs: any) => cs.equipe_id).filter(Boolean))];
          let equipeMap: Record<string, string> = {};
          if (equipeIds.length > 0) {
            const { data: equipesData } = await supabase
              .from("equipes_saisons")
              .select("id, nom_affiche")
              .in("id", equipeIds);
            equipeMap = (equipesData || []).reduce((acc: Record<string, string>, eq: any) => {
              acc[eq.id] = eq.nom_affiche || "";
              return acc;
            }, {});
          }

          rosterRiders = (csData || []).map((cs: any) => {
            const coureur = Array.isArray(cs.coureurs) ? cs.coureurs[0] : cs.coureurs;
            return {
              id: coureur?.id || cs.coureur_id,
              nom: coureur?.nom || "",
              equipe: cs.equipe_id ? (equipeMap[cs.equipe_id] || "") : "",
            };
          });
        }
      }
    }

    // Load all riders
    const { data: allRidersData } = await supabase
      .from("coureurs")
      .select("id, nom, equipe")
      .limit(5000);
    allRiders = (allRidersData || []).map((r: any) => ({ id: r.id, nom: r.nom, equipe: r.equipe }));

    // Load aliases
    const { data: aliasesData } = await supabase
      .from("name_aliases")
      .select("alias_text, coureur_id, source_team");
    aliases = (aliasesData || []).map((a: any) => ({ alias_text: a.alias_text, coureur_id: a.coureur_id, source_team: a.source_team }));

    console.log(`[SYNC] Loaded matching data: ${rosterRiders.length} roster, ${allRiders.length} all riders, ${aliases.length} aliases`);
  }

  // 6. Process REMOVALS first (delete from startlist_entries)
  let removedCount = 0;
  for (const entry of toRemoveEntryIds) {
    // Manual cascade: delete from startlist_tracker_changes first
    await supabase
      .from("startlist_tracker_changes")
      .delete()
      .eq("startlist_entry_id", entry.id);

    const { error: deleteError } = await supabase
      .from("startlist_entries")
      .delete()
      .eq("id", entry.id);

    if (deleteError) {
      console.error(`[SYNC] Failed to remove entry ${entry.id} (${entry.source_name}): ${deleteError.message}`);
    } else {
      console.log(`[SYNC] Removed: ${entry.source_name}`);
      removedCount++;

      // Log in audit table
      await supabase.from("startlist_tracker_changes").insert({
        course_id: courseId,
        course_name: courseName,
        rider_name: entry.source_name,
        team_name: null,
        change_type: "removed",
        coureur_id: entry.coureur_id,
        source_url: `https://www.procyclingstats.com/race/${course.pcs_slug || courseId}`,
        detected_at: new Date().toISOString(),
        processed: true,
        processed_at: new Date().toISOString(),
        validation_status: "validated",
      });
    }
  }

  // 7. Process ADDITIONS (match + insert into startlist_entries)
  let addedCount = 0;

  // Get current max line_no
  const { data: maxLineData } = await supabase
    .from("startlist_entries")
    .select("line_no")
    .eq("startlist_id", startlistId)
    .order("line_no", { ascending: false })
    .limit(1);
  let nextLineNo = (maxLineData?.[0]?.line_no || 0) + 1;

  for (const rider of toAdd) {
    const match = matchRider(rider.rider_name, rosterRiders, allRiders, aliases);
    
    // Check if this coureur_id already exists in the startlist (prevent duplicates)
    if (match.coureur_id) {
      const alreadyExists = existing.some(e => e.coureur_id === match.coureur_id);
      if (alreadyExists) {
        console.log(`[SYNC] Skipping ${rider.rider_name}: coureur_id ${match.coureur_id} already in startlist`);
        continue;
      }
    }

    const { data: insertedEntry, error: entryError } = await supabase
      .from("startlist_entries")
      .insert({
        startlist_id: startlistId,
        line_no: nextLineNo,
        source_name: rider.rider_name,
        source_team: rider.team_name || null,
        coureur_id: match.coureur_id,
        confidence: match.confidence || null,
        status: match.status,
      })
      .select("id")
      .single();

    if (entryError) {
      console.error(`[SYNC] Failed to add ${rider.rider_name}: ${entryError.message}`);
    } else {
      const matchInfo = match.coureur_id ? ` → ${match.match_type} (${match.confidence})` : " → unmatched";
      console.log(`[SYNC] Added: ${rider.rider_name}${matchInfo}`);
      addedCount++;
      nextLineNo++;

      // Log in audit table
      await supabase.from("startlist_tracker_changes").insert({
        course_id: courseId,
        course_name: courseName,
        rider_name: rider.rider_name,
        team_name: rider.team_name || null,
        change_type: "added",
        source_url: `https://www.procyclingstats.com/race/${course.pcs_slug || courseId}`,
        detected_at: new Date().toISOString(),
        processed: true,
        processed_at: new Date().toISOString(),
        validation_status: match.coureur_id ? "validated" : "unmatched",
        coureur_id: match.coureur_id,
        startlist_entry_id: insertedEntry?.id || null,
      });
    }
  }

  console.log(`[SYNC] ${courseName} done: ${addedCount} added, ${removedCount} removed`);
  return { added: addedCount, removed: removedCount };
}

// ============================================================
// PCS URL BUILDING
// ============================================================

function buildPcsStartlistUrl(course: DbCourse): string | null {
  const year = course.date_debut ? new Date(course.date_debut).getFullYear() : new Date().getFullYear();
  if (course.pcs_slug) {
    return `https://www.procyclingstats.com/race/${course.pcs_slug}/${year}/startlist`;
  }
  const slug = derivePcsSlug(course.id);
  if (slug) {
    return `https://www.procyclingstats.com/race/${slug}/${year}/startlist`;
  }
  return null;
}

function derivePcsSlug(courseId: string): string | null {
  const KNOWN_MAPPINGS: Record<string, string> = {
    "omloop-nieuwsblad": "omloop-het-nieuwsblad",
    "strade-bianche": "strade-bianche",
    "paris-nice": "paris-nice",
    "tirreno-adriatico": "tirreno-adriatico",
    "clasica_de_almeria": "clasica-de-almeria",
    "vuelta_a_andalucia_ruta_ciclista_del_sol": "vuelta-a-andalucia",
    "volta_ao_algarve_em_bicicleta": "volta-ao-algarve",
    "tour_de_la_provence": "tour-cycliste-international-la-provence",
    "kuurne_brussel_kuurne": "kuurne-brussel-kuurne",
    "faun_ard_che_classic": "faun-ardeche-classic",
    "faun_drome_classic": "faun-drome-classic",
    "classic_var": "classic-var",
    "tour_des_alpes_maritimes": "tour-des-alpes-maritimes-et-du-var",
    "tour_du_rwanda": "tour-du-rwanda",
    "giro_di_sardegna": "giro-di-sardegna",
    "danilith_nokere_koerse": "nokere-koerse",
    "milano_torino": "milano-torino",
    "grand_prix_de_denain_porte_du_hainaut": "grand-prix-de-denain",
    "bredene_koksijde_classic": "bredene-koksijde-classic",
    "trofeo_laigueglia": "trofeo-laigueglia",
    "ename_samyn_classic": "le-samyn",
    "figueira_champions_classic": "figueira-champions-classic",
    "cl_sica_ja_n": "clasica-jaen",
    "vuelta_a_la_regi_n_de_murcia_costa_c_lida": "vuelta-a-murcia",
    "visit_south_aegean_gp": "rhodes-gp",
    "region_on_dodecanese_gp": "rhodes-gp",
    "tour_de_taiwan": "tour-de-taiwan",
  };

  const cleanId = courseId.replace(/-[a-z0-9]{6,10}$/, "");
  if (KNOWN_MAPPINGS[cleanId]) return KNOWN_MAPPINGS[cleanId];
  if (KNOWN_MAPPINGS[courseId]) return KNOWN_MAPPINGS[courseId];

  const slug = cleanId.replace(/_/g, "-");
  if (slug.includes("continental-") || slug.includes("championships")) {
    console.log(`Skipping continental/championship race: ${courseId}`);
    return null;
  }
  return slug;
}

async function markCourseChecked(supabase: any, courseId: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({ last_tracker_check: new Date().toISOString() })
    .eq("id", courseId);
  if (error) {
    console.error(`Failed to update last_tracker_check for ${courseId}: ${error.message}`);
  }
}

// ============================================================
// HTML PARSING & SCRAPING
// ============================================================

function parseStartlistHtml(html: string): { rider_name: string; team_name: string; team_confirmed: boolean }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    console.error("parseStartlistHtml: Failed to parse HTML");
    return [];
  }

  const title = doc.querySelector("title")?.textContent || "unknown";
  console.log(`Page title: "${title}"`);

  const startlist = doc.querySelector(".startlist_v4");
  if (!startlist) {
    console.warn("parseStartlistHtml: No .startlist_v4 found");
    console.log(`HTML preview: ${html.substring(0, 500)}`);
    const allPageLinks = doc.querySelectorAll("a");
    const riders: { rider_name: string; team_name: string; team_confirmed: boolean }[] = [];
    for (const link of allPageLinks) {
      const href = link.getAttribute("href") || "";
      if (!href.includes("rider/")) continue;
      const name = link.textContent?.trim() || "";
      if (name.length > 2) {
        riders.push({ rider_name: name, team_name: "Unknown", team_confirmed: false });
      }
    }
    console.log(`parseStartlistHtml fallback: extracted ${riders.length} riders`);
    return riders;
  }

  const riders: { rider_name: string; team_name: string; team_confirmed: boolean }[] = [];
  
  // Iterate over team blocks (li children of startlist_v4)
  const teamBlocks = startlist.querySelectorAll(":scope > li");
  let teamCount = 0;

  for (const teamBlock of teamBlocks) {
    // Detect team confirmation: <span class="confirmed ok"> means confirmed
    const confirmedSpan = teamBlock.querySelector("span.confirmed");
    const isConfirmed = confirmedSpan ? confirmedSpan.getAttribute("class")?.includes("ok") === true : false;

    // Get team name from team link
    const teamLink = teamBlock.querySelector("a.team");
    const teamName = teamLink?.textContent?.trim() || "Unknown Team";
    teamCount++;

    // Get riders from this team block
    const riderLinks = teamBlock.querySelectorAll("ul li a[href*='rider/']");
    for (const riderLink of riderLinks) {
      const riderName = riderLink.textContent?.trim() || "";
      if (riderName.length > 2) {
        riders.push({ rider_name: riderName, team_name: teamName, team_confirmed: isConfirmed });
      }
    }
  }

  // Fallback: if no team blocks found, try the old link-based approach
  if (riders.length === 0) {
    const allLinks = startlist.querySelectorAll("a");
    let currentTeam = "Unknown Team";

    for (const link of allLinks) {
      const href = link.getAttribute("href") || "";
      const className = link.getAttribute("class") || "";
      if (className.includes("team") && !className.includes("team-in-race")) {
        currentTeam = link.textContent?.trim() || "Unknown Team";
        teamCount++;
      } else if (href.includes("rider/") && !href.includes("team-in-race")) {
        const riderName = link.textContent?.trim() || "";
        if (riderName.length > 2) {
          riders.push({ rider_name: riderName, team_name: currentTeam, team_confirmed: false });
        }
      }
    }
  }

  const confirmedCount = new Set(riders.filter(r => r.team_confirmed).map(r => r.team_name)).size;
  console.log(`parseStartlistHtml: extracted ${riders.length} riders from ${teamCount} teams (${confirmedCount} confirmed)`);
  if (riders.length > 0) {
    console.log(`Sample: ${riders.slice(0, 3).map(r => `${r.rider_name} (${r.team_name}) ${r.team_confirmed ? '✓' : ''}`).join(", ")}`);
  }
  return riders;
}

function extractPcsRaceSlug(raceUrl: string): string | null {
  try {
    const url = new URL(raceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const raceIdx = parts.indexOf("race");
    if (raceIdx >= 0 && parts[raceIdx + 1]) return parts[raceIdx + 1];
    return parts[parts.length - 3] || parts[parts.length - 2] || null;
  } catch {
    return null;
  }
}

async function scrapeRaceStartlist(raceUrl: string): Promise<{ rider_name: string; team_name: string }[]> {
  const response = await fetch(raceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch race page: ${response.status} for ${raceUrl}`);
  }

  const html = await response.text();
  console.log(`Fetched race HTML: ${html.length} characters`);

  const parsedRiders = parseStartlistHtml(html);
  console.log(`Parsed ${parsedRiders.length} riders`);

  if (parsedRiders.length > 0) {
    console.log(`Sample riders: ${parsedRiders.slice(0, 5).map(r => r.rider_name).join(", ")}...`);
  }

  if (parsedRiders.length < 20 && parsedRiders.length > 0) {
    console.warn(`WARNING: Only ${parsedRiders.length} riders extracted - this seems incomplete!`);
  }

  return parsedRiders;
}
