import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"validating" | "valid" | "invalid" | "success" | "error">("validating");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    // Validate token via GET
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("success");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setStatus("validating");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success || data?.reason === "already_unsubscribed") {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-yellow-50/30">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            {status === "validating" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Vérification en cours...</p>
              </>
            )}
            {status === "valid" && (
              <>
                <MailX className="h-12 w-12 text-orange-500" />
                <h2 className="text-xl font-semibold">Se désabonner</h2>
                <p className="text-muted-foreground">
                  Voulez-vous vous désabonner des emails de La Bordure ?
                </p>
                <Button onClick={handleUnsubscribe} variant="destructive" className="w-full">
                  Confirmer le désabonnement
                </Button>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-600" />
                <h2 className="text-xl font-semibold">Désabonné !</h2>
                <p className="text-muted-foreground">
                  Vous ne recevrez plus d'emails de La Bordure.
                </p>
              </>
            )}
            {(status === "invalid" || status === "error") && (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-semibold">Lien invalide</h2>
                <p className="text-muted-foreground">
                  Ce lien de désabonnement est invalide ou a expiré.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
