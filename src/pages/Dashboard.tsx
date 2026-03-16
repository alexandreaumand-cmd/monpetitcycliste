import { useEffect } from "react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentManager } from "@/hooks/useCurrentManager";
import { useActivityTracker } from "@/hooks/useActivityTracker";
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
import RidersData from "./RidersData";
import CalendarPage from "./CalendarPage";
import { LeagueDetailPage } from "./admin/LeagueDetailPage";
import { SuperAdminPage } from "./SuperAdminPage";
import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";
import ArenaPage from "./ArenaPage";
import TeamStartlistMovements from "./TeamStartlistMovements";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Use cached hooks for manager and role
  const { data: manager, isLoading: managerLoading } = useCurrentManager();
  const { isSuperAdmin, isLeagueAdminOnly, loading: roleLoading } = useUserRole();
  const isAnyAdmin = isSuperAdmin || isLeagueAdminOnly;
  
  // Track user activity on all dashboard pages
  useActivityTracker();
  
  const isHomePage = location.pathname === '/dashboard/home' || location.pathname === '/dashboard';
  const isSuperAdminRoute = location.pathname.includes('/dashboard/super-admin');
  const isDataRoute = location.pathname === '/dashboard/data';
  const isCalendarRoute = location.pathname === '/dashboard/calendar';

  // Redirect to auth if no session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkSession();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (managerLoading || roleLoading) {
    return <LoadingSpinner />;
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
            <Route path="data" element={<RidersData />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="encheres" element={manager && <AuctionsList managerId={manager.id} />} />
            <Route path="mon-equipe" element={<MyTeam />} />
            <Route path="mon-equipe/mouvements" element={<TeamStartlistMovements />} />
            <Route path="courses" element={<UpcomingCourses />} />
            <Route path="resultats" element={<ResultsPage />} />
            <Route path="classement" element={<Rankings />} />
            <Route path="statistiques" element={<Statistics />} />
            <Route path="startlist" element={<Startlist />} />
            <Route path="arene" element={<ArenaPage />} />
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
        {!isHomePage && !isSuperAdminRoute && !isDataRoute && !isCalendarRoute && (
          <AppSidebar 
            isAdmin={isAnyAdmin} 
            isSuperAdmin={isSuperAdmin}
            isLeagueAdminOnly={isLeagueAdminOnly}
          />
        )}
        <SidebarInset className="flex-1 flex flex-col">
          <AnnouncementBanner />
          {!isHomePage && !isSuperAdminRoute && !isDataRoute && !isCalendarRoute && (
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
              <Route path="data" element={<RidersData />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="encheres" element={manager && <AuctionsList managerId={manager.id} />} />
              <Route path="mon-equipe" element={<MyTeam />} />
              <Route path="mon-equipe/mouvements" element={<TeamStartlistMovements />} />
              <Route path="courses" element={<UpcomingCourses />} />
              <Route path="resultats" element={<ResultsPage />} />
              <Route path="classement" element={<Rankings />} />
              <Route path="statistiques" element={<Statistics />} />
            <Route path="startlist" element={<Startlist />} />
            <Route path="arene" element={<ArenaPage />} />
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
