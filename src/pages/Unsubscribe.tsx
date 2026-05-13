import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "validating" | "ready" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("validating");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Lien invalide ou expiré.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState("error");
          setError(data?.error ?? "Lien invalide ou expiré.");
          return;
        }
        setEmail(data?.email ?? null);
        setState("ready");
      } catch {
        setState("error");
        setError("Impossible de vérifier le lien.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setState("error");
      setError(error.message ?? "Une erreur est survenue.");
      return;
    }
    setState("done");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Désabonnement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "validating" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Vérification du lien…
            </div>
          )}
          {state === "ready" && (
            <>
              <p className="text-sm text-muted-foreground">
                Confirmez le désabonnement{email ? ` de ${email}` : ""} pour ne
                plus recevoir d'emails de Labordure.
              </p>
              <Button onClick={confirm} className="w-full">
                Confirmer le désabonnement
              </Button>
            </>
          )}
          {state === "submitting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Traitement…
            </div>
          )}
          {state === "done" && (
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <span>Vous êtes désabonné. Vous ne recevrez plus d'emails.</span>
            </div>
          )}
          {state === "error" && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
