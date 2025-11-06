import { useEffect, useState } from "react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AuctionsList } from "@/components/auction/AuctionsList";
import { MyTeam } from "@/components/team/MyTeam";
import { UpcomingCourses } from "@/components/courses/UpcomingCourses";
import { ResultsPage } from "./ResultsPage";
import Rankings from "./Rankings";
import { AdminPage } from "./AdminPage";
import Startlist from "./Startlist";
import Statistics from "./Statistics";
import AccountPage from "./AccountPage";
import DashboardHome from "./DashboardHome";
import { LeagueDetailPage } from "./admin/LeagueDetailPage";
import { SuperAdminPage } from "./SuperAdminPage";
import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);
  const { isSuperAdmin, isLeagueAdminOnly, loading: roleLoading } = useUserRole();
  const isAnyAdmin = isSuperAdmin || isLeagueAdminOnly;
  
  const isHomePage = location.pathname === '/dashboard/home' || location.pathname === '/dashboard';
  const isSuperAdminRoute = location.pathname.includes('/dashboard/super-admin');

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: managerData } = await supabase
        .from("managers")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      setManager(managerData);
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // SuperAdmin layout (isolé)
  if (isSuperAdminRoute && isSuperAdmin) {
    return (
      <>
        <AnnouncementBanner />
        <SuperAdminGuard>
          <Routes>
            <Route 
              path="super-admin/*" 
              element={
                <SuperAdminPage 
                  manager={manager} 
                  onSignOut={handleSignOut} 
                />
              } 
            />
          </Routes>
        </SuperAdminGuard>
      </>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <>
        <AnnouncementBanner />
        <MobileLayout
          manager={manager}
          isAdmin={isAnyAdmin}
          onSignOut={handleSignOut}
        >
          <Routes>
            <Route index element={<Navigate to="/dashboard/home" replace />} />
            <Route path="home" element={<DashboardHome onSignOut={handleSignOut} manager={manager} />} />
            <Route path="encheres" element={manager && <AuctionsList managerId={manager.id} />} />
            <Route path="mon-equipe" element={<MyTeam />} />
            <Route path="courses" element={<UpcomingCourses />} />
            <Route path="resultats" element={<ResultsPage />} />
            <Route path="classement" element={<Rankings />} />
            <Route path="statistiques" element={<Statistics />} />
            <Route path="startlist" element={<Startlist />} />
            <Route path="compte" element={<AccountPage />} />
            <Route path="leagues/:id/admin" element={<LeagueDetailPage />} />
            {isSuperAdmin && (
              <Route 
                path="super-admin/*" 
                element={
                  <SuperAdminGuard>
                    <SuperAdminPage manager={manager} onSignOut={handleSignOut} />
                  </SuperAdminGuard>
                } 
              />
            )}
            {isAnyAdmin && <Route path="admin/*" element={<AdminPage />} />}
          </Routes>
        </MobileLayout>
      </>
    );
  }

  // Desktop layout with sidebar
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        {!isHomePage && !isSuperAdminRoute && (
          <AppSidebar 
            isAdmin={isAnyAdmin} 
            isSuperAdmin={isSuperAdmin}
            isLeagueAdminOnly={isLeagueAdminOnly}
          />
        )}
        <SidebarInset className="flex-1 flex flex-col">
          <AnnouncementBanner />
          {!isSuperAdminRoute && (
            <TopBar 
              onSignOut={handleSignOut}
              manager={manager}
              isAdmin={isAnyAdmin}
            />
          )}
          <main className={cn(
            "flex-1 container mx-auto px-4 pb-8",
            isHomePage ? "pt-0" : "pt-0"
          )}>
            <Routes>
              <Route index element={<Navigate to="/dashboard/home" replace />} />
              <Route path="home" element={<DashboardHome onSignOut={handleSignOut} manager={manager} />} />
              <Route path="encheres" element={manager && <AuctionsList managerId={manager.id} />} />
              <Route path="mon-equipe" element={<MyTeam />} />
              <Route path="courses" element={<UpcomingCourses />} />
              <Route path="resultats" element={<ResultsPage />} />
              <Route path="classement" element={<Rankings />} />
              <Route path="statistiques" element={<Statistics />} />
            <Route path="startlist" element={<Startlist />} />
            <Route path="compte" element={<AccountPage />} />
            <Route path="leagues/:id/admin" element={<LeagueDetailPage />} />
            {isSuperAdmin && (
              <Route 
                path="super-admin/*" 
                element={
                  <SuperAdminGuard>
                    <SuperAdminPage manager={manager} onSignOut={handleSignOut} />
                  </SuperAdminGuard>
                } 
              />
            )}
            {isAnyAdmin && <Route path="admin/*" element={<AdminPage />} />}
          </Routes>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
