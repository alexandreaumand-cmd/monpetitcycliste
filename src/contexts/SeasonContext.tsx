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

  // Load seasons and set season from league
  useEffect(() => {
    // Wait for LeagueContext to be ready
    if (leagueLoading) return;

    const loadSeasons = async () => {
      try {
        setIsLoading(true);

        // Fetch all seasons
        const { data: seasonsData, error: seasonsError } = await supabase
          .from("saisons")
          .select("id, annee")
          .order("annee", { ascending: false });

        if (seasonsError) throw seasonsError;
        setSeasons(seasonsData || []);

        // If no leagueId (SuperAdmin mode), use most recent season
        if (!leagueId) {
          console.log("[SeasonContext] No leagueId - SuperAdmin mode, using most recent season");
          if (seasonsData && seasonsData.length > 0) {
            setSelectedSeasonState(seasonsData[0]); // Most recent season (ordered desc)
            setIsLeagueSeason(false);
          }
          setIsLoading(false);
          return;
        }

        // Load league's season (Manager mode)
        const { data: scopeData } = await supabase
          .from("league_scopes")
          .select("season_id")
          .eq("league_id", leagueId)
          .maybeSingle();

        if (!scopeData?.season_id) {
          console.error("[SeasonContext] League has no season configured");
          setIsLoading(false);
          return;
        }

        const season = seasonsData?.find(s => s.id === scopeData.season_id);
        if (!season) {
          console.error("[SeasonContext] Season not found");
          setIsLoading(false);
          return;
        }

        console.log("[SeasonContext] Loading season from league:", season.annee);
        setSelectedSeasonState(season);
        setIsLeagueSeason(true);

      } catch (error) {
        console.error("Error loading seasons:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSeasons();
  }, [leagueId, leagueLoading]);

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

        // Trouver la phase active basée sur le calendrier
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Phase en cours (today entre date_debut et date_fin)
        const currentPhase = phasesData?.find(p => 
          p.date_debut <= today && today <= p.date_fin
        );
        
        if (currentPhase) {
          setActivePhase(currentPhase);
        } else {
          // Sinon, prochaine phase à venir
          const nextPhase = phasesData?.find(p => p.date_debut > today);
          if (nextPhase) {
            setActivePhase(nextPhase);
          } else {
            // Sinon, dernière phase (saison terminée)
            setActivePhase(phasesData?.[phasesData.length - 1] || null);
          }
        }
      } catch (error) {
        console.error("Error loading phases:", error);
      }
    };

    loadPhases();
  }, [selectedSeason]);

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
