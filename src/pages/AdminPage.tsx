import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataImport } from "@/components/admin/DataImport";
import { RoundManager } from "@/components/admin/RoundManager";
import { AnnouncementManager } from "@/components/admin/AnnouncementManager";
import { RecentResults } from "@/components/admin/RecentResults";
import { SeasonManager } from "@/components/admin/SeasonManager";
import { cn } from "@/lib/utils";

const adminTabs = [
  { label: 'Données', path: 'data' },
  { label: 'Rounds', path: 'rounds' },
  { label: 'Annonces', path: 'annonces' },
  { label: 'Résultats', path: 'results' },
  { label: 'Saisons', path: 'seasons' },
  { label: 'Utilisateurs', path: 'users' },
];

export const AdminPage = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname.includes(`/dashboard/admin/${path}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {adminTabs.map((tab) => (
          <Link
            key={tab.path}
            to={`/dashboard/admin/${tab.path}`}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              isActive(tab.path)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Routes>
        <Route index element={<Navigate to="/dashboard/admin/data" replace />} />
        
        <Route path="data" element={
          <Card>
            <CardHeader>
              <CardTitle>Importer des données CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <DataImport />
            </CardContent>
          </Card>
        } />
        
        <Route path="rounds" element={<RoundManager />} />
        <Route path="annonces" element={<AnnouncementManager />} />
        <Route path="results" element={<RecentResults />} />
        <Route path="seasons" element={<SeasonManager />} />
        
        <Route path="users" element={
          <Card>
            <CardHeader>
              <CardTitle>Gestion des managers</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Gérer les managers</Button>
            </CardContent>
          </Card>
        } />
      </Routes>
    </div>
  );
};
