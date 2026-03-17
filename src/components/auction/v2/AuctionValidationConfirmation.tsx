import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Users, RefreshCw, Loader2, History, Megaphone } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface AuctionValidationConfirmationProps {
  phaseId: string | null;
  auctionId?: string;
  managerId: string;
  leagueId: string | null;
  onBack: () => void;
  onViewMyBids: () => void;
  onViewHistory: () => void;
}

export function AuctionValidationConfirmation({ phaseId, auctionId, managerId, leagueId, onBack, onViewMyBids, onViewHistory }: AuctionValidationConfirmationProps) {
  const { t } = useTranslation("auction");
  const [timeRemaining, setTimeRemaining] = useState("");

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["auction-validation-status", phaseId, auctionId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("auction-get-validation-status", {
        body: { 
          phase_id: phaseId, 
          auction_id: auctionId,
          league_id: leagueId 
        },
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
        setTimeRemaining(t('validation.closingSoon'));
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

  const progress = status.total_managers > 0 ? (status.validated_count / status.total_managers) * 100 : 0;
  const allValidated = status.total_managers > 0 && status.validated_count === status.total_managers;
  const isAutoClosing = allValidated && status.waiting_managers?.length === 0;

  const getEncouragingMessage = () => {
    if (isAutoClosing) {
      return `🤖 ${t('validation.autoClosing', 'Tous les managers ont validé ! Fermeture automatique en cours...')}`;
    }
    if (allValidated) {
      return `🎊 ${t('validation.allValidated')}`;
    }
    if (progress >= 75) {
      return `🚀 ${t('validation.almostDone')}`;
    }
    if (progress >= 50) {
      return `⏳ ${t('validation.waitingMore')}`;
    }
    if (progress >= 25) {
      return `👀 ${t('validation.waitingOthers')}`;
    }
    return `✨ ${t('validation.earlyBird')}`;
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
            <CardTitle className="text-2xl md:text-3xl">
              {t('validation.validated')} 🎉
              {status.round_number && (
                <span className="block text-lg text-muted-foreground font-normal mt-1">
                  {t('round')} {status.round_number}
                </span>
              )}
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              {t('validation.submitted')}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                {t('validation.managersValidated', { validated: status.validated_count, total: status.total_managers })}
              </span>
              <Badge variant={allValidated ? "default" : "secondary"}>
                {Math.round(progress)}%
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Encouraging message */}
          <div className={`rounded-lg p-4 text-center ${isAutoClosing ? 'bg-primary/10 border border-primary/30' : 'bg-muted'}`}>
            <p className="text-sm md:text-base">{getEncouragingMessage()}</p>
            {isAutoClosing && (
              <p className="text-xs text-muted-foreground mt-2 animate-pulse">
                {t('validation.autoClosingHint', 'Les résultats seront annoncés automatiquement dans quelques instants.')}
              </p>
            )}
          </div>

          {/* Time remaining */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              {t('validation.timeRemaining')} <strong className="text-foreground">{timeRemaining}</strong>
            </span>
          </div>

          {/* Waiting managers */}
          {status.waiting_managers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                <span>{t('validation.waitingManagers')} ({status.waiting_managers.length})</span>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {status.waiting_managers.map((managerName: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {managerName}
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
              {t('validation.refresh')}
            </Button>
            <Button
              onClick={onViewMyBids}
              variant="secondary"
              className="flex-1"
            >
              {t('validation.viewMyBids')}
            </Button>
            <Button
              onClick={onViewHistory}
              variant="secondary"
              className="flex-1"
            >
              <History className="h-4 w-4 mr-2" />
              {t('validation.history')}
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center">
            {t('validation.autoUpdate')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
