import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminLeaguePicker } from "@/components/admin/AdminLeaguePicker";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useUserRole } from "@/hooks/useUserRole";
import { useLeague } from "@/contexts/LeagueContext";
import { AlertCircle } from "lucide-react";

export function LeaguesAdminPage() {
  const navigate = useNavigate();
  const { leagues, roles, isLoading } = useUserLeagues();
  const { isSuperAdmin, isLeagueAdminOnly } = useUserRole();
  const { leagueId } = useLeague();

  // Auto-redirect league admins to their league detail page
  useEffect(() => {
    if (!isLoading && isLeagueAdminOnly && !isSuperAdmin) {
      const adminLeagues = leagues.filter((l) =>
        ["owner", "admin"].includes(roles[l.id])
      );
      
      // If league admin has exactly one league, redirect to it
      if (adminLeagues.length === 1) {
        navigate(`/dashboard/admin/leagues/${adminLeagues[0].id}`, { replace: true });
      }
    }
  }, [isLoading, isLeagueAdminOnly, isSuperAdmin, leagues, roles, navigate]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Pour les admins de ligue (non super admins)
  if (!isLoading && isLeagueAdminOnly && !isSuperAdmin) {
    // Si une ligue est sélectionnée, rediriger vers sa page de détail
    if (leagueId) {
      navigate(`/dashboard/admin/leagues/${leagueId}`, { replace: true });
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-pulse text-muted-foreground">Redirection...</div>
        </div>
      );
    }
    
    // Si aucune ligue sélectionnée, afficher un message
    return (
      <div className="space-y-6 p-3 sm:p-0">
        <Card>
          <CardHeader>
            <CardTitle>Sélection de ligue requise</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Veuillez sélectionner une ligue depuis le sélecteur de ligue principal pour accéder à l'administration.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show picker for superadmins or league admins with multiple leagues
  return (
    <div className="space-y-6 p-3 sm:p-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration des ligues</h1>
        <p className="text-muted-foreground mt-1">
          Gérez les paramètres et membres de vos ligues
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une ligue</CardTitle>
          <CardDescription>
            Choisissez la ligue que vous souhaitez administrer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLeaguePicker />
        </CardContent>
      </Card>
    </div>
  );
}
