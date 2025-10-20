import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredLeagueId, setStoredLeagueId } from "@/lib/leagues/storage";
import { fetchLegacyLeagueId } from "@/lib/leagues/legacy";

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
  const [legacyId, setLegacyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initLeague = async () => {
      try {
        setIsLoading(true);

        // 1. Check URL param
        const fromUrl = searchParams.get("leagueId");
        if (fromUrl) {
          setLeagueIdState(fromUrl);
          setStoredLeagueId(fromUrl);
          setIsLoading(false);
          return;
        }

        // 2. Check localStorage
        const stored = getStoredLeagueId();
        if (stored) {
          setLeagueIdState(stored);
          setIsLoading(false);
          return;
        }

        // 3. Fallback to Legacy
        const legacy = await fetchLegacyLeagueId();
        setLegacyId(legacy);
        setLeagueIdState(legacy);
        setStoredLeagueId(legacy);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize league:', error);
        setIsLoading(false);
      }
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
    setStoredLeagueId(id);

    // Update URL param
    const params = new URLSearchParams(searchParams);
    params.set("leagueId", id);
    navigate({ search: params.toString() }, { replace: true });
  };

  const isLegacy = leagueId === legacyId;

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
