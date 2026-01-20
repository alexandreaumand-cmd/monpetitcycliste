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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
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

      if (source_type === "global") {
        // Fetch the global startlist changes page
        changes = await scrapeGlobalChanges(lovableApiKey);
      } else if (source_type === "race" && race_url) {
        // Fetch a specific race startlist
        changes = await scrapeRaceStartlist(race_url, lovableApiKey);
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
          changes_detected: changes.length,
          changes_processed: processedCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      // Update run as failed
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

async function scrapeGlobalChanges(apiKey: string | undefined): Promise<StartlistChange[]> {
  const pcsUrl = "https://www.procyclingstats.com/startlist-changes.php";
  
  // Fetch the HTML page
  const response = await fetch(pcsUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PCS page: ${response.status}`);
  }

  const html = await response.text();

  // Use Gemini to parse the HTML and extract changes
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const geminiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an HTML parser specialized in cycling data extraction. 
Extract startlist changes from ProCyclingStats HTML.
Return a JSON array of changes with this structure:
{
  "changes": [
    {
      "course_id": "race-slug-from-url",
      "course_name": "Race Name",
      "rider_name": "Rider Full Name",
      "team_name": "Team Code or Name",
      "change_type": "added" or "removed",
      "source_url": "full URL of the race page"
    }
  ]
}
Only return valid JSON, no markdown or explanation.
Focus on recent changes (last 24-48 hours if dates are visible).`,
        },
        {
          role: "user",
          content: `Parse this HTML and extract startlist changes:\n\n${html.substring(0, 50000)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_startlist_changes",
            description: "Extract startlist changes from HTML",
            parameters: {
              type: "object",
              properties: {
                changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      course_id: { type: "string" },
                      course_name: { type: "string" },
                      rider_name: { type: "string" },
                      team_name: { type: "string" },
                      change_type: { type: "string", enum: ["added", "removed"] },
                      source_url: { type: "string" },
                    },
                    required: ["course_id", "course_name", "rider_name", "change_type"],
                  },
                },
              },
              required: ["changes"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_startlist_changes" } },
    }),
  });

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    console.error("Gemini API error:", errorText);
    throw new Error(`Gemini API error: ${geminiResponse.status}`);
  }

  const geminiData = await geminiResponse.json();
  
  // Extract tool call result
  const toolCall = geminiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.changes || [];
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      return [];
    }
  }

  return [];
}

async function scrapeRaceStartlist(raceUrl: string, apiKey: string | undefined): Promise<StartlistChange[]> {
  // Fetch the race startlist page
  const response = await fetch(raceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch race page: ${response.status}`);
  }

  const html = await response.text();

  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  // Extract race ID from URL
  const urlParts = raceUrl.split("/");
  const courseId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];

  const geminiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an HTML parser specialized in cycling startlist extraction.
Extract the complete startlist from a ProCyclingStats race page.
Return all riders currently listed as "added" entries.
Return a JSON array with this structure:
{
  "course_name": "Race Name",
  "riders": [
    {
      "rider_name": "Rider Full Name",
      "team_name": "Team Code"
    }
  ]
}
Only return valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Parse this race startlist HTML:\n\n${html.substring(0, 50000)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_race_startlist",
            description: "Extract race startlist from HTML",
            parameters: {
              type: "object",
              properties: {
                course_name: { type: "string" },
                riders: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rider_name: { type: "string" },
                      team_name: { type: "string" },
                    },
                    required: ["rider_name"],
                  },
                },
              },
              required: ["course_name", "riders"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_race_startlist" } },
    }),
  });

  if (!geminiResponse.ok) {
    throw new Error(`Gemini API error: ${geminiResponse.status}`);
  }

  const geminiData = await geminiResponse.json();
  const toolCall = geminiData.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      return (parsed.riders || []).map((r: any) => ({
        course_id: courseId,
        course_name: parsed.course_name || "Unknown Race",
        rider_name: r.rider_name,
        team_name: r.team_name || null,
        change_type: "added" as const,
        source_url: raceUrl,
      }));
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      return [];
    }
  }

  return [];
}

async function processChanges(supabase: any, changes: StartlistChange[]): Promise<number> {
  let processedCount = 0;

  // Get the current season for rider matching
  const { data: currentSeason } = await supabase
    .from("saisons")
    .select("id")
    .gte("annee_fin", new Date().getFullYear())
    .order("annee_debut", { ascending: false })
    .limit(1)
    .single();

  const saisonId = currentSeason?.id;

  for (const change of changes) {
    try {
      // Try to find matching course - use normalize_text for better matching
      const { data: courses } = await supabase.rpc("search_course_by_name", {
        p_search: change.course_name,
      });

      let course = courses?.[0];

      // Fallback: direct search on courses table
      if (!course) {
        const { data: directCourses } = await supabase
          .from("courses")
          .select("id, nom")
          .or(`id.ilike.%${change.course_id}%,nom.ilike.%${change.course_name.split(" ").slice(0, 3).join("%")}%`)
          .limit(1);
        course = directCourses?.[0];
      }

      if (!course) {
        console.log(`Course not found: ${change.course_name} (${change.course_id})`);
        continue;
      }

      // Find the latest startlist import for this course
      const { data: imports } = await supabase
        .from("startlist_imports")
        .select("id")
        .eq("race_id", course.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!imports || imports.length === 0) {
        console.log(`No startlist import found for course: ${course.id}`);
        continue;
      }

      const startlistId = imports[0].id;

      // Use the proper RPC function for word-order-insensitive, accent-insensitive matching
      let coureurId: string | null = null;
      if (saisonId) {
        const { data: matchedRiders } = await supabase.rpc("search_riders_for_matching", {
          p_saison_id: saisonId,
          p_query: change.rider_name,
          p_limit: 1,
        });

        if (matchedRiders && matchedRiders.length > 0) {
          coureurId = matchedRiders[0].coureur_id;
          console.log(`Matched rider: "${change.rider_name}" -> "${matchedRiders[0].coureur_nom}" (${coureurId})`);
        }
      }

      if (change.change_type === "added") {
        // Check if entry already exists
        const { data: existing } = await supabase
          .from("startlist_entries")
          .select("id")
          .eq("startlist_id", startlistId)
          .ilike("source_name", change.rider_name)
          .limit(1);

        if (!existing || existing.length === 0) {
          // Add new entry
          await supabase.from("startlist_entries").insert({
            startlist_id: startlistId,
            source_name: change.rider_name,
            source_team: change.team_name,
            coureur_id: coureurId,
            confidence: coureurId ? 0.9 : null,
            status: coureurId ? "matched" : "unmatched",
          });
          processedCount++;
        }
      } else if (change.change_type === "removed") {
        // Remove entry if exists
        const { data: toRemove } = await supabase
          .from("startlist_entries")
          .select("id")
          .eq("startlist_id", startlistId)
          .ilike("source_name", change.rider_name)
          .limit(1);

        if (toRemove && toRemove.length > 0) {
          await supabase
            .from("startlist_entries")
            .delete()
            .eq("id", toRemove[0].id);
          processedCount++;
        }
      }

      // Update the tracker change record
      await supabase
        .from("startlist_tracker_changes")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          coureur_id: coureurId,
          course_id: course.id,
        })
        .eq("rider_name", change.rider_name)
        .eq("course_name", change.course_name)
        .eq("processed", false);

      if (coureurId) {
        processedCount++;
      }
    } catch (error) {
      console.error(`Error processing change for ${change.rider_name}:`, error);
    }
  }

  return processedCount;
}
