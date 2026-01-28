import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";

interface Season {
  id: string;
  annee: number;
}

interface Phase {
  id: string;
  index_dans_saison: number;
  saison_id: string;
  statut: string;
  date_debut: string;
  date_fin: string;
}

interface SeasonContextType {
  selectedSeason: Season | null;
  setSelectedSeason: (season: Season | null) => void;
  seasons: Season[];
  phases: Phase[];
  activePhase: Phase | null;
  isLoading: boolean;
  isLeagueSeason: boolean;
  lockedLeagueSeason: Season | null;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export const useSeasonContext = () => {
  const context = useContext(SeasonContext);
  if (!context) {
    // During HMR or edge cases, return safe defaults instead of crashing
    console.warn("[SeasonContext] Context not available - returning default values");
    return {
      selectedSeason: null,
      setSelectedSeason: () => {},
      seasons: [],
      phases: [],
      activePhase: null,
      isLoading: true,
      isLeagueSeason: false,
      lockedLeagueSeason: null,
    } as SeasonContextType;
  }
  return context;
};

export const SeasonProvider = ({ children }: { children: ReactNode }) => {
  const { leagueId, isLoading: leagueLoading } = useLeague();
  const [selectedSeason, setSelectedSeasonState] = useState<Season | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeagueSeason, setIsLeagueSeason] = useState(false);

  // Helper to compute active phase from phases data
  const computeActivePhase = (phasesData: Phase[] | null): Phase | null => {
    if (!phasesData || phasesData.length === 0) return null;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Phase en cours (today entre date_debut et date_fin)
    const currentPhase = phasesData.find(p => 
      p.date_debut <= today && today <= p.date_fin
    );
    
    if (currentPhase) return currentPhase;
    
    // Sinon, prochaine phase à venir
    const nextPhase = phasesData.find(p => p.date_debut > today);
    if (nextPhase) return nextPhase;
    
    // Sinon, dernière phase (saison terminée)
    return phasesData[phasesData.length - 1] || null;
  };

  // Load seasons, scope, and phases in one optimized effect
  useEffect(() => {
    // Wait for LeagueContext to be ready
    if (leagueLoading) return;

    const loadAll = async () => {
      try {
        setIsLoading(true);

        // Step 1: Fetch seasons AND scope in parallel
        const [seasonsResult, scopeResult] = await Promise.all([
          supabase
            .from("saisons")
            .select("id, annee")
            .order("annee", { ascending: false }),
          leagueId 
            ? supabase
                .from("league_scopes")
                .select("season_id")
                .eq("league_id", leagueId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null })
        ]);

        if (seasonsResult.error) throw seasonsResult.error;
        const seasonsData = seasonsResult.data || [];

        // Step 2: Determine target season
        let targetSeason: Season | null = null;
        let isFromLeague = false;

        if (!leagueId) {
          // SuperAdmin mode: use most recent season
          console.log("[SeasonContext] No leagueId - SuperAdmin mode, using most recent season");
          targetSeason = seasonsData[0] || null;
          isFromLeague = false;
        } else if (scopeResult.data?.season_id) {
          // Manager mode: use league's season
          targetSeason = seasonsData.find(s => s.id === scopeResult.data.season_id) || null;
          isFromLeague = true;
          if (targetSeason) {
            console.log("[SeasonContext] Loading season from league:", targetSeason.annee);
          } else {
            console.error("[SeasonContext] Season not found for league scope");
          }
        } else {
          console.error("[SeasonContext] League has no season configured");
        }

        // Step 3: If we have a target season, load phases immediately
        let phasesData: Phase[] = [];
        if (targetSeason) {
          const { data: phases, error: phasesError } = await supabase
            .from("phases")
            .select("*")
            .eq("saison_id", targetSeason.id)
            .order("index_dans_saison", { ascending: true });

          if (phasesError) {
            console.error("Error loading phases:", phasesError);
          } else {
            phasesData = phases || [];
          }
        }

        // Step 4: Set all states at once to minimize re-renders
        setSeasons(seasonsData);
        setSelectedSeasonState(targetSeason);
        setIsLeagueSeason(isFromLeague);
        setPhases(phasesData);
        setActivePhase(computeActivePhase(phasesData));

      } catch (error) {
        console.error("Error loading seasons/phases:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  }, [leagueId, leagueLoading]);

  // Update season selection (blocked when league is active)
  const setSelectedSeason = (season: Season | null) => {
    if (leagueId) {
      console.warn("[SeasonContext] Season is controlled by league; ignoring manual change");
      return;
    }
    console.log("[SeasonContext] setSelectedSeason:", season?.id, season?.annee);
    setSelectedSeasonState(season);
    setIsLeagueSeason(false);
  };

  return (
    <SeasonContext.Provider
      value={{
        selectedSeason,
        setSelectedSeason,
        seasons,
        phases,
        activePhase,
        isLoading,
        isLeagueSeason,
        lockedLeagueSeason: isLeagueSeason ? selectedSeason : null,
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
};
