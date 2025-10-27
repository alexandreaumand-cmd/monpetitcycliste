import { Routes, Route, Navigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { GameManagementTabs } from "@/components/admin/GameManagementTabs";
import { LeaguesAdminPage } from "@/pages/admin/LeaguesAdminPage";
import { LeagueDetailPage } from "@/pages/admin/LeagueDetailPage";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Loader2 } from "lucide-react";

const allTabs = [
  { label: '🎮 Enchères', path: 'encheres', superAdminOnly: false },
  { label: '🏆 Ligues', path: 'leagues', superAdminOnly: false },
];

export const AdminPage = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isSuperAdmin, isLeagueAdminOnly, loading } = useUserRole();
  
  const leagueId = searchParams.get('leagueId');
  const preserveLeagueParam = leagueId ? `?leagueId=${leagueId}` : '';

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Vérification des permissions...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin && !isLeagueAdminOnly) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <strong>Accès refusé</strong>
            <p className="mt-1 text-sm">Cette interface est réservée aux administrateurs de ligue.</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const visibleTabs = isSuperAdmin 
    ? allTabs 
    : allTabs.filter(tab => !tab.superAdminOnly);
  
  const isActive = (path: string) => {
    return location.pathname.includes(`/dashboard/admin/${path}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-0">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 px-2 sm:px-0 hide-scrollbar">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.path}
            to={`/dashboard/admin/${tab.path}`}
            className={cn(
              "flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all touch-target",
              "active:scale-95",
              isActive(tab.path)
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted/70"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Routes>
        <Route 
          index 
          element={
            <Navigate 
              to={`/dashboard/admin/encheres${preserveLeagueParam}`}
              replace 
            />
          } 
        />
        
        <Route path="encheres" element={<GameManagementTabs />} />
        <Route path="leagues" element={<LeaguesAdminPage />} />
        <Route path="leagues/:id" element={<LeagueDetailPage />} />
        
        {isLeagueAdminOnly && (
          <Route 
            path="*" 
            element={<Navigate to="/dashboard/admin/leagues" replace />} 
          />
        )}
      </Routes>
    </div>
  );
};
