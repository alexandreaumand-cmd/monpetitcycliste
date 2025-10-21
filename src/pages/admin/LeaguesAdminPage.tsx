import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLeaguePicker } from "@/components/admin/AdminLeaguePicker";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { useUserRole } from "@/hooks/useUserRole";

export function LeaguesAdminPage() {
  const navigate = useNavigate();
  const { leagues, roles, isLoading } = useUserLeagues();
  const { isSuperAdmin, isLeagueAdminOnly } = useUserRole();

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

  // For league admins with one league, show loading while redirecting
  if (isLeagueAdminOnly && !isSuperAdmin) {
    const adminLeagues = leagues.filter((l) =>
      ["owner", "admin"].includes(roles[l.id])
    );
    
    if (adminLeagues.length === 1) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-pulse text-muted-foreground">Redirection...</div>
        </div>
      );
    }
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
