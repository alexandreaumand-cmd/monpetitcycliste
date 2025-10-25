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
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export const useSeasonContext = () => {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error("useSeasonContext must be used within a SeasonProvider");
  }
  return context;
};

export const SeasonProvider = ({ children }: { children: ReactNode }) => {
  const { leagueId, isLoading: isLeagueLoading } = useLeague();
  const [selectedSeason, setSelectedSeasonState] = useState<Season | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load seasons and set initial selection (League-First approach)
  useEffect(() => {
    const loadSeasonsAndSelect = async () => {
      try {
        // 1. Charger toutes les saisons (toujours nécessaire pour le dropdown)
        const { data: seasonsData, error: seasonsError } = await supabase
          .from("saisons")
          .select("id, annee")
          .order("annee", { ascending: false });

        if (seasonsError) throw seasonsError;
        setSeasons(seasonsData || []);

        let selectedSeason: Season | null = null;

        // 2. PRIORITÉ #1 : Saison de la ligue active
        if (leagueId && seasonsData) {
          console.log("[SeasonContext] League detected, loading league season:", leagueId);
          
          const { data: scope } = await supabase
            .from('league_scopes')
            .select('season_id')
            .eq('league_id', leagueId)
            .maybeSingle();
          
          if (scope?.season_id) {
            selectedSeason = seasonsData.find(s => s.id === scope.season_id) || null;
            
            if (selectedSeason) {
              console.log("[SeasonContext] Using league season:", selectedSeason.annee);
            }
          }
        }

        // 3. PRIORITÉ #2 : localStorage (seulement si pas de ligue)
        if (!selectedSeason) {
          const storedSeasonId = localStorage.getItem("selectedSeasonId");
          if (storedSeasonId && seasonsData) {
            selectedSeason = seasonsData.find(s => s.id === storedSeasonId) || null;
            if (selectedSeason) {
              console.log("[SeasonContext] Using localStorage season:", selectedSeason.annee);
            }
          }
        }

        // 4. PRIORITÉ #3 : Saison avec phase active
        if (!selectedSeason && seasonsData) {
          const { data: activePhaseData } = await supabase
            .from("phases")
            .select("id, saison_id")
            .eq("statut", "active")
            .order("date_debut", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activePhaseData) {
            selectedSeason = seasonsData.find(s => s.id === activePhaseData.saison_id) || null;
            if (selectedSeason) {
              console.log("[SeasonContext] Using active phase season:", selectedSeason.annee);
            }
          }
        }

        // 5. FALLBACK : Saison la plus récente (seulement en dernier recours)
        if (!selectedSeason && seasonsData && seasonsData.length > 0) {
          selectedSeason = seasonsData[0];
          console.log("[SeasonContext] Fallback to most recent season:", selectedSeason.annee);
        }

        // 6. Appliquer la sélection
        setSelectedSeasonState(selectedSeason);
        if (selectedSeason) {
          localStorage.setItem("selectedSeasonId", selectedSeason.id);
        }
        
      } catch (error) {
        console.error("[SeasonContext] Error loading seasons:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSeasonsAndSelect();
  }, [leagueId]);

  // Load phases when season changes
  useEffect(() => {
    const loadPhases = async () => {
      if (!selectedSeason) {
        setPhases([]);
        setActivePhase(null);
        return;
      }

      try {
        const { data: phasesData, error } = await supabase
          .from("phases")
          .select("*")
          .eq("saison_id", selectedSeason.id)
          .order("index_dans_saison", { ascending: true });

        if (error) throw error;
        setPhases(phasesData || []);

        // Find active phase for this season
        const active = phasesData?.find(p => p.statut === "active") || null;
        
        // If no active phase, use most recent
        if (!active && phasesData && phasesData.length > 0) {
          setActivePhase(phasesData[phasesData.length - 1]);
        } else {
          setActivePhase(active);
        }
      } catch (error) {
        console.error("Error loading phases:", error);
      }
    };

    loadPhases();
  }, [selectedSeason]);


  // Persist season selection
  const setSelectedSeason = (season: Season | null) => {
    console.log("[SeasonContext] setSelectedSeason:", season?.id, season?.annee);
    setSelectedSeasonState(season);
    if (season) {
      localStorage.setItem("selectedSeasonId", season.id);
    } else {
      localStorage.removeItem("selectedSeasonId");
    }
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
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
};
