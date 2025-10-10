import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuctionManager } from "@/components/admin/AuctionManager";
import { RoundManager } from "@/components/admin/RoundManager";
import { AnnouncementManager } from "@/components/admin/AnnouncementManager";
import { RecentResults } from "@/components/admin/RecentResults";
import { SeasonManager } from "@/components/admin/SeasonManager";
import { MaintenanceTabs } from "@/components/admin/MaintenanceTabs";
import { ManagerSponsorsManager } from "@/components/admin/ManagerSponsorsManager";
import { JerseyManager } from "@/components/admin/JerseyManager";
import { DataManagementTabs } from "@/components/admin/DataManagementTabs";
import { cn } from "@/lib/utils";

  const adminTabs = [
    { label: 'Résultats', path: 'results' },
    { label: 'Enchères', path: 'encheres' },
    { label: 'Données', path: 'data' },
    { label: 'Saisons', path: 'seasons' },
    { label: 'Maillots', path: 'jerseys' },
    { label: 'Maintenance', path: 'maintenance' },
  ];

export const AdminPage = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname.includes(`/dashboard/admin/${path}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-0">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 px-2 sm:px-0 hide-scrollbar">
        {adminTabs.map((tab) => (
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
        <Route index element={<Navigate to="/dashboard/admin/results" replace />} />
        
        <Route path="data" element={<DataManagementTabs />} />
        
        <Route path="encheres" element={
          <div className="space-y-6">
            <RoundManager />
            <AuctionManager />
            <AnnouncementManager />
          </div>
        } />
        
        <Route path="results" element={<RecentResults />} />
        <Route path="seasons" element={
          <div className="space-y-6">
            <SeasonManager />
            <ManagerSponsorsManager />
          </div>
        } />
        <Route path="jerseys" element={<JerseyManager />} />
        <Route path="maintenance" element={<MaintenanceTabs />} />
      </Routes>
    </div>
  );
};
