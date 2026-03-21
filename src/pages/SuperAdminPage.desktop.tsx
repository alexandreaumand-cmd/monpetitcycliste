import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Trophy, FileText, Database, Users, Shield, Calendar, UserCircle, BarChart, Gift, Swords, ChevronDown, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataManagementTabs } from "@/components/admin/DataManagementTabs";
import { SuperAdminLeaguesPage } from "@/pages/admin/SuperAdminLeaguesPage";
import { LeagueDetailPage } from "@/pages/admin/LeagueDetailPage";
import UsersManagementPage from "@/pages/admin/UsersManagementPage";
import { CourseManagementTabs } from "@/components/admin/CourseManagementTabs";
import { SuperAdminHeader } from "@/components/admin/SuperAdminHeader";
import { CoursesManager } from "@/components/admin/CoursesManager";
import { CoureursManager } from "@/components/admin/CoureursManager";
import { EquipesSaisonsManager } from "@/components/admin/EquipesSaisonsManager";
import { BaremesManager } from "@/components/admin/BaremesManager";
import { PointsLedgerTable } from "@/components/admin/PointsLedgerTable";
import { SuperAdminBonusPage } from "@/pages/admin/SuperAdminBonusPage";
import { StartlistHub } from "@/components/admin/StartlistHub";
import { PronosticDeadlinesManager } from "@/components/admin/arena/PronosticDeadlinesManager";
import { SuperAdminLiveBroadcastPage } from "@/pages/admin/SuperAdminLiveBroadcastPage";
import { PhaseAuctionSchedule } from "@/components/admin/PhaseAuctionSchedule";

interface NavGroup {
  label: string;
  emoji: string;
  items: { label: string; path: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Courses & Résultats",
    emoji: "📊",
    items: [
      { label: "Résultats", path: "results", icon: Trophy },
      { label: "Bonus", path: "bonus", icon: Gift },
      { label: "Courses", path: "courses", icon: Calendar },
      { label: "Barèmes", path: "baremes", icon: BarChart },
    ],
  },
  {
    label: "Coureurs & Équipes",
    emoji: "👥",
    items: [
      { label: "Coureurs", path: "coureurs", icon: UserCircle },
      { label: "Équipes", path: "equipes", icon: Users },
      { label: "Startlists", path: "startlists", icon: FileText },
    ],
  },
  {
    label: "Ligues & Arène",
    emoji: "🏆",
    items: [
      { label: "Ligues", path: "leagues", icon: Users },
      { label: "Utilisateurs", path: "users", icon: Shield },
      { label: "Arène", path: "arena", icon: Swords },
      { label: "Live Broadcast", path: "live-broadcast", icon: Radio },
    ],
  },
  {
    label: "Données & Maintenance",
    emoji: "⚙️",
    items: [
      { label: "Import / Export", path: "data", icon: Database },
      { label: "Points Ledger", path: "points-ledger", icon: Database },
    ],
  },
];

interface SuperAdminPageDesktopProps {
  manager: any;
  onSignOut: () => void;
}

export const SuperAdminPageDesktop = ({ manager, onSignOut }: SuperAdminPageDesktopProps) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.includes(`/dashboard/super-admin/${path}`);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isActive(item.path));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SuperAdminHeader manager={manager} onSignOut={onSignOut} />

      <div className="flex flex-1">
        <aside className="w-64 border-r bg-card flex flex-col">
          <div className="p-6 border-b">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Super Admin</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Interface de gestion</p>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navGroups.map((group) => (
              <Collapsible key={group.label} defaultOpen={isGroupActive(group)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50">
                  <span className="flex items-center gap-2">
                    <span>{group.emoji}</span>
                    <span>{group.label}</span>
                  </span>
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={`/dashboard/super-admin/${item.path}`}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all ml-2",
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
                </CollapsibleContent>
              </Collapsible>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-auto bg-background">
          <div className="container mx-auto p-6">
            <Routes>
              <Route index element={<Navigate to="/dashboard/super-admin/results" replace />} />
              <Route path="results" element={<CourseManagementTabs />} />
              <Route path="bonus" element={<SuperAdminBonusPage />} />
              <Route path="courses" element={<CoursesManager />} />
              <Route path="baremes" element={<BaremesManager />} />
              <Route path="coureurs" element={<CoureursManager />} />
              <Route path="equipes" element={<EquipesSaisonsManager />} />
              <Route path="startlists" element={<StartlistHub />} />
              <Route path="leagues" element={<SuperAdminLeaguesPage />} />
              <Route path="leagues/:id" element={<LeagueDetailPage />} />
              <Route path="users" element={<UsersManagementPage />} />
              <Route path="arena" element={<PronosticDeadlinesManager />} />
              <Route path="live-broadcast" element={<SuperAdminLiveBroadcastPage />} />
              <Route path="data" element={<DataManagementTabs />} />
              <Route path="points-ledger" element={<PointsLedgerTable />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};
