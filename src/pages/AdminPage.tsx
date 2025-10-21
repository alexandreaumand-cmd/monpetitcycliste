import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { CourseManagementTabs } from "@/components/admin/CourseManagementTabs";
import { GameManagementTabs } from "@/components/admin/GameManagementTabs";
import { ConfigurationTabs } from "@/components/admin/ConfigurationTabs";
import { MaintenanceTabs } from "@/components/admin/MaintenanceTabs";
import { LeaguesAdminPage } from "@/pages/admin/LeaguesAdminPage";
import { LeagueDetailPage } from "@/pages/admin/LeagueDetailPage";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

const allTabs = [
  { label: '🏁 Courses', path: 'courses', superAdminOnly: true },
  { label: '🎮 Enchères', path: 'encheres', superAdminOnly: false },
  { label: '🏆 Ligues', path: 'leagues', superAdminOnly: false },
  { label: '⚙️ Configuration', path: 'config', superAdminOnly: true },
  { label: '🔧 Maintenance', path: 'maintenance', superAdminOnly: true },
];

export const AdminPage = () => {
  const location = useLocation();
  const { isSuperAdmin, isLeagueAdminOnly } = useUserRole();
  
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
              to={isSuperAdmin ? "/dashboard/admin/courses" : "/dashboard/admin/leagues"} 
              replace 
            />
          } 
        />
        
        {isSuperAdmin && (
          <>
            <Route path="courses" element={<CourseManagementTabs />} />
            <Route path="config" element={<ConfigurationTabs />} />
            <Route path="maintenance" element={<MaintenanceTabs />} />
          </>
        )}
        
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
