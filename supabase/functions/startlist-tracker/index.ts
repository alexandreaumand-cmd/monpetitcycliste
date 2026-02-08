import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface ChangedRace {
  name: string;
  slug: string;
  year: number;
  url: string;
}

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
      .insert({
        source_type,
        status: "running",
      })
      .select()
      .single();

    if (runError) throw runError;

    const runId = run.id;

    try {
      let changes: StartlistChange[] = [];
      let racesAnalyzed = 0;
      let racesMatched = 0;

      // Maximum courses to process per run to avoid timeout (150s limit)
      const MAX_COURSES_PER_RUN = 5;

      if (source_type === "global") {
        // TWO-STEP APPROACH:
        // Step 1: Fetch list of races with recent startlist modifications
        console.log("Step 1: Fetching list of changed races...");
        const changedRaces = await scrapeChangedRacesList();
        console.log(`Found ${changedRaces.length} races with recent changes`);
        racesAnalyzed = changedRaces.length;

        if (changedRaces.length === 0) {
          console.log("No races with changes found in the last 12 hours");
        } else {
          // Step 2: Get races from current season in database
          const { data: dbCourses } = await supabase
            .from("courses")
            .select("id, nom, date_debut")
            .gte("date_debut", "2025-07-01"); // Season 2026 starts July 2025

          if (dbCourses && dbCourses.length > 0) {
            console.log(`Database has ${dbCourses.length} courses for current season`);
            
            // Create lookup maps for matching
            const dbCoursesBySlug = new Map<string, { id: string; nom: string }>();
            const dbCoursesByName = new Map<string, { id: string; nom: string }>();
            
            for (const course of dbCourses) {
              dbCoursesBySlug.set(course.id.toLowerCase(), course);
              const normalizedName = normalizeName(course.nom);
              dbCoursesByName.set(normalizedName, course);
            }

            // Step 3: Match races and limit processing
            const racesToProcess: { race: ChangedRace; matchedCourse: { id: string; nom: string } }[] = [];
            
            for (const race of changedRaces) {
              const slugLower = race.slug.toLowerCase();
              const normalizedRaceName = normalizeName(race.name);
              
              let matchedCourse = dbCoursesBySlug.get(slugLower);
              if (!matchedCourse) {
                matchedCourse = dbCoursesByName.get(normalizedRaceName);
              }
              if (!matchedCourse) {
                for (const [dbSlug, course] of dbCoursesBySlug) {
                  if (dbSlug.includes(slugLower) || slugLower.includes(dbSlug)) {
                    matchedCourse = course;
                    break;
                  }
                }
              }

              if (!matchedCourse) {
                console.log(`Course "${race.name}" (${race.slug}) not found in database, skipping`);
                continue;
              }

              racesToProcess.push({ race, matchedCourse });
            }

            console.log(`Matched ${racesToProcess.length} courses, processing max ${MAX_COURSES_PER_RUN}`);
            
            const limitedRaces = racesToProcess.slice(0, MAX_COURSES_PER_RUN);
            
            for (const { race, matchedCourse } of limitedRaces) {
              racesMatched++;
              console.log(`Processing course: ${race.name} -> matched to ${matchedCourse.id}`);

              try {
                const scrapedRiders = await scrapeRaceStartlist(race.url);
                console.log(`Scraped ${scrapedRiders.length} riders from ${race.name}`);

                const raceChanges = await generateFullSyncChanges(supabase, scrapedRiders, race.url);
                console.log(`Generated ${raceChanges.length} changes for ${race.name}`);
                
                changes.push(...raceChanges);
              } catch (raceError) {
                console.error(`Error processing race ${race.name}:`, raceError);
              }
            }
            
            if (racesToProcess.length > MAX_COURSES_PER_RUN) {
              console.log(`Note: ${racesToProcess.length - MAX_COURSES_PER_RUN} more courses pending, run again to process them`);
            }
          } else {
            console.log("No courses found in database for current season");
          }
        }
      } else if (source_type === "race" && race_url) {
        racesAnalyzed = 1;
        racesMatched = 1;
        const scrapedRiders = await scrapeRaceStartlist(race_url);
        changes = await generateFullSyncChanges(supabase, scrapedRiders, race_url);
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
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Normalize a name for comparison (remove accents, lowercase, etc.)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// HTML PARSING FUNCTIONS (replacing Gemini AI calls)
// ============================================================

/**
 * Parse the "startlist changes" page HTML to extract races with recent modifications.
 * Replaces the Gemini-based extraction.
 */
function parseChangedRacesHtml(html: string): ChangedRace[] {
  const races: ChangedRace[] = [];
  const seen = new Set<string>();

  // Find all race links in the table: /race/{slug}/{year}/startlist or /race/{slug}/{year}
  const linkRegex = /<a[^>]*href="\/race\/([^/]+)\/(\d{4})(?:\/[^"]*)?"/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1];
    const year = parseInt(match[2], 10);
    const key = `${slug}/${year}`;

    if (seen.has(key)) continue;
    seen.add(key);

    // Extract the race name from the link text
    // Pattern: <a href="/race/slug/year/...">Race Name</a>
    const afterTag = html.substring(match.index);
    const nameMatch = afterTag.match(/<a[^>]*>[^<]*?(?:<[^/][^>]*>[^<]*<\/[^>]*>)*\s*([^<]+?)\s*<\/a>/i);
    
    // Simpler approach: get text content after the opening tag
    const textMatch = afterTag.match(/<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    let name = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    
    if (textMatch) {
      // Strip any inner HTML tags to get pure text
      const rawText = textMatch[1].replace(/<[^>]*>/g, "").trim();
      if (rawText.length > 2) {
        name = rawText;
      }
    }

    races.push({
      name,
      slug,
      year,
      url: `https://www.procyclingstats.com/race/${slug}/${year}/startlist`,
    });
  }

  console.log(`parseChangedRacesHtml: extracted ${races.length} races`);
  races.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} (${r.slug}/${r.year})`));
  return races;
}

/**
 * Parse a race startlist page HTML to extract all riders with their teams.
 * Replaces the Gemini-based extraction.
 * 
 * PCS structure:
 * <ul class="startlist_v4">
 *   <li>
 *     <a class="team" href="/team/...">Team Name (WT)</a>
 *     ...
 *     <a href="/rider/slug">LASTNAME Firstname</a>
 *     ...
 *   </li>
 * </ul>
 */
function parseStartlistHtml(html: string): { rider_name: string; team_name: string }[] {
  const riders: { rider_name: string; team_name: string }[] = [];

  // Find the startlist_v4 section
  const startlistMatch = html.match(/class="[^"]*startlist_v4[^"]*"/);
  if (!startlistMatch) {
    console.warn("parseStartlistHtml: No startlist_v4 section found");
    // Fallback: try to find riders in the whole page
    return parseStartlistFallback(html);
  }

  const startIdx = startlistMatch.index!;
  // Find the section from startlist_v4 to the end of its container
  const section = html.substring(startIdx);

  // Split by team blocks: each <li> in the startlist_v4 is a team
  // We look for team links and rider links
  const teamRegex = /<li[^>]*>[\s\S]*?<\/li>/gi;
  const teamBlocks = section.match(teamRegex);

  if (!teamBlocks || teamBlocks.length === 0) {
    console.warn("parseStartlistHtml: No <li> team blocks found, using line-by-line approach");
    return parseStartlistByTeamAndRider(section);
  }

  for (const block of teamBlocks) {
    // Extract team name from <a class="team" ...>Team Name</a>
    const teamMatch = block.match(/<a[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    let teamName = "Unknown Team";
    if (teamMatch) {
      teamName = teamMatch[1].replace(/<[^>]*>/g, "").trim();
    }

    // Extract riders: <a href="/rider/slug">LASTNAME Firstname</a>
    const riderRegex = /<a[^>]*href="[^"]*\/rider\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let riderMatch;
    while ((riderMatch = riderRegex.exec(block)) !== null) {
      const riderName = riderMatch[1].replace(/<[^>]*>/g, "").trim();
      if (riderName.length > 2) {
        riders.push({ rider_name: riderName, team_name: teamName });
      }
    }
  }

  console.log(`parseStartlistHtml: extracted ${riders.length} riders`);
  if (riders.length > 0) {
    console.log(`Sample: ${riders.slice(0, 5).map(r => `${r.rider_name} (${r.team_name})`).join(", ")}...`);
  }

  return riders;
}

/**
 * Alternative parsing approach: scan for team and rider links sequentially.
 * Used when <li> block splitting doesn't work cleanly.
 */
function parseStartlistByTeamAndRider(html: string): { rider_name: string; team_name: string }[] {
  const riders: { rider_name: string; team_name: string }[] = [];
  let currentTeam = "Unknown Team";

  // Match both team links and rider links in order
  const combinedRegex = /<a[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/a>|<a[^>]*href="[^"]*\/rider\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = combinedRegex.exec(html)) !== null) {
    if (match[1] !== undefined) {
      // Team link
      currentTeam = match[1].replace(/<[^>]*>/g, "").trim();
    } else if (match[2] !== undefined) {
      // Rider link
      const riderName = match[2].replace(/<[^>]*>/g, "").trim();
      if (riderName.length > 2) {
        riders.push({ rider_name: riderName, team_name: currentTeam });
      }
    }
  }

  console.log(`parseStartlistByTeamAndRider: extracted ${riders.length} riders`);
  return riders;
}

/**
 * Last-resort fallback: just find all /rider/ links in the page.
 */
function parseStartlistFallback(html: string): { rider_name: string; team_name: string }[] {
  const riders: { rider_name: string; team_name: string }[] = [];
  const riderRegex = /<a[^>]*href="[^"]*\/rider\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = riderRegex.exec(html)) !== null) {
    const riderName = match[1].replace(/<[^>]*>/g, "").trim();
    if (riderName.length > 2) {
      riders.push({ rider_name: riderName, team_name: "Unknown" });
    }
  }

  console.log(`parseStartlistFallback: extracted ${riders.length} riders`);
  return riders;
}

// ============================================================
// SCRAPING FUNCTIONS (now using HTML parsing instead of Gemini)
// ============================================================

/**
 * Scrape the list of races with recent startlist changes.
 * No longer requires API key - uses direct HTML parsing.
 */
async function scrapeChangedRacesList(): Promise<ChangedRace[]> {
  const pcsUrl = "https://www.procyclingstats.com/races.php?s=startlist-changes-all-races&interval=12&filter=Filter";
  
  console.log(`Fetching changed races list from: ${pcsUrl}`);
  
  const response = await fetch(pcsUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PCS races page: ${response.status}`);
  }

  const html = await response.text();
  console.log(`Fetched HTML: ${html.length} characters`);

  return parseChangedRacesHtml(html);
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

