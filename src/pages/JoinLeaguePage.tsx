import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function JoinLeaguePage() {
  const { t } = useTranslation('leagues');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState(t('join.processing'));

  useEffect(() => {
    async function joinLeague() {
      if (!token) {
        setStatus("error");
        setMessage(t('errors.invalidInvite'));
        return;
      }

      try {
        // Check if user is authenticated first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const next = encodeURIComponent(`/join?token=${token}`);
          navigate(`/auth?next=${next}`);
          return;
        }

        const { data, error } = await supabase.functions.invoke('leagues-join-by-token', {
          body: { token },
        });

        if (error || !data?.ok) {
          const status = (error as any)?.status;
          const serverMsg = (data as any)?.error || (error as any)?.message;

          // If not authenticated, redirect to auth then come back here
          if (status === 401 || status === 403) {
            const next = encodeURIComponent(`/join?token=${token}`);
            navigate(`/auth?next=${next}`);
            return;
          }

          const mapped = serverMsg === 'Invalid token'
            ? t('errors.invalidInvite')
            : serverMsg === 'Invite revoked'
            ? t('errors.revokedInvite')
            : serverMsg === 'Invite expired'
            ? t('errors.expiredInvite')
            : serverMsg === 'Invite limit reached'
            ? t('errors.limitReached')
            : t('errors.generic');

          setStatus("error");
          setMessage(mapped);
          return;
        }

        setStatus("success");
        setMessage(t('join.success'));

        // Redirect to auctions page with league selected
        setTimeout(() => {
          navigate(`/dashboard/encheres?leagueId=${data.league_id}`);
        }, 2000);
      } catch (err) {
        console.error('Join league error:', err);
        setStatus("error");
        setMessage(t('errors.generic'));
      }
    }

    joinLeague();
  }, [token, navigate, t]);

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
                  {t('join.redirecting')}
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
