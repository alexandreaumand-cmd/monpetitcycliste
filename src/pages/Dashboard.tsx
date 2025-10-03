import { useEffect, useState } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Header } from "@/components/layout/Header";
import { AuctionsList } from "@/components/auction/AuctionsList";
import { MyTeam } from "@/components/team/MyTeam";
import { UpcomingCourses } from "@/components/courses/UpcomingCourses";
import { ResultsPage } from "./ResultsPage";
import Rankings from "./Rankings";
import { AdminPage } from "./AdminPage";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);
  const { isAdmin, loading: roleLoading } = useUserRole();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <Header manager={manager} isAdmin={isAdmin} onSignOut={handleSignOut} />
      
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route index element={<Navigate to="/dashboard/classement" replace />} />
          <Route path="encheres" element={manager && <AuctionsList managerId={manager.id} />} />
          <Route path="mon-equipe" element={<MyTeam />} />
          <Route path="courses" element={<UpcomingCourses />} />
          <Route path="resultats" element={<ResultsPage />} />
          <Route path="classement" element={<Rankings />} />
          {isAdmin && <Route path="admin/*" element={<AdminPage />} />}
        </Routes>
      </main>
    </div>
  );
};

export default Dashboard;
