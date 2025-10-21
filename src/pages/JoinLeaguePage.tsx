import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function JoinLeaguePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Traitement de l'invitation…");

  useEffect(() => {
    async function joinLeague() {
      if (!token) {
        setStatus("error");
        setMessage("Lien d'invitation invalide.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('leagues-join-by-token', {
          body: { token },
        });

        if (error || !data?.ok) {
          const status = (error as any)?.status;
          const serverMsg = (data as any)?.error || (error as any)?.message;

          // If not authenticated, redirect to auth then come back here
          if (status === 401) {
            const next = encodeURIComponent(`/join?token=${token}`);
            navigate(`/auth?next=${next}`);
            return;
          }

          const mapped = serverMsg === 'Invalid token'
            ? "Ce lien d'invitation n'existe pas."
            : serverMsg === 'Invite revoked'
            ? "Cette invitation a été révoquée."
            : serverMsg === 'Invite expired'
            ? "Cette invitation a expiré."
            : serverMsg === 'Invite limit reached'
            ? "Cette invitation a atteint sa limite d'utilisations."
            : "Impossible de rejoindre la ligue.";

          setStatus("error");
          setMessage(mapped);
          return;
        }

        setStatus("success");
        setMessage("Vous avez rejoint la ligue avec succès !");

        // Redirect to home with league selected
        setTimeout(() => {
          navigate(`/?leagueId=${data.league_id}`);
        }, 2000);
      } catch (err) {
        console.error('Join league error:', err);
        setStatus("error");
        setMessage("Une erreur inattendue s'est produite.");
      }
    }

    joinLeague();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-4">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-center text-muted-foreground">{message}</p>
              </>
            )}
            
            {status === "success" && (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-600" />
                <Alert>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  Redirection en cours…
                </p>
              </>
            )}
            
            {status === "error" && (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <Alert variant="destructive">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
