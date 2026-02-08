import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ NORMALIZATION (same as _shared/normalization.ts) ============

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

// ============ PCS URL BUILDER ============

function buildPcsUrl(pcsSlug: string, year: number, typeClassement: string, etapeNumero: number | null, typeCourse: string | null): string {
  const base = `https://www.procyclingstats.com/race/${pcsSlug}/${year}`;
  
  // One-day races always use the simple result URL regardless of classement type
  const tc = (typeCourse || '').toLowerCase().replace(/[\s_-]/g, '');
  if (tc === 'oneday') {
    return `${base}/result/result`;
  }
  
  switch (typeClassement) {
    case "Etape":
      return `${base}/stage-${etapeNumero}/result/result`;
    case "General":
      return `${base}/gc/result/result`;
    case "Points":
      return `${base}/points/result/result`;
    case "Montagne":
      return `${base}/kom/result/result`;
    case "Jeune":
      return `${base}/youth/result/result`;
    default:
      return `${base}/result/result`;
  }
}

// ============ HTML PARSER ============

interface ScrapedResult {
  position: number;
  rider_name: string;
  rider_pcs_slug: string;
  team: string;
  matched_coureur_id: string | null;
  matched_coureur_nom: string | null;
}

// Regex-based parser for PCS results HTML
function parseResultsRegex(html: string): ScrapedResult[] {
  const results: ScrapedResult[] = [];
  
  // Find the results table section
  const tableMatch = html.match(/<table[^>]*class="results[^"]*"[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    console.log("No results table found via regex");
    return [];
  }
  
  const tableHtml = tableMatch[0];
  console.log(`Results table HTML length: ${tableHtml.length}`);
  
  // Match individual rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowContent = rowMatch[1];
    
    // Extract position (first <td> content - must be a number)
    const posMatch = rowContent.match(/<td[^>]*>\s*(\d+)\s*<\/td>/);
    if (!posMatch) continue;
    const position = parseInt(posMatch[1]);
    if (isNaN(position) || position <= 0) continue;
    
    // Extract rider info from ridername cell
    // PCS format: <td class="ridername ..."><div class="cont"><span class="flag xx"></span> <a ... href="...rider/SLUG..."><span class="uppercase">LASTNAME</span> FIRSTNAME</a>
    const riderCellMatch = rowContent.match(/class="ridername[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (!riderCellMatch) continue;
    
    const riderCell = riderCellMatch[1];
    
    // Extract rider slug from href - handle both relative and absolute URLs
    const slugMatch = riderCell.match(/href="[^"]*?rider\/([^"/?#]+)"/i);
    const riderPcsSlug = slugMatch ? slugMatch[1] : "";
    
    // Extract last name from uppercase span
    const lastNameMatch = riderCell.match(/<span[^>]*class="uppercase"[^>]*>([^<]+)<\/span>/i);
    const lastName = lastNameMatch ? lastNameMatch[1].trim() : "";
    
    // Extract first name: text after </span> before </a>
    const firstNameMatch = riderCell.match(/<\/span>\s*([^<]+)\s*<\/a>/i);
    const firstName = firstNameMatch ? firstNameMatch[1].trim() : "";
    
    const riderName = `${firstName} ${lastName}`.trim();
    if (!riderName || riderName.length < 2) continue;
    
    // Extract team from cu600 cell
    const teamMatch = rowContent.match(/class="cu600[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    const team = teamMatch ? teamMatch[1].trim() : "";
    
    results.push({
      position,
      rider_name: riderName,
      rider_pcs_slug: riderPcsSlug,
      team,
      matched_coureur_id: null,
      matched_coureur_nom: null,
    });
  }
  
  console.log(`Regex parsed ${results.length} results`);
  return results;
}

function parseResultsHtml(html: string): ScrapedResult[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    console.error("Failed to parse HTML document");
    throw new Error("Failed to parse HTML");
  }

  const results: ScrapedResult[] = [];

  // Find the results table
  const table = doc.querySelector("table.results");
  if (!table) {
    // Try to debug what we got
    const allTables = doc.querySelectorAll("table");
    console.log(`No table.results found. Total tables: ${allTables.length}`);
    
    // Check if page contains result data at all
    const hasResultsCont = html.includes("resultsCont");
    const hasTableResults = html.includes("table class=\"results");
    const hasSortTabell = html.includes("sortTabell");
    console.log(`HTML contains: resultsCont=${hasResultsCont}, table.results=${hasTableResults}, sortTabell=${hasSortTabell}`);
    console.log(`HTML snippet (first 500): ${html.substring(0, 500)}`);
    
    // Fallback: try regex-based parsing
    return parseResultsRegex(html);
  }

  const rows = table.querySelectorAll("tbody tr");

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) continue;

    // Position is first cell
    const posText = cells[0]?.textContent?.trim() || "";
    const position = parseInt(posText);
    if (isNaN(position) || position <= 0) continue;

    // Rider name from td.ridername
    const riderCell = row.querySelector("td.ridername");
    if (!riderCell) continue;

    const riderLink = riderCell.querySelector("a[href*='/rider/']");
    if (!riderLink) continue;

    // Extract PCS slug from href
    const href = riderLink.getAttribute("href") || "";
    const slugMatch = href.match(/\/rider\/([^/?#]+)/);
    const riderPcsSlug = slugMatch ? slugMatch[1] : "";

    // Extract name: <span class="uppercase">LastName</span> FirstName
    const uppercaseSpan = riderLink.querySelector("span.uppercase");
    const lastName = uppercaseSpan?.textContent?.trim() || "";
    // Full text minus the last name gives us the first name
    const fullText = riderLink.textContent?.trim() || "";
    const firstName = fullText.replace(lastName, "").trim();
    const riderName = `${firstName} ${lastName}`.trim();

    // Team from td.cu600
    const teamCell = row.querySelector("td.cu600 a");
    const team = teamCell?.textContent?.trim() || "";

    results.push({
      position,
      rider_name: riderName,
      rider_pcs_slug: riderPcsSlug,
      team,
      matched_coureur_id: null,
      matched_coureur_nom: null,
    });
  }

  return results;
}

// ============ EXTRACT PCS SLUG FROM COURSE ID ============

function extractPcsSlugFromId(courseId: string): string | null {
  // Strategy 1: IDs with 8-char random suffix: "tour-de-france-mj6wc9l7" -> "tour-de-france"
  const match = courseId.match(/^(.+)-([a-z0-9]{8})$/);
  if (match) return match[1];
  
  // Strategy 2: Underscore-based IDs: "muscat_classic" -> "muscat-classic"
  if (courseId.includes('_')) {
    return courseId.replace(/_/g, '-');
  }
  
  // Strategy 3: Already a valid slug (contains hyphens, no random suffix pattern)
  if (courseId.includes('-')) {
    return courseId;
  }
  
  return null;
}

// ============ MAIN ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { course_id, year, type_classement, etape_numero } = await req.json();

    if (!course_id || !year) {
      return new Response(
        JSON.stringify({ error: "course_id and year are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get PCS slug: first try pcs_slug column, then extract from course_id
    const { data: courseData } = await supabase
      .from("courses")
      .select("id, pcs_slug, type_course")
      .eq("id", course_id)
      .single();

    let pcsSlug = courseData?.pcs_slug || extractPcsSlugFromId(course_id);

    if (!pcsSlug) {
      return new Response(
        JSON.stringify({ error: "Cannot determine PCS slug for this course. Please set pcs_slug in the courses table." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Build PCS URL
    const classement = type_classement || "General";
    const typeCourse = courseData?.type_course || null;
    const pcsUrl = buildPcsUrl(pcsSlug, year, classement, etape_numero, typeCourse);
    console.log(`Fetching PCS results from: ${pcsUrl}`);

    // 3. Fetch HTML
    const response = await fetch(pcsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `PCS returned ${response.status}. URL: ${pcsUrl}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();
    console.log(`Fetched HTML: ${html.length} characters`);
    
    // Debug: check what HTML structure we got
    const hasTableResults = html.includes('class="results');
    const hasRider = html.includes('/rider/');
    const hasUppercase = html.includes('class="uppercase"') || html.includes("class='uppercase'");
    console.log(`HTML check: table.results=${hasTableResults}, /rider/=${hasRider}, uppercase=${hasUppercase}`);

    // 4. Parse results - use regex directly (more reliable than deno-dom for PCS)
    const scrapedResults = parseResultsRegex(html);
    console.log(`Parsed ${scrapedResults.length} results`);

    if (scrapedResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          results: [], 
          message: "No results found on PCS page",
          pcs_url: pcsUrl 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Load all coureurs from DB for matching
    const { data: coureurs, error: coureursError } = await supabase
      .from("coureurs")
      .select("id, nom")
      .limit(5000);

    if (coureursError) throw coureursError;

    // Build lookup maps for matching
    const coureursByTokenSig = new Map<string, { id: string; nom: string }>();
    const coureursByLastName = new Map<string, { id: string; nom: string }[]>();

    for (const c of coureurs || []) {
      // Token signature match (order-independent)
      const sig = tokenSig(c.nom);
      coureursByTokenSig.set(sig, c);

      // Last name lookup
      const normName = normalize(c.nom);
      const tokens = normName.split(/\s+/).filter(t => t.length > 0);
      const lastName = tokens[tokens.length - 1];
      if (lastName) {
        if (!coureursByLastName.has(lastName)) {
          coureursByLastName.set(lastName, []);
        }
        coureursByLastName.get(lastName)!.push(c);
      }
    }

    // 6. Match each scraped result with a coureur
    let matchedCount = 0;
    for (const result of scrapedResults) {
      // Strategy 1: Token signature match (insensitive to accent + word order)
      const sig = tokenSig(result.rider_name);
      const directMatch = coureursByTokenSig.get(sig);
      if (directMatch) {
        result.matched_coureur_id = directMatch.id;
        result.matched_coureur_nom = directMatch.nom;
        matchedCount++;
        continue;
      }

      // Strategy 2: Try with PCS slug converted to name
      // e.g. "jasper-philipsen" -> "JASPER PHILIPSEN"
      if (result.rider_pcs_slug) {
        const slugName = result.rider_pcs_slug.replace(/-/g, ' ');
        const slugSig = tokenSig(slugName);
        const slugMatch = coureursByTokenSig.get(slugSig);
        if (slugMatch) {
          result.matched_coureur_id = slugMatch.id;
          result.matched_coureur_nom = slugMatch.nom;
          matchedCount++;
          continue;
        }
      }

      // Strategy 3: Last name only match (if unique)
      const normName = normalize(result.rider_name);
      const tokens = normName.split(/\s+/).filter(t => t.length > 0);
      const lastName = tokens[tokens.length - 1];
      if (lastName) {
        const candidates = coureursByLastName.get(lastName) || [];
        if (candidates.length === 1) {
          result.matched_coureur_id = candidates[0].id;
          result.matched_coureur_nom = candidates[0].nom;
          matchedCount++;
        }
      }
    }

    console.log(`Matched ${matchedCount}/${scrapedResults.length} riders`);

    return new Response(
      JSON.stringify({
        success: true,
        results: scrapedResults,
        matched: matchedCount,
        total: scrapedResults.length,
        pcs_url: pcsUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
