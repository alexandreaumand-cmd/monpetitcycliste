import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RosterEntry {
  manager_name: string;
  riders: Array<{
    nom: string;
    equipe: string;
    prix_achat: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rosters } = await req.json() as { rosters: RosterEntry[] };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt with all rosters data
    const rostersDescription = rosters.map(r => {
      const ridersList = r.riders
        .map(rider => `  - ${rider.nom} (${rider.equipe}) : ${rider.prix_achat}M`)
        .join("\n");
      return `**${r.manager_name}**:\n${ridersList}`;
    }).join("\n\n");

    const systemPrompt = `Tu es un expert en cyclisme professionnel avec une connaissance approfondie du peloton actuel (saison 2025).
Tu dois analyser les effectifs de managers dans un jeu de fantasy cycling.

Pour CHAQUE manager, tu dois fournir une analyse structurée en 4 points :
1. **Points forts** : Les atouts majeurs de l'effectif (sprinteurs, grimpeurs, leaders GT, équipes fortes, etc.)
2. **Points faibles** : Les manques ou faiblesses (pas de sprinteur, trop cher pour la qualité, manque de diversité, etc.)
3. **Le bon coup** : La meilleure pioche de l'effectif - le coureur qui représente le meilleur rapport qualité/prix ou une vraie opportunité
4. **Who is this ?** : Le coureur dont on ne comprend pas le recrutement - un choix étrange ou surprenant

Sois concis mais pertinent. Chaque point doit faire 1-2 phrases maximum.
Base-toi sur tes connaissances actuelles du cyclisme professionnel.`;

    const userPrompt = `Voici les effectifs des managers de la ligue :\n\n${rostersDescription}\n\nAnalyse chaque effectif selon les 4 critères demandés.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Analyse non disponible";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-rosters error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
