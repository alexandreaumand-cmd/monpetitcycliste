import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import mpcLogo from "@/assets/mpc-logo.png";
import LandingPage from "./LandingPage";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Set up auth state listener first
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard/home", { replace: true });
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    });

    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard/home", { replace: true });
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Loading screen while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <img 
          src={mpcLogo} 
          alt="Mon Petit Cycliste" 
          className="h-24 w-24 mb-6 animate-pulse" 
        />
        <div className="w-8 h-8 border-4 border-bordure-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Authenticated users are redirected via useEffect
  return null;
};

export default Index;
