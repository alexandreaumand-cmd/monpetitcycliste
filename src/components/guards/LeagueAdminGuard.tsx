import { ReactNode } from "react";
import { useUserLeagues } from "@/hooks/useUserLeagues";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

export function LeagueAdminGuard({
  leagueId,
  children,
}: {
  leagueId: string;
  children: ReactNode;
}) {
  const { roles, isLoading } = useUserLeagues();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }
  
  const role = roles[leagueId];
  
  if (!role || !["owner", "admin"].includes(role)) {
    return (
      <Alert variant="destructive" className="m-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Accès refusé — Vous devez être propriétaire ou administrateur de cette ligue.
        </AlertDescription>
      </Alert>
    );
  }
  
  return <>{children}</>;
}
