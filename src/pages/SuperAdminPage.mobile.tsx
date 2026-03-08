import { useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { Trophy, FileText, Database, Users, Shield, Calendar, UserCircle, BarChart, Menu, LogOut, ArrowLeft, Gift, Swords, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataManagementTabs } from "@/components/admin/DataManagementTabs";
import { SuperAdminLeaguesPage } from "@/pages/admin/SuperAdminLeaguesPage";
import { LeagueDetailPage } from "@/pages/admin/LeagueDetailPage";
import UsersManagementPage from "@/pages/admin/UsersManagementPage";
import { CourseManagementTabs } from "@/components/admin/CourseManagementTabs";
import { CoursesManager } from "@/components/admin/CoursesManager";
import { CoureursManager } from "@/components/admin/CoureursManager";
import { EquipesSaisonsManager } from "@/components/admin/EquipesSaisonsManager";
import { BaremesManager } from "@/components/admin/BaremesManager";
import { PointsLedgerTable } from "@/components/admin/PointsLedgerTable";
import { SuperAdminBonusPage } from "@/pages/admin/SuperAdminBonusPage";
import { PronosticDeadlinesManager } from "@/components/admin/arena/PronosticDeadlinesManager";
import { SuperAdminLiveBroadcastPage } from "@/pages/admin/SuperAdminLiveBroadcastPage";
import { StartlistHub } from "@/components/admin/StartlistHub";
import mpcLogo from "@/assets/mpc-logo-horizontal.png";
import { useTranslation } from "react-i18next";

interface NavSection {
  title: string;
  emoji: string;
  items: { label: string; path: string; icon: React.ElementType }[];
}

const navSections: NavSection[] = [
  {
    title: "Courses & Résultats",
    emoji: "📊",
    items: [
      { label: "Résultats", path: "results", icon: Trophy },
      { label: "Bonus", path: "bonus", icon: Gift },
      { label: "Courses", path: "courses", icon: Calendar },
      { label: "Barèmes", path: "baremes", icon: BarChart },
    ],
  },
  {
    title: "Coureurs & Équipes",
    emoji: "👥",
    items: [
      { label: "Coureurs", path: "coureurs", icon: UserCircle },
      { label: "Équipes", path: "equipes", icon: Users },
      { label: "Startlists", path: "startlists", icon: FileText },
    ],
  },
  {
    title: "Ligues & Arène",
    emoji: "🏆",
    items: [
      { label: "Ligues", path: "leagues", icon: Users },
      { label: "Utilisateurs", path: "users", icon: Shield },
      { label: "Arène", path: "arena", icon: Swords },
      { label: "Live Broadcast", path: "live-broadcast", icon: Radio },
    ],
  },
  {
    title: "Données & Maintenance",
    emoji: "⚙️",
    items: [
      { label: "Import / Export", path: "data", icon: Database },
      { label: "Points Ledger", path: "points-ledger", icon: Database },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

interface SuperAdminPageMobileProps {
  manager: any;
  onSignOut: () => void;
}

export const SuperAdminPageMobile = ({ manager, onSignOut }: SuperAdminPageMobileProps) => {
  const { t } = useTranslation("navigation");
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    return location.pathname.includes(`/dashboard/super-admin/${path}`);
  };

  const handleNavigate = (path: string) => {
    navigate(`/dashboard/super-admin/${path}`);
    setSheetOpen(false);
  };

  const getCurrentPageTitle = () => {
    const currentItem = allNavItems.find((item) => isActive(item.path));
    return currentItem?.label || "Super Admin";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
        <div className="flex h-14 items-center gap-2 px-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="touch-target shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t("menu.openMenu")}</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[280px] p-0 flex flex-col h-full">
              <SheetHeader className="p-6 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  <SheetTitle>Super Admin</SheetTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("superAdmin.interface", "Interface de gestion")}
                </p>
              </SheetHeader>

              {/* Manager Info */}
              <div className="p-4 border-b bg-muted/30 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={manager?.avatar_url} />
                    <AvatarFallback>
                      {manager?.nom_manager?.substring(0, 2).toUpperCase() || "SA"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {manager?.nom_manager || "Super Admin"}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      Super Admin
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Navigation with sections */}
              <nav className="p-3 space-y-3 flex-1 overflow-y-auto">
                {navSections.map((section) => (
                  <div key={section.title}>
                    <p className="flex items-center gap-1.5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>{section.emoji}</span>
                      <span>{section.title}</span>
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.path}
                            type="button"
                            className={cn(
                              "w-full flex items-center justify-start gap-3 h-11 px-3 rounded-md text-sm font-medium transition-colors",
                              isActive(item.path)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={() => handleNavigate(item.path)}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Back to Dashboard & Logout */}
              <div className="p-3 border-t bg-background space-y-2 flex-shrink-0">
                <button
                  type="button"
                  className="w-full flex items-center justify-start gap-2 h-10 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => {
                    setSheetOpen(false);
                    setTimeout(() => navigate("/dashboard"), 150);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("superAdmin.backToDashboard", "Retour au Dashboard")}
                </button>
                <button
                  type="button"
                  className="w-full flex items-center justify-start gap-2 h-10 px-3 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => {
                    setSheetOpen(false);
                    setTimeout(() => onSignOut(), 150);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t("logout")}
                </button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo & Page Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link to="/dashboard/home" className="shrink-0">
              <img src={mpcLogo} alt="Logo Mon Petit Cycliste" className="h-7 w-auto" />
            </Link>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-sm font-semibold truncate">{getCurrentPageTitle()}</h1>
          </div>

          {/* Admin Badge */}
          <Badge variant="secondary" className="shrink-0">
            <Shield className="h-3 w-3 mr-1" />
            SA
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-safe">
        <div className="p-4">
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
  );
};
