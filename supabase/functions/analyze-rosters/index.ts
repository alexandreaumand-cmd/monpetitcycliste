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

interface LeagueContext {
  seasonYear: number;
  phaseIndex: number;
  races: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rosters, context } = await req.json() as { rosters: RosterEntry[]; context?: LeagueContext };
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

    // Build context-aware system prompt
    const seasonYear = context?.seasonYear || new Date().getFullYear();
    const phaseIndex = context?.phaseIndex || 1;
    const races = context?.races || [];
    
    const racesContext = races.length > 0 
      ? `\n\nCourses de la phase ${phaseIndex} à prendre en compte pour juger les effectifs :\n${races.map(r => `- ${r}`).join('\n')}`
      : '';

    const systemPrompt = `Tu es un expert en cyclisme professionnel avec une connaissance approfondie du peloton.

CONTEXTE IMPORTANT :
- Nous sommes dans une ligue fantasy pour la saison ${seasonYear}
- Les effectifs sont constitués pour la PHASE ${phaseIndex} uniquement
- Pour juger les coureurs, base-toi sur leurs performances des saisons ${seasonYear - 1} et ${seasonYear - 2}${racesContext}

Tu dois analyser les effectifs de managers en tenant compte de CE CONTEXTE SPÉCIFIQUE.

Pour CHAQUE manager, tu dois fournir une analyse structurée en 4 points :
1. **Points forts** : Les atouts majeurs de l'effectif POUR LES COURSES DE CETTE PHASE (sprinteurs, grimpeurs, leaders GT, coureurs de classiques, etc.)
2. **Points faibles** : Les manques ou faiblesses PAR RAPPORT AUX COURSES DE CETTE PHASE (pas le bon profil de coureurs, manque de diversité, etc.)
3. **Le bon coup** : La meilleure pioche de l'effectif - le coureur qui représente le meilleur rapport qualité/prix ou une vraie opportunité pour cette phase
4. **Who is this ?** : Le coureur dont on ne comprend pas le recrutement - un choix étrange ou surprenant vu le contexte de la phase

Sois concis mais pertinent. Chaque point doit faire 1-2 phrases maximum.
Base-toi sur tes connaissances des saisons ${seasonYear - 2} et ${seasonYear - 1} pour évaluer les coureurs.`;

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
