import { useNavigate } from "react-router-dom";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { PageContainer } from "@/components/layout/PageContainer";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { LeagueCard } from "@/components/dashboard/LeagueCard";
import { RecentRacesWidget } from "@/components/dashboard/RecentRacesWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

export default function DashboardHome() {
  const navigate = useNavigate();
  const { setLeagueId } = useLeague();
  const { leagues, isLoading } = useUserLeagues();

  const handleViewLeagueDetails = (leagueId: string) => {
    setLeagueId(leagueId);
    navigate('/dashboard/classement');
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Quick Actions */}
        <QuickActions />

        {/* My Leagues Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold">Mes Ligues</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune ligue</h3>
              <p className="text-muted-foreground mb-4">
                Créez votre première ligue ou rejoignez-en une pour commencer
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map((league) => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  onViewDetails={() => handleViewLeagueDetails(league.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Races Widget */}
        <div className="max-w-2xl">
          <RecentRacesWidget />
        </div>
      </div>
    </PageContainer>
  );
}
