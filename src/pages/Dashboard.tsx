import { useEffect, useState } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuctionsList } from "@/components/auction/AuctionsList";
import { MyTeam } from "@/components/team/MyTeam";
import { UpcomingCourses } from "@/components/courses/UpcomingCourses";
import { ResultsPage } from "./ResultsPage";
import Rankings from "./Rankings";
import { AdminPage } from "./AdminPage";
import Startlist from "./Startlist";
import Statistics from "./Statistics";
import AccountPage from "./AccountPage";

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);
  const { isSuperAdmin, isLeagueAdminOnly, loading: roleLoading } = useUserRole();
  const isAnyAdmin = isSuperAdmin || isLeagueAdminOnly;

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
            <Route index element={<Navigate to="/dashboard/classement" replace />} />
            <Route path="encheres" element={manager && <AuctionsList managerId={manager.id} />} />
            <Route path="mon-equipe" element={<MyTeam />} />
            <Route path="courses" element={<UpcomingCourses />} />
            <Route path="resultats" element={<ResultsPage />} />
            <Route path="classement" element={<Rankings />} />
            <Route path="statistiques" element={<Statistics />} />
            <Route path="startlist" element={<Startlist />} />
            <Route path="compte" element={<AccountPage />} />
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
        <AppSidebar isAdmin={isAnyAdmin} />
        <SidebarInset className="flex-1 flex flex-col">
          <AnnouncementBanner />
          <TopBar 
            onSignOut={handleSignOut}
            manager={manager}
            isAdmin={isAnyAdmin}
          />
          <main className="flex-1 container mx-auto px-4 pt-0 pb-8">
            <Routes>
              <Route index element={<Navigate to="/dashboard/classement" replace />} />
              <Route path="encheres" element={manager && <AuctionsList managerId={manager.id} />} />
              <Route path="mon-equipe" element={<MyTeam />} />
              <Route path="courses" element={<UpcomingCourses />} />
              <Route path="resultats" element={<ResultsPage />} />
              <Route path="classement" element={<Rankings />} />
              <Route path="statistiques" element={<Statistics />} />
              <Route path="startlist" element={<Startlist />} />
              <Route path="compte" element={<AccountPage />} />
              {isAnyAdmin && <Route path="admin/*" element={<AdminPage />} />}
            </Routes>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