/**
 * Scrape a race startlist page and extract all riders.
 * No longer requires API key - uses direct HTML parsing.
 */
async function scrapeRaceStartlist(raceUrl: string): Promise<StartlistChange[]> {
  const response = await fetch(raceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch race page: ${response.status}`);
  }

  const html = await response.text();
  console.log(`Fetched race HTML: ${html.length} characters`);

  const courseId = extractPcsRaceSlug(raceUrl) || "unknown";

  // Extract race name from the page title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let courseName = courseId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  if (titleMatch) {
    const rawTitle = titleMatch[1].replace(/<[^>]*>/g, "").trim();
    if (rawTitle.length > 2) {
      courseName = rawTitle;
    }
  }

  // Parse riders using regex HTML parsing
  const parsedRiders = parseStartlistHtml(html);
  
  console.log(`Parsed ${parsedRiders.length} riders for "${courseName}"`);
  
  if (parsedRiders.length > 0) {
    console.log(`Sample riders: ${parsedRiders.slice(0, 5).map(r => r.rider_name).join(", ")}...`);
  }
  
  if (parsedRiders.length < 20) {
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
// SYNC & PROCESSING FUNCTIONS (unchanged)
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
        coureur_nom: coureurNom
      });
    }
    if (coureurNom && !existingNamesNormalized.has(normalize(coureurNom))) {
      existingNamesNormalized.set(normalize(coureurNom), {
        source_name: sourceName || coureurNom,
        coureur_nom: coureurNom
      });
    }
  }

  const changes: StartlistChange[] = [];

  const scrapedCount = scrapedRiders.length;
  const existingCount = existingEntries.length;
  const removalThreshold = 0.5;
  
  const shouldProcessRemovals = scrapedCount >= existingCount * removalThreshold;
  
  if (!shouldProcessRemovals) {
    console.warn(`SAFETY: Scraped ${scrapedCount} riders vs ${existingCount} existing (< ${removalThreshold * 100}%). Skipping removals to prevent false deletions.`);
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
  console.log(`Full sync result: ${additionsCount} additions, ${removalsCount} removals (safety check: removals ${shouldProcessRemovals ? "enabled" : "DISABLED"})`);

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
      
      const normalizedCourseName = change.course_name.replace(/\s+\d{4}$/, '').trim();
      console.log(`Normalized course name: "${normalizedCourseName}"`);
      
      const { data: courses } = await supabase.rpc("search_course_by_name", {
        p_search: normalizedCourseName,
        p_limit: 1,
      });

      let course = courses?.[0];
      console.log(`RPC search result: ${JSON.stringify(course)}`);

      if (!course) {
        const searchTerms = normalizedCourseName.split(" ").slice(0, 4).join("%");
        const { data: directCourses } = await supabase
          .from("courses")
          .select("id, nom, date_debut")
          .ilike("nom", `%${searchTerms}%`)
          .order("date_debut", { ascending: false })
          .limit(1);
        course = directCourses?.[0];
        console.log(`Fallback search result: ${JSON.stringify(course)}`);
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

        console.log(`Search by source_name result: ${JSON.stringify(toRemove)}`);

        if ((!toRemove || toRemove.length === 0) && coureurId) {
          console.log(`Fallback: searching by coureur_id=${coureurId}`);
          const { data: fallbackEntries } = await supabase
            .from("startlist_entries")
            .select("id, source_name, coureur_id")
            .eq("startlist_id", startlistId)
            .eq("coureur_id", coureurId)
            .limit(1);
          toRemove = fallbackEntries;
          console.log(`Fallback search result: ${JSON.stringify(toRemove)}`);
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
