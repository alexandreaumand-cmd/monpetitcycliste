import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Fetch user leagues directly in context to avoid circular dependency
  const { data: userLeagues, isLoading: leaguesLoading } = useQuery({
    queryKey: ['user-leagues-for-context'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: memberships } = await supabase
        .from('league_members')
        .select(`
          league_id,
          leagues:league_id (
            id,
            name,
            status
          )
        `)
        .eq('user_id', user.id);

      return (memberships || [])
        .filter(m => m.leagues)
        .map(m => m.leagues as { id: string; name: string; status: string });
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (leaguesLoading) return;

    const fromUrl = searchParams.get("leagueId");

    if (fromUrl) {
      // URL has priority - use it
      setLeagueIdState(fromUrl);
      setIsLoading(false);
      setHasAutoSelected(false);
    } else if (userLeagues && userLeagues.length > 0 && !hasAutoSelected) {
      // No URL param - auto-select first active league
      const activeLeagues = userLeagues.filter(l => l.status !== 'completed');
      const defaultLeague = activeLeagues[0] || userLeagues[0];

      if (defaultLeague) {
        // Update URL with default league
        const params = new URLSearchParams(searchParams);
        params.set("leagueId", defaultLeague.id);
        navigate({ search: params.toString() }, { replace: true });
        setLeagueIdState(defaultLeague.id);
        setHasAutoSelected(true);
      }
      setIsLoading(false);
    } else if (!leaguesLoading) {
      // No leagues available
      setIsLoading(false);
    }
  }, [searchParams, userLeagues, leaguesLoading, navigate, hasAutoSelected]);

  // Invalidate all queries when league changes
  useEffect(() => {
    if (!isLoading && leagueId) {
      queryClient.invalidateQueries();
    }
  }, [leagueId, isLoading, queryClient]);

  const setLeagueId = (id: string) => {
    setLeagueIdState(id);
    setHasAutoSelected(false);

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
