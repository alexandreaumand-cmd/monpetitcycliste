import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CourseManagementTabs } from "@/components/admin/CourseManagementTabs";
import { GameManagementTabs } from "@/components/admin/GameManagementTabs";
import { ConfigurationTabs } from "@/components/admin/ConfigurationTabs";
import { MaintenanceTabs } from "@/components/admin/MaintenanceTabs";
import { LeaguesAdminPage } from "@/pages/admin/LeaguesAdminPage";
import { LeagueDetailPage } from "@/pages/admin/LeagueDetailPage";
import { cn } from "@/lib/utils";

  const adminTabs = [
    { label: '🏁 Courses', path: 'courses' },
    { label: '🎮 Enchères', path: 'encheres' },
    { label: '🏆 Ligues', path: 'leagues' },
    { label: '⚙️ Configuration', path: 'config' },
    { label: '🔧 Maintenance', path: 'maintenance' },
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
        <Route index element={<Navigate to="/dashboard/admin/courses" replace />} />
        
        <Route path="courses" element={<CourseManagementTabs />} />
        <Route path="encheres" element={<GameManagementTabs />} />
        <Route path="leagues" element={<LeaguesAdminPage />} />
        <Route path="leagues/:id" element={<LeagueDetailPage />} />
        <Route path="config" element={<ConfigurationTabs />} />
        <Route path="maintenance" element={<MaintenanceTabs />} />
      </Routes>
    </div>
  );
};
