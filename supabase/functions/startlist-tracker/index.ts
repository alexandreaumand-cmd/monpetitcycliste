import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StartlistChange {
  course_id: string;
  course_name: string;
  rider_name: string;
  team_name: string | null;
  change_type: "added" | "removed";
  source_url: string;
}

interface DbCourse {
  id: string;
  nom: string;
  pcs_slug: string | null;
  date_debut: string;
}

// Maximum courses to process per run to avoid timeout (150s limit)
const MAX_COURSES_PER_RUN = 3;
// Re-check interval: don't re-scrape a course checked less than 6h ago
const RECHECK_INTERVAL_HOURS = 6;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { source_type = "global", race_url } = await req.json().catch(() => ({}));

    // Create a run record
    const { data: run, error: runError } = await supabase
      .from("startlist_tracker_runs")
      .insert({ source_type, status: "running" })
      .select()
      .single();

    if (runError) throw runError;
    const runId = run.id;

    try {
      let changes: StartlistChange[] = [];
      let racesAnalyzed = 0;
      let racesMatched = 0;
      let coursesProcessed: string[] = [];

      if (source_type === "global") {
        const result = await handleGlobalSync(supabase);
        changes = result.changes;
        racesAnalyzed = result.racesAnalyzed;
        racesMatched = result.racesMatched;
        coursesProcessed = result.coursesProcessed;
      } else if (source_type === "race" && race_url) {
        racesAnalyzed = 1;
        racesMatched = 1;
        const scrapedRiders = await scrapeRaceStartlist(race_url);
        changes = await generateFullSyncChanges(supabase, scrapedRiders, race_url);
        // Extract course name from changes if available
        if (changes.length > 0) {
          coursesProcessed = [...new Set(changes.map(c => c.course_name))];
        }
      }

      // Insert detected changes
      if (changes.length > 0) {
        const { error: insertError } = await supabase
          .from("startlist_tracker_changes")
          .insert(changes.map(c => ({
            ...c,
            detected_at: new Date().toISOString(),
          })));
        if (insertError) throw insertError;
      }

      // Process changes - auto-update startlist_entries
      const processedCount = await processChanges(supabase, changes);

      // Update run as completed
      await supabase
        .from("startlist_tracker_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          changes_detected: changes.length,
          changes_processed: processedCount,
          courses_processed: coursesProcessed,
        })
        .eq("id", runId);

      return new Response(
        JSON.stringify({
          success: true,
          run_id: runId,
          races_analyzed: racesAnalyzed,
          races_matched: racesMatched,
          changes_detected: changes.length,
          changes_processed: processedCount,
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
// GLOBAL SYNC: DB-BASED APPROACH (replaces PCS changes page)
// ============================================================

/**
 * New global sync strategy:
 * 1. Query upcoming courses from DB (next 6 weeks)
 * 2. Prioritize courses never checked or not checked recently
 * 3. Build PCS URL from pcs_slug or course ID
 * 4. Scrape individual startlist pages (which work reliably)
 * 5. Compare with existing entries to detect changes
 */
async function handleGlobalSync(supabase: any): Promise<{
  changes: StartlistChange[];
  racesAnalyzed: number;
  racesMatched: number;
  coursesProcessed: string[];
}> {
  const now = new Date();
  const sixWeeksLater = new Date(now);
  sixWeeksLater.setDate(sixWeeksLater.getDate() + 42);

  // Also include courses that started recently (last 3 days) to catch late changes
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recheckCutoff = new Date(now);
  recheckCutoff.setHours(recheckCutoff.getHours() - RECHECK_INTERVAL_HOURS);

  console.log(`Global sync: looking for courses from ${threeDaysAgo.toISOString().split("T")[0]} to ${sixWeeksLater.toISOString().split("T")[0]}`);

  // Fetch race IDs that have a validated startlist (pcs_validated = true) to exclude them
  const { data: validatedImports } = await supabase
    .from("startlist_imports")
    .select("race_id")
    .eq("pcs_validated", true);

  const validatedRaceIds = new Set((validatedImports || []).map((si: any) => si.race_id));
  console.log(`Excluding ${validatedRaceIds.size} courses with validated startlists`);

  // Fetch courses that need checking:
  // - date_debut in range
  // - never checked OR checked more than RECHECK_INTERVAL_HOURS ago
  // - NOT already validated (filtered post-query)
  const { data: allCourses, error: coursesError } = await supabase
    .from("courses")
    .select("id, nom, pcs_slug, date_debut, last_tracker_check")
    .gte("date_debut", threeDaysAgo.toISOString().split("T")[0])
    .lte("date_debut", sixWeeksLater.toISOString().split("T")[0])
    .or(`last_tracker_check.is.null,last_tracker_check.lt.${recheckCutoff.toISOString()}`)
    .order("last_tracker_check", { ascending: true, nullsFirst: true })
    .limit(MAX_COURSES_PER_RUN * 3); // Fetch more to compensate for filtered-out validated ones

  const courses = (allCourses || []).filter((c: any) => !validatedRaceIds.has(c.id)).slice(0, MAX_COURSES_PER_RUN);

  if (coursesError) {
    console.error(`Failed to query courses: ${coursesError.message}`);
    throw coursesError;
  }

  if (!courses || courses.length === 0) {
    console.log("No courses need checking right now (all recently checked or none in range)");
    return { changes: [], racesAnalyzed: 0, racesMatched: 0, coursesProcessed: [] };
  }

  console.log(`Found ${courses.length} courses to check:`);
  courses.forEach((c: DbCourse, i: number) => {
    console.log(`  ${i + 1}. ${c.nom} (${c.id}) - last check: ${c.last_tracker_check || "never"}`);
  });

  const allChanges: StartlistChange[] = [];
  const coursesProcessed: string[] = [];
  let racesMatched = 0;

  for (const course of courses as DbCourse[]) {
    const pcsUrl = buildPcsStartlistUrl(course);
    if (!pcsUrl) {
      console.log(`Could not build PCS URL for "${course.nom}" (${course.id}), skipping`);
      // Still mark as checked to avoid retrying endlessly
      await markCourseChecked(supabase, course.id);
      continue;
    }

    console.log(`\n--- Processing: ${course.nom} ---`);
    console.log(`PCS URL: ${pcsUrl}`);

    try {
      const scrapedRiders = await scrapeRaceStartlist(pcsUrl);
      
      if (scrapedRiders.length === 0) {
        console.log(`No riders found for ${course.nom}, startlist may not be published yet`);
        await markCourseChecked(supabase, course.id);
        continue;
      }

      racesMatched++;
      coursesProcessed.push(course.nom);

      // Override the course_id/course_name from the scraper with our DB values
      const ridersWithDbInfo = scrapedRiders.map(r => ({
        ...r,
        course_id: course.id,
        course_name: course.nom,
      }));

      const raceChanges = await generateFullSyncChanges(supabase, ridersWithDbInfo, pcsUrl);
      console.log(`Changes for ${course.nom}: ${raceChanges.length}`);
      allChanges.push(...raceChanges);

      await markCourseChecked(supabase, course.id);
    } catch (raceError) {
      console.error(`Error processing ${course.nom}:`, raceError);
      // Still mark as checked to prevent infinite retry loop
      await markCourseChecked(supabase, course.id);
    }
  }

  console.log(`\nGlobal sync complete: ${courses.length} analyzed, ${racesMatched} matched, ${allChanges.length} changes`);

  return {
    changes: allChanges,
    racesAnalyzed: courses.length,
    racesMatched,
    coursesProcessed,
  };
}

/**
 * Build the PCS startlist URL from course data.
 * Priority: pcs_slug > derived from course ID
 */
function buildPcsStartlistUrl(course: DbCourse): string | null {
  const year = course.date_debut ? new Date(course.date_debut).getFullYear() : new Date().getFullYear();

  // 1. Use pcs_slug if available
  if (course.pcs_slug) {
    return `https://www.procyclingstats.com/race/${course.pcs_slug}/${year}/startlist`;
  }

  // 2. Derive slug from course ID
  const slug = derivePcsSlug(course.id);
  if (slug) {
    return `https://www.procyclingstats.com/race/${slug}/${year}/startlist`;
  }

  return null;
}

/**
 * Derive a PCS slug from a course ID.
 * Handles formats like:
 *   "tour_de_la_provence"        -> "tour-de-la-provence"
 *   "omloop-nieuwsblad-mj8bzkne" -> "omloop-het-nieuwsblad" (via known mappings)
 *   "uae-tour-mj6w6xhe"          -> "uae-tour"
 */
function derivePcsSlug(courseId: string): string | null {
  // Known mappings for courses whose IDs don't match PCS slugs
  const KNOWN_MAPPINGS: Record<string, string> = {
    "omloop-nieuwsblad": "omloop-het-nieuwsblad",
    "strade-bianche": "strade-bianche",
    "paris-nice": "paris-nice",
    "tirreno-adriatico": "tirreno-adriatico",
    "clasica_de_almeria": "clasica-de-almeria",
    "vuelta_a_andalucia_ruta_ciclista_del_sol": "vuelta-a-andalucia",
    "volta_ao_algarve_em_bicicleta": "volta-ao-algarve",
    "tour_de_la_provence": "tour-de-la-provence",
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

  // Strip random 8-char suffix (pattern: -[a-z0-9]{6,10} at end)
  const cleanId = courseId.replace(/-[a-z0-9]{6,10}$/, "");

  // Check known mappings first (with clean ID)
  if (KNOWN_MAPPINGS[cleanId]) {
    return KNOWN_MAPPINGS[cleanId];
  }

  // Also check with original ID (for underscore-based IDs without suffix)
  if (KNOWN_MAPPINGS[courseId]) {
    return KNOWN_MAPPINGS[courseId];
  }

  // Convert underscores to hyphens as general fallback
  const slug = cleanId.replace(/_/g, "-");

  // Skip IDs that look like continental championships or very specific codes
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
// HTML PARSING FUNCTIONS
// ============================================================

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a race startlist page HTML to extract all riders with their teams.
 * Uses DOMParser for reliable parsing of minified HTML.
 */
function parseStartlistHtml(html: string): { rider_name: string; team_name: string }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    console.error("parseStartlistHtml: Failed to parse HTML");
    return [];
  }

  // Log page title for diagnostics
  const title = doc.querySelector("title")?.textContent || "unknown";
  console.log(`Page title: "${title}"`);

  const startlist = doc.querySelector(".startlist_v4");
  if (!startlist) {
    console.warn("parseStartlistHtml: No .startlist_v4 found");
    // Log first 500 chars for diagnostics
    console.log(`HTML preview: ${html.substring(0, 500)}`);

    // Fallback: scan all rider links
    const allPageLinks = doc.querySelectorAll("a");
    const riders: { rider_name: string; team_name: string }[] = [];
    for (const link of allPageLinks) {
      const href = link.getAttribute("href") || "";
      if (!href.includes("rider/")) continue;
      const name = link.textContent?.trim() || "";
      if (name.length > 2) {
        riders.push({ rider_name: name, team_name: "Unknown" });
      }
    }
    console.log(`parseStartlistHtml fallback: extracted ${riders.length} riders`);
    return riders;
  }

  const riders: { rider_name: string; team_name: string }[] = [];
  const allLinks = startlist.querySelectorAll("a");
  let currentTeam = "Unknown Team";
  let teamCount = 0;

  for (const link of allLinks) {
    const href = link.getAttribute("href") || "";
    const className = link.getAttribute("class") || "";

    if (className.includes("team") && !className.includes("team-in-race")) {
      currentTeam = link.textContent?.trim() || "Unknown Team";
      teamCount++;
    } else if (href.includes("rider/") && !href.includes("team-in-race")) {
      const riderName = link.textContent?.trim() || "";
      if (riderName.length > 2) {
        riders.push({ rider_name: riderName, team_name: currentTeam });
      }
    }
  }

  console.log(`parseStartlistHtml: extracted ${riders.length} riders from ${teamCount} teams`);
  if (riders.length > 0) {
    console.log(`Sample: ${riders.slice(0, 3).map(r => `${r.rider_name} (${r.team_name})`).join(", ")}`);
  }
  return riders;
}

// ============================================================
// SCRAPING FUNCTIONS
// ============================================================

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

/**
 * Scrape a race startlist page and extract all riders.
 */
async function scrapeRaceStartlist(raceUrl: string): Promise<StartlistChange[]> {
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

  const courseId = extractPcsRaceSlug(raceUrl) || "unknown";

  // Extract race name
  const titleDoc = new DOMParser().parseFromString(html, "text/html");
  const h1 = titleDoc?.querySelector("h1");
  let courseName = courseId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  if (h1) {
    const hideSpans = h1.querySelectorAll(".hideIfMobile");
    for (const span of hideSpans) {
      span.remove();
    }
    const cleanTitle = h1.textContent?.trim() || "";
    if (cleanTitle.length > 2) {
      courseName = cleanTitle;
    }
  }

  const parsedRiders = parseStartlistHtml(html);
  console.log(`Parsed ${parsedRiders.length} riders for "${courseName}"`);

  if (parsedRiders.length > 0) {
    console.log(`Sample riders: ${parsedRiders.slice(0, 5).map(r => r.rider_name).join(", ")}...`);
  }

  if (parsedRiders.length < 20 && parsedRiders.length > 0) {
    console.warn(`WARNING: Only ${parsedRiders.length} riders extracted - this seems incomplete for a race startlist!`);
  }

  return parsedRiders.map(r => ({
    course_id: courseId,
    course_name: courseName,
    rider_name: r.rider_name,
    team_name: r.team_name || null,
    change_type: "added" as const,
    source_url: raceUrl,
  }));
}

// ============================================================
// SYNC & PROCESSING FUNCTIONS
// ============================================================

/**
 * Generate full sync changes by comparing scraped riders with existing startlist entries.
 */
async function generateFullSyncChanges(
  supabase: any,
  scrapedRiders: StartlistChange[],
  raceUrl: string
): Promise<StartlistChange[]> {
  if (scrapedRiders.length === 0) {
    console.log("No riders scraped, skipping full sync");
    return [];
  }

  const courseName = scrapedRiders[0]?.course_name || "Unknown Race";
  const courseId = scrapedRiders[0]?.course_id || "unknown";

  console.log(`Full sync for ${courseName}: ${scrapedRiders.length} riders scraped`);

  // Try to find the course in DB
  const { data: courses } = await supabase.rpc("search_course_by_name", {
    p_search: courseName,
    p_limit: 1,
  });

  let course = courses?.[0];

  if (!course) {
    const searchTerms = courseName.split(" ").slice(0, 4).join("%");
    const { data: directCourses } = await supabase
      .from("courses")
      .select("id, nom, date_debut")
      .ilike("nom", `%${searchTerms}%`)
      .order("date_debut", { ascending: false })
      .limit(1);
    course = directCourses?.[0];
  }

  // If course ID was already set from DB (global sync), use it directly
  if (!course) {
    const { data: directById } = await supabase
      .from("courses")
      .select("id, nom, date_debut")
      .eq("id", courseId)
      .maybeSingle();
    course = directById;
  }

  if (!course) {
    console.log(`Course not found for full sync: ${courseName}`);
    return scrapedRiders;
  }

  console.log(`Found course for full sync: ${course.id} - ${course.nom}`);

  const { data: imports } = await supabase
    .from("startlist_imports")
    .select("id")
    .eq("race_id", course.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!imports || imports.length === 0) {
    console.log("No existing startlist import, all scraped riders are additions");
    return scrapedRiders;
  }

  const startlistId = imports[0].id;

  const { data: existingEntries } = await supabase
    .from("startlist_entries")
    .select("id, source_name, coureur_id, coureurs(nom)")
    .eq("startlist_id", startlistId);

  if (!existingEntries || existingEntries.length === 0) {
    console.log("No existing entries, all scraped riders are additions");
    return scrapedRiders;
  }

  console.log(`Existing entries: ${existingEntries.length}`);

  const normalize = (name: string) =>
    name.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, "")
      .trim();

  const scrapedNamesNormalized = new Set(
    scrapedRiders.map(r => normalize(r.rider_name))
  );

  const existingNamesNormalized = new Map<string, { source_name: string; coureur_nom: string | null }>();
  for (const entry of existingEntries) {
    const sourceName = entry.source_name || "";
    const coureurNom = entry.coureurs?.nom || "";

    if (sourceName) {
      existingNamesNormalized.set(normalize(sourceName), {
        source_name: sourceName,
        coureur_nom: coureurNom,
      });
    }
    if (coureurNom && !existingNamesNormalized.has(normalize(coureurNom))) {
      existingNamesNormalized.set(normalize(coureurNom), {
        source_name: sourceName || coureurNom,
        coureur_nom: coureurNom,
      });
    }
  }

  const changes: StartlistChange[] = [];

  const scrapedCount = scrapedRiders.length;
  const existingCount = existingEntries.length;
  const removalThreshold = 0.5;

  const shouldProcessRemovals = scrapedCount >= existingCount * removalThreshold;

  if (!shouldProcessRemovals) {
    console.warn(`SAFETY: Scraped ${scrapedCount} riders vs ${existingCount} existing (< ${removalThreshold * 100}%). Skipping removals.`);
  }

  if (shouldProcessRemovals) {
    for (const [normalizedName, entry] of existingNamesNormalized.entries()) {
      if (!scrapedNamesNormalized.has(normalizedName)) {
        const displayName = entry.coureur_nom || entry.source_name;
        console.log(`Marking for removal: ${displayName}`);
        changes.push({
          course_id: courseId,
          course_name: courseName,
          rider_name: entry.source_name,
          team_name: null,
          change_type: "removed",
          source_url: raceUrl,
        });
      }
    }
  }

  for (const scrapedRider of scrapedRiders) {
    const normalizedScraped = normalize(scrapedRider.rider_name);
    if (!existingNamesNormalized.has(normalizedScraped)) {
      console.log(`Marking for addition: ${scrapedRider.rider_name}`);
      changes.push(scrapedRider);
    }
  }

  const additionsCount = changes.filter(c => c.change_type === "added").length;
  const removalsCount = changes.filter(c => c.change_type === "removed").length;
  console.log(`Full sync: ${additionsCount} additions, ${removalsCount} removals (safety: removals ${shouldProcessRemovals ? "ON" : "OFF"})`);

  return changes;
}

async function processChanges(supabase: any, changes: StartlistChange[]): Promise<number> {
  let processedCount = 0;

  const { data: currentSeason, error: seasonError } = await supabase
    .from("saisons")
    .select("id, annee")
    .eq("annee", 2026)
    .maybeSingle();

  if (seasonError) {
    console.error(`Failed to load season 2026: ${seasonError.message}`);
  }

  const saisonId = currentSeason?.id;
  console.log(`Using season: ${saisonId} (${currentSeason?.annee})`);

  if (!saisonId) {
    console.error("No season id found for 2026; cannot auto-match riders.");
    return 0;
  }

  for (const change of changes) {
    try {
      console.log(`Processing change: ${change.rider_name} for ${change.course_name}`);

      const normalizedCourseName = change.course_name.replace(/\s+\d{4}$/, "").trim();

      const { data: courses } = await supabase.rpc("search_course_by_name", {
        p_search: normalizedCourseName,
        p_limit: 1,
      });

      let course = courses?.[0];

      if (!course) {
        const searchTerms = normalizedCourseName.split(" ").slice(0, 4).join("%");
        const { data: directCourses } = await supabase
          .from("courses")
          .select("id, nom, date_debut")
          .ilike("nom", `%${searchTerms}%`)
          .order("date_debut", { ascending: false })
          .limit(1);
        course = directCourses?.[0];
      }

      // Also try direct ID lookup (for global sync where course_id = DB id)
      if (!course) {
        const { data: directById } = await supabase
          .from("courses")
          .select("id, nom, date_debut")
          .eq("id", change.course_id)
          .maybeSingle();
        course = directById;
      }

      if (!course) {
        console.log(`Course not found: ${change.course_name}`);
        await supabase
          .from("startlist_tracker_changes")
          .update({
            processed: false,
            processed_at: new Date().toISOString(),
            validation_status: "unmatched",
          })
          .eq("rider_name", change.rider_name)
          .eq("course_name", change.course_name)
          .is("processed", false);
        continue;
      }

      console.log(`Found course: ${course.id} - ${course.nom}`);

      let startlistId: string;
      const { data: imports } = await supabase
        .from("startlist_imports")
        .select("id")
        .eq("race_id", course.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!imports || imports.length === 0) {
        console.log(`Creating new startlist import for course: ${course.id}`);
        const { data: newImport, error: importError } = await supabase
          .from("startlist_imports")
          .insert({
            race_id: course.id,
            file_url: change.source_url || `https://www.procyclingstats.com/race/${course.id}`,
            saison_id: saisonId,
          })
          .select()
          .single();

        if (importError) {
          console.error(`Failed to create startlist import: ${importError.message}`);
          await supabase
            .from("startlist_tracker_changes")
            .update({
              processed: false,
              processed_at: new Date().toISOString(),
              validation_status: "unmatched",
              course_id: course.id,
            })
            .eq("rider_name", change.rider_name)
            .eq("course_name", change.course_name)
            .is("processed", false);
          continue;
        }
        startlistId = newImport.id;
      } else {
        startlistId = imports[0].id;
      }

      let coureurId: string | null = null;
      if (saisonId) {
        const { data: matchedRiders, error: matchError } = await supabase.rpc("search_riders_for_matching", {
          p_saison_id: saisonId,
          p_query: change.rider_name,
          p_limit: 1,
        });

        if (matchError) {
          console.error(`Rider matching error: ${matchError.message}`);
        } else if (matchedRiders && matchedRiders.length > 0) {
          coureurId = matchedRiders[0].coureur_id;
          console.log(`Matched rider: "${change.rider_name}" -> "${matchedRiders[0].coureur_nom}" (${coureurId})`);
        } else {
          console.log(`No match found for rider: ${change.rider_name}`);
        }
      }

      let entryInserted = false;
      let insertedEntryId: string | null = null;

      if (change.change_type === "added") {
        const { data: existing } = await supabase
          .from("startlist_entries")
          .select("id")
          .eq("startlist_id", startlistId)
          .ilike("source_name", change.rider_name)
          .limit(1);

        if (!existing || existing.length === 0) {
          const { data: maxLineData } = await supabase
            .from("startlist_entries")
            .select("line_no")
            .eq("startlist_id", startlistId)
            .order("line_no", { ascending: false })
            .limit(1);

          const nextLineNo = (maxLineData?.[0]?.line_no || 0) + 1;

          const { data: insertedEntry, error: entryError } = await supabase
            .from("startlist_entries")
            .insert({
              startlist_id: startlistId,
              line_no: nextLineNo,
              source_name: change.rider_name,
              source_team: change.team_name,
              coureur_id: coureurId,
              confidence: coureurId ? 0.9 : null,
              status: coureurId ? "confirmed" : "unmatched",
            })
            .select("id")
            .single();

          if (entryError) {
            console.error(`Failed to insert entry: ${entryError.message}`);
          } else {
            console.log(`Added entry for ${change.rider_name} to startlist ${startlistId} (line ${nextLineNo})`);
            entryInserted = true;
            insertedEntryId = insertedEntry?.id || null;
          }
        } else {
          entryInserted = true;
          insertedEntryId = existing[0].id;
        }
      } else if (change.change_type === "removed") {
        console.log(`Looking for entry to remove: startlist_id=${startlistId}, source_name="${change.rider_name}"`);

        let { data: toRemove } = await supabase
          .from("startlist_entries")
          .select("id, source_name, coureur_id")
          .eq("startlist_id", startlistId)
          .ilike("source_name", change.rider_name)
          .limit(1);

        if ((!toRemove || toRemove.length === 0) && coureurId) {
          const { data: fallbackEntries } = await supabase
            .from("startlist_entries")
            .select("id, source_name, coureur_id")
            .eq("startlist_id", startlistId)
            .eq("coureur_id", coureurId)
            .limit(1);
          toRemove = fallbackEntries;
        }

        if (toRemove && toRemove.length > 0) {
          const entryToDelete = toRemove[0];
          const { error: deleteError } = await supabase
            .from("startlist_entries")
            .delete()
            .eq("id", entryToDelete.id);

          if (deleteError) {
            console.error(`Failed to delete entry ${entryToDelete.id}: ${deleteError.message}`);
          } else {
            console.log(`Successfully deleted entry ${entryToDelete.id} for ${change.rider_name}`);
            entryInserted = true;
            insertedEntryId = entryToDelete.id;
          }
        } else {
          console.log(`No entry found to remove for ${change.rider_name} in startlist ${startlistId}`);
        }
      }

      const isFullyValidated = coureurId !== null && entryInserted;
      await supabase
        .from("startlist_tracker_changes")
        .update({
          processed: entryInserted,
          processed_at: new Date().toISOString(),
          validation_status: isFullyValidated ? "validated" : (entryInserted ? "pending" : "unmatched"),
          coureur_id: coureurId,
          course_id: course.id,
          startlist_entry_id: insertedEntryId,
        })
        .eq("rider_name", change.rider_name)
        .eq("course_name", change.course_name);

      if (isFullyValidated) {
        processedCount++;
      }
    } catch (error) {
      console.error(`Error processing change for ${change.rider_name}:`, error);
    }
  }

  return processedCount;
}
