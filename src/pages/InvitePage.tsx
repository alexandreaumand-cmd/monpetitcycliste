import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Users, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import mpcLogo from "@/assets/mpc-logo.png";

type InviteInfo = {
  valid: boolean;
  league_name: string;
  league_visibility: string;
  member_count: number;
  error?: string;
};

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuthAndInvite() {
      if (!token) {
        setInviteInfo({ 
          valid: false, 
          league_name: "", 
          league_visibility: "", 
          member_count: 0,
          error: "Lien d'invitation invalide" 
        });
        setLoading(false);
        return;
      }

      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      // Fetch invite info
      try {
        const { data, error } = await supabase.functions.invoke('leagues-get-invite-info', {
          body: { token },
        });

        if (error || !data) {
          setInviteInfo({ 
            valid: false, 
            league_name: "", 
            league_visibility: "", 
            member_count: 0,
            error: "Impossible de récupérer les informations de l'invitation" 
          });
        } else {
          setInviteInfo(data);
        }
      } catch (err) {
        console.error('Error fetching invite info:', err);
        setInviteInfo({ 
          valid: false, 
          league_name: "", 
          league_visibility: "", 
          member_count: 0,
          error: "Une erreur inattendue s'est produite" 
        });
      }

      setLoading(false);
    }

    checkAuthAndInvite();
  }, [token]);

  const handleSignIn = () => {
    navigate(`/auth?next=/join?token=${token}&tab=signin`);
  };

  const handleSignUp = () => {
    navigate(`/auth?next=/join?token=${token}&tab=signup`);
  };

  const handleJoinNow = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('leagues-join-by-token', {
        body: { token },
      });

      if (error || !data?.ok) {
        const serverMsg = (data as any)?.error || (error as any)?.message;
        navigate(`/join?token=${token}`);
        return;
      }

      navigate(`/?leagueId=${data.league_id}`);
    } catch (err) {
      console.error('Join error:', err);
      navigate(`/join?token=${token}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <Card className="w-full max-w-md shadow-elegant">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-center text-muted-foreground">Chargement de l'invitation…</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle>Invitation invalide</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {inviteInfo?.error || "Cette invitation n'est plus valide"}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => navigate("/")}
            >
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={mpcLogo} alt="Mon Petit Cycliste" className="h-24 w-24 object-contain" />
          </div>
          <CardTitle>Invitation à rejoindre une ligue</CardTitle>
          <CardDescription>
            Vous êtes invité à rejoindre la ligue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Nom de la ligue</span>
              <span className="text-sm font-semibold">{inviteInfo.league_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Visibilité</span>
              <span className="text-sm capitalize">{inviteInfo.league_visibility}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Membres
              </span>
              <span className="text-sm font-semibold">{inviteInfo.member_count}</span>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="space-y-3">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Vous êtes déjà connecté. Cliquez ci-dessous pour rejoindre la ligue.
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full gradient-primary text-white hover:opacity-90"
                onClick={handleJoinNow}
              >
                Rejoindre la ligue
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>
                  Pour rejoindre cette ligue, vous devez créer un compte ou vous connecter.
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full gradient-primary text-white hover:opacity-90"
                onClick={handleSignUp}
              >
                Créer un compte et rejoindre
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={handleSignIn}
              >
                J'ai déjà un compte
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
