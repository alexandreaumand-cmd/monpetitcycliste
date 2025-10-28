import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface NextAuctionCardProps {
  phaseId: string;
  scheduledAuction?: {
    id: string;
    round_number: number;
    opens_at: string;
    deadline_at: string;
  } | null;
}

export const NextAuctionCard = ({ phaseId, scheduledAuction }: NextAuctionCardProps) => {
  const [timeLeft, setTimeLeft] = useState("");

  // Use scheduled auction if provided, otherwise fetch next auction info
  const targetAuction = scheduledAuction ? {
    round_number: scheduledAuction.round_number,
    target_time: scheduledAuction.opens_at,
    label: `Début des enchères`,
    statut: 'scheduled' as const,
  } : null;

  const { data: nextAuctionInfo } = useQuery({
    queryKey: ['next-auction-info', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('next_auction_info')
        .select('*')
        .eq('phase_id', phaseId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !scheduledAuction,
  });

  const nextAuction = targetAuction || nextAuctionInfo;

  useEffect(() => {
    if (!nextAuction?.target_time) {
      setTimeLeft("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(nextAuction.target_time).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Expiré");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}j ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [nextAuction?.target_time]);

  if (!nextAuction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Prochain round
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">À annoncer</p>
        </CardContent>
      </Card>
    );
  }

  const isOpen = nextAuction.statut === 'open';
  const isScheduled = nextAuction.statut === 'scheduled';
  const badgeVariant = isOpen ? 'default' : isScheduled ? 'outline' : 'secondary';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Prochain round · Round {nextAuction.round_number}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={badgeVariant}>
          {isOpen ? 'En cours' : isScheduled ? 'Programmé' : 'À venir'}
        </Badge>
        
        <div className="space-y-1">
          <p className="text-sm font-medium">{nextAuction.label}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(nextAuction.target_time), "PPP 'à' HH:mm", { locale: fr })}
          </p>
          {timeLeft && (
            <div className="flex items-center gap-1 text-sm font-medium text-primary">
              <Clock className="h-3 w-3" />
              {isScheduled ? 'Les enchères commencent dans ' : ''}{timeLeft}
            </div>
          )}
          {isScheduled && (
            <p className="text-xs text-muted-foreground mt-2">
              Préparez-vous pour le premier tour d'enchères !
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
