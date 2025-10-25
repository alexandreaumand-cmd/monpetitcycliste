import { useNavigate } from "react-router-dom";
import { useLeague } from "@/contexts/LeagueContext";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { LeagueCard } from "@/components/dashboard/LeagueCard";
import { RecentResultsWidget } from "@/components/dashboard/RecentResultsWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Users, LogOut, Settings } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import logo from "@/assets/logo.png";

interface DashboardHomeProps {
  onSignOut: () => void;
}

export default function DashboardHome({ onSignOut }: DashboardHomeProps) {
  const navigate = useNavigate();
  const { setLeagueId } = useLeague();
  const { leagues, isLoading } = useUserLeagues();
  const { isSuperAdmin } = useUserRole();

  const handleViewLeagueDetails = (leagueId: string) => {
    console.log("[DashboardHome] Navigating to league:", leagueId);
    console.log("[DashboardHome] All available leagues:", leagues.map(l => ({ id: l.id, name: l.name })));
    setLeagueId(leagueId);
    navigate('/dashboard/classement');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header minimal */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Mon Petit Cycliste" className="h-10 w-10" />
            <h1 className="text-xl font-bold">Mon Petit Cycliste</h1>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard/super-admin')}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Super Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8 space-y-6">
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
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-card">
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

        {/* Recent Results Widget */}
        <div className="w-full">
          <RecentResultsWidget />
        </div>
      </div>
    </div>
  );
}
