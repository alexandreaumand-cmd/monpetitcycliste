import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, HelpCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { formatAmount } from "@/lib/utils";

interface AuctionHeaderProps {
  auction: {
    round_number: number;
    deadline_at: string;
  };
  phaseStatus: {
    budget_restant: string | number;
    slots_restants: number;
  } | null;
  onRefresh: () => void;
}

export const AuctionHeader = ({ auction, phaseStatus, onRefresh }: AuctionHeaderProps) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const deadline = new Date(auction.deadline_at).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft("Expiré");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [auction.deadline_at]);

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b safe-top">
      <div className="container py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Tour {auction.round_number}</h2>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeLeft}
            </Badge>
          </div>
          
          {phaseStatus && (
            <>
              <Badge variant="secondary" className="text-sm">
                Slots: {phaseStatus.slots_restants}
              </Badge>
              <Badge 
                variant={parseFloat(phaseStatus.budget_restant.toString()) < 0 ? "destructive" : "default"} 
                className="text-sm"
              >
                Budget: {formatAmount(phaseStatus.budget_restant)}
              </Badge>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Rafraîchir les données</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2 text-sm">
                  <p><strong>Règles:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Offre ≥ prix initial du coureur</li>
                    <li>Décimales autorisées</li>
                    <li>Somme = budget restant exact</li>
                    <li>Nombre d'enchères = slots restants</li>
                  </ul>
                  <p className="text-muted-foreground">Ctrl/Cmd + K : Vue rapide</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
