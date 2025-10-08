import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [selectedSeason, setSelectedSeasonState] = useState<Season | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load seasons and set initial selection
  useEffect(() => {
    const loadSeasons = async () => {
      try {
        // Fetch all seasons
        const { data: seasonsData, error: seasonsError } = await supabase
          .from("saisons")
          .select("id, annee")
          .order("annee", { ascending: false });

        if (seasonsError) throw seasonsError;
        setSeasons(seasonsData || []);

        // Try to get season from localStorage
        const storedSeasonId = localStorage.getItem("selectedSeasonId");
        let initialSeason: Season | null = null;

        if (storedSeasonId && seasonsData) {
          initialSeason = seasonsData.find(s => s.id === storedSeasonId) || null;
        }

        // If no stored season, try to find season with active phase
        if (!initialSeason && seasonsData) {
          const { data: activePhaseData } = await supabase
            .from("phases")
            .select("id, saison_id")
            .eq("statut", "active")
            .order("date_debut", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activePhaseData) {
            initialSeason = seasonsData.find(s => s.id === activePhaseData.saison_id) || null;
          }
        }

        // If still no season, use most recent
        if (!initialSeason && seasonsData && seasonsData.length > 0) {
          initialSeason = seasonsData[0];
        }

        setSelectedSeasonState(initialSeason);
      } catch (error) {
        console.error("Error loading seasons:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSeasons();
  }, []);

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
