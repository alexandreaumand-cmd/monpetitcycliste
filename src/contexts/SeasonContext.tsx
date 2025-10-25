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

        // Load league's season
        if (!leagueId) {
          console.error("[SeasonContext] No leagueId available");
          return;
        }

        const { data: scopeData } = await supabase
          .from("league_scopes")
          .select("season_id")
          .eq("league_id", leagueId)
          .maybeSingle();

        if (!scopeData?.season_id) {
          console.error("[SeasonContext] League has no season configured");
          return;
        }

        const season = seasonsData?.find(s => s.id === scopeData.season_id);
        if (!season) {
          console.error("[SeasonContext] Season not found");
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
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
};
