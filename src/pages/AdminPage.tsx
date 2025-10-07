import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataImport } from "@/components/admin/DataImport";
import { CoursesImportManager } from "@/components/admin/CoursesImportManager";
import { CoursesResetManager } from "@/components/admin/CoursesResetManager";
import { RoundManager } from "@/components/admin/RoundManager";
import { AnnouncementManager } from "@/components/admin/AnnouncementManager";
import { RecentResults } from "@/components/admin/RecentResults";
import { SeasonManager } from "@/components/admin/SeasonManager";
import { MaintenancePanel } from "@/components/admin/MaintenancePanel";
import { PointsComputeManager } from "@/components/admin/PointsComputeManager";
import { StagesRaceManager } from "@/components/admin/StagesRaceManager";
import { cn } from "@/lib/utils";

const adminTabs = [
  { label: 'Données', path: 'data' },
  { label: 'Enchères', path: 'encheres' },
  { label: 'Résultats', path: 'results' },
  { label: 'Saisons', path: 'seasons' },
  { label: 'Maintenance', path: 'maintenance' },
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Importer des données CSV</CardTitle>
              </CardHeader>
              <CardContent>
                <DataImport />
              </CardContent>
            </Card>
            <CoursesResetManager />
            <CoursesImportManager />
            <PointsComputeManager />
          </div>
        } />
        
        <Route path="encheres" element={
          <div className="space-y-6">
            <RoundManager />
            <AnnouncementManager />
          </div>
        } />
        
        <Route path="results" element={<RecentResults />} />
        <Route path="seasons" element={<SeasonManager />} />
        <Route path="maintenance" element={<MaintenancePanel />} />
      </Routes>
    </div>
  );
};
