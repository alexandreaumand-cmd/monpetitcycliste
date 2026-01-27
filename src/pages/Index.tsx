import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import mpcLogo from "@/assets/mpc-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard/home", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
      setIsLoading(false);
    });

    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard/home", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
      setIsLoading(false);
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
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // This should never be visible, but just in case
  return null;
};

export default Index;
