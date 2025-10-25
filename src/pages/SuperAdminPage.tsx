import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Trophy, FileText, Database, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataManagementTabs } from "@/components/admin/DataManagementTabs";
import { SuperAdminLeaguesPage } from "@/pages/admin/SuperAdminLeaguesPage";
import { LeagueDetailPage } from "@/pages/admin/LeagueDetailPage";
import UsersManagementPage from "@/pages/admin/UsersManagementPage";
import { StartlistImportManager } from "@/components/admin/StartlistImportManager";
import { CourseManagementTabs } from "@/components/admin/CourseManagementTabs";
import { SuperAdminHeader } from "@/components/admin/SuperAdminHeader";

const superAdminNavItems = [
  { label: 'Résultats', path: 'results', icon: Trophy },
  { label: 'Startlists', path: 'startlists', icon: FileText },
  { label: 'Données', path: 'data', icon: Database },
  { label: 'Ligues', path: 'leagues', icon: Users },
  { label: 'Utilisateurs', path: 'users', icon: Shield },
];

interface SuperAdminPageProps {
  manager: any;
  onSignOut: () => void;
}

export const SuperAdminPage = ({ manager, onSignOut }: SuperAdminPageProps) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.includes(`/dashboard/super-admin/${path}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header dédié SuperAdmin */}
      <SuperAdminHeader manager={manager} onSignOut={onSignOut} />
      
      {/* Layout sidebar + content */}
      <div className="flex flex-1">
        {/* Sidebar Navigation */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Super Admin</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Interface de gestion</p>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          {superAdminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={`/dashboard/super-admin/${item.path}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="container mx-auto p-6">
          <Routes>
            <Route index element={<Navigate to="/dashboard/super-admin/results" replace />} />
            <Route path="results" element={<CourseManagementTabs />} />
            <Route path="startlists" element={<StartlistImportManager />} />
            <Route path="data" element={<DataManagementTabs />} />
            <Route path="leagues" element={<SuperAdminLeaguesPage />} />
            <Route path="leagues/:id" element={<LeagueDetailPage />} />
            <Route path="users" element={<UsersManagementPage />} />
          </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};
