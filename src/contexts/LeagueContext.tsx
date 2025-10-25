import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

type LeagueContextType = {
  leagueId: string | null;
  setLeagueId: (id: string) => void;
  isLegacy: boolean;
  isLoading: boolean;
};

const LeagueContext = createContext<LeagueContextType>({
  leagueId: null,
  setLeagueId: () => {},
  isLegacy: true,
  isLoading: true,
});

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [leagueId, setLeagueIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initLeague = () => {
      setIsLoading(true);

      // Only check URL param - no localStorage, no Legacy fallback
      const fromUrl = searchParams.get("leagueId");
      setLeagueIdState(fromUrl);
      
      setIsLoading(false);
    };

    initLeague();
  }, [searchParams]);

  // Invalidate all queries when league changes
  useEffect(() => {
    if (!isLoading && leagueId) {
      queryClient.invalidateQueries();
    }
  }, [leagueId, isLoading, queryClient]);

  const setLeagueId = (id: string) => {
    setLeagueIdState(id);

    // Update URL param only
    const params = new URLSearchParams(searchParams);
    params.set("leagueId", id);
    navigate({ search: params.toString() }, { replace: true });
  };

  const isLegacy = leagueId === 'f7921741-29f4-4296-9aca-a03c1f3615b0';

  return (
    <LeagueContext.Provider value={{ leagueId, setLeagueId, isLegacy, isLoading }}>
      {children}
    </LeagueContext.Provider>
  );
}

export const useLeague = () => {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error('useLeague must be used within LeagueProvider');
  }
  return context;
};
