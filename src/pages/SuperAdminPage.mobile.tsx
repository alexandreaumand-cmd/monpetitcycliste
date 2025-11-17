import { useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { Trophy, FileText, Database, Users, Shield, Calendar, UserCircle, BarChart, Menu, LogOut, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataManagementTabs } from "@/components/admin/DataManagementTabs";
import { SuperAdminLeaguesPage } from "@/pages/admin/SuperAdminLeaguesPage";
import { LeagueDetailPage } from "@/pages/admin/LeagueDetailPage";
import UsersManagementPage from "@/pages/admin/UsersManagementPage";
import { StartlistImportManager } from "@/components/admin/StartlistImportManager";
import { CourseManagementTabs } from "@/components/admin/CourseManagementTabs";
import { CoursesManager } from "@/components/admin/CoursesManager";
import { CoureursManager } from "@/components/admin/CoureursManager";
import { EquipesSaisonsManager } from "@/components/admin/EquipesSaisonsManager";
import { BaremesManager } from "@/components/admin/BaremesManager";
import { PointsLedgerTable } from "@/components/admin/PointsLedgerTable";
import mpcLogo from "@/assets/mpc-logo-horizontal.png";

const superAdminNavItems = [
  { label: 'Résultats', path: 'results', icon: Trophy },
  { label: 'Courses', path: 'courses', icon: Calendar },
  { label: 'Coureurs', path: 'coureurs', icon: UserCircle },
  { label: 'Équipes', path: 'equipes', icon: Users },
  { label: 'Barèmes', path: 'baremes', icon: BarChart },
  { label: 'Points Ledger', path: 'points-ledger', icon: Database },
  { label: 'Startlists', path: 'startlists', icon: FileText },
  { label: 'Données', path: 'data', icon: Database },
  { label: 'Ligues', path: 'leagues', icon: Users },
  { label: 'Utilisateurs', path: 'users', icon: Shield },
];

interface SuperAdminPageMobileProps {
  manager: any;
  onSignOut: () => void;
}

export const SuperAdminPageMobile = ({ manager, onSignOut }: SuperAdminPageMobileProps) => {
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
    const currentItem = superAdminNavItems.find(item => isActive(item.path));
    return currentItem?.label || "Super Admin";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
        <div className="flex h-14 items-center gap-2 px-4">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="touch-target shrink-0"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Ouvrir le menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="p-6 border-b">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  <SheetTitle>Super Admin</SheetTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Interface de gestion</p>
              </SheetHeader>

              {/* Manager Info */}
              <div className="p-4 border-b bg-muted/30">
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

              {/* Navigation */}
              <nav className="p-3 space-y-1">
                {superAdminNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.path}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-3 h-11",
                        isActive(item.path)
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                })}
              </nav>

              {/* Back to Dashboard & Logout */}
              <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-background space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    navigate("/dashboard");
                    setSheetOpen(false);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour au Dashboard
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    onSignOut();
                    setSheetOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo & Page Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link to="/dashboard/home" className="shrink-0">
              <img 
                src={mpcLogo} 
                alt="Logo Mon Petit Cycliste" 
                className="h-7 w-auto"
              />
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
            <Route path="courses" element={<CoursesManager />} />
            <Route path="coureurs" element={<CoureursManager />} />
            <Route path="equipes" element={<EquipesSaisonsManager />} />
              <Route path="baremes" element={<BaremesManager />} />
              <Route path="points-ledger" element={<PointsLedgerTable />} />
              <Route path="startlists" element={<StartlistImportManager />} />
            <Route path="data" element={<DataManagementTabs />} />
            <Route path="leagues" element={<SuperAdminLeaguesPage />} />
            <Route path="leagues/:id" element={<LeagueDetailPage />} />
            <Route path="users" element={<UsersManagementPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};
