import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { LeagueCard } from "@/components/dashboard/LeagueCard";
import { RecentResultsWidget } from "@/components/dashboard/RecentResultsWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Archive, ChevronDown, ChevronUp } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { DashboardHomeHeader } from "@/components/dashboard/DashboardHomeHeader";

interface DashboardHomeProps {
  onSignOut: () => void;
  manager: any;
}

export default function DashboardHome({ onSignOut, manager }: DashboardHomeProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { setLeagueId } = useLeague();
  const { leagues, isLoading } = useUserLeagues();
  const { isSuperAdmin, isLeagueAdminOnly } = useUserRole();
  const [searchParams] = useSearchParams();
  const currentLeagueId = searchParams.get('leagueId');
  const isAnyAdmin = isSuperAdmin || isLeagueAdminOnly;
  const [showArchived, setShowArchived] = useState(false);

  const activeLeagues = leagues.filter(league => league.status !== 'completed');
  const completedLeagues = leagues.filter(league => league.status === 'completed');

  const buildNavUrl = (path: string) => {
    return currentLeagueId ? `${path}?leagueId=${currentLeagueId}` : path;
  };

  const handleViewLeagueDetails = (leagueId: string, hasActiveAuction?: boolean) => {
    setLeagueId(leagueId);
    if (hasActiveAuction) {
      navigate(`/dashboard/encheres?leagueId=${leagueId}`);
    } else {
      navigate(`/dashboard/classement?leagueId=${leagueId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-yellow-50/30">
      <DashboardHomeHeader
        manager={manager}
        isAnyAdmin={isAnyAdmin}
        isSuperAdmin={isSuperAdmin}
        onSignOut={onSignOut}
        onNavigateAdmin={() => navigate(buildNavUrl('/dashboard/super-admin'))}
      />

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Quick Actions */}
        <QuickActions />

        {/* My Leagues Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#FFD500]" />
            <h2 className="text-2xl font-montserrat font-semibold">{t('myLeagues.title')}</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : leagues.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-card">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('myLeagues.noLeagues')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('myLeagues.noLeaguesDescription')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeLeagues.map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    onViewDetails={(hasActiveAuction) => handleViewLeagueDetails(league.id, hasActiveAuction)}
                  />
                ))}
              </div>

              {/* Ligues terminées - Section pliable */}
              {completedLeagues.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Archive className="h-4 w-4" />
                    <span>Ligues terminées ({completedLeagues.length})</span>
                    {showArchived ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  
                  {showArchived && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                      {completedLeagues.map((league) => (
                        <LeagueCard
                          key={league.id}
                          league={league}
                          onViewDetails={() => handleViewLeagueDetails(league.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Recent Results Widget */}
        <div className="w-full">
          <RecentResultsWidget />
        </div>
      </div>
    </div>
  );
}
