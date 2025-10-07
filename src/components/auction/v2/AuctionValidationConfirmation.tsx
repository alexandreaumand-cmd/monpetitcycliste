import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Users, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface AuctionValidationConfirmationProps {
  phaseId: string;
  onBack: () => void;
}

export function AuctionValidationConfirmation({ phaseId, onBack }: AuctionValidationConfirmationProps) {
  const [timeRemaining, setTimeRemaining] = useState("");

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["auction-validation-status", phaseId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-get-validation-status", {
        body: { phase_id: phaseId },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Update countdown timer
  useEffect(() => {
    if (!status?.deadline_at) return;

    const updateTimer = () => {
      const now = new Date();
      const deadline = new Date(status.deadline_at);
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Clôture imminente...");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days}j ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [status?.deadline_at]);

  if (isLoading || !status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = (status.validated_count / status.total_managers) * 100;
  const allValidated = status.validated_count === status.total_managers;

  const getEncouragingMessage = () => {
    if (allValidated) {
      return "🎊 Tous les managers ont validé ! Le round va bientôt se clôturer.";
    }
    if (progress >= 75) {
      return "🚀 Plus que quelques retardataires...";
    }
    if (progress >= 50) {
      return "⏳ On attend encore quelques managers...";
    }
    if (progress >= 25) {
      return "👀 Patience... Les autres managers finalisent leurs enchères.";
    }
    return "✨ Tu fais partie des premiers à avoir validé ! Bravo !";
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl md:text-3xl">Enchères validées ! 🎉</CardTitle>
            <p className="text-muted-foreground mt-2">
              Tes enchères ont été soumises avec succès
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {status.validated_count}/{status.total_managers} managers ont validé
              </span>
              <Badge variant={allValidated ? "default" : "secondary"}>
                {Math.round(progress)}%
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Encouraging message */}
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-sm md:text-base">{getEncouragingMessage()}</p>
          </div>

          {/* Time remaining */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              Temps restant : <strong className="text-foreground">{timeRemaining}</strong>
            </span>
          </div>

          {/* Waiting managers */}
          {status.waiting_managers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                <span>Managers en attente ({status.waiting_managers.length})</span>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {status.waiting_managers.map((name: string) => (
                    <Badge key={name} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button
              onClick={onBack}
              variant="secondary"
              className="flex-1"
            >
              Retour aux enchères
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center">
            Cette page se met à jour automatiquement toutes les 15 secondes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
