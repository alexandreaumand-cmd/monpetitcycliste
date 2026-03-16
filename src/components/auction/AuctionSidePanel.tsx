import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Eye, Trophy, XCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { formatAmount } from "@/lib/utils";

interface AuctionSidePanelProps {
  phaseId: string;
  managerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AuctionSidePanel = ({ phaseId, managerId, open, onOpenChange }: AuctionSidePanelProps) => {
  // Get other managers rosters summary
  const { data: managersStatus = [] } = useQuery({
    queryKey: ['managers-rosters-status', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers_rosters_status')
        .select('*')
        .eq('phase_id', phaseId)
        .neq('manager_id', managerId)
        .order('manager_nom')
        .limit(10);

      if (error) throw error;
      return data || [];
    }
  });

  // Get recent bid outcomes
  const { data: recentOutcomes = [] } = useQuery({
    queryKey: ['recent-bid-outcomes', managerId, phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bids_outcomes')
        .select('*')
        .eq('manager_id', managerId)
        .eq('phase_id', phaseId)
        .order('round_number', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    }
  });

  // Keyboard shortcut Ctrl/Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          Vue rapide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[400px] h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vue rapide</DialogTitle>
        </DialogHeader>

        <Accordion type="single" collapsible className="w-full mt-4" defaultValue="teams">
          <AccordionItem value="teams">
            <AccordionTrigger className="text-sm font-medium">
              Équipes ({managersStatus.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {managersStatus.slice(0, 10).map((manager) => (
                  <div key={manager.manager_id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{manager.manager_nom}</p>
                      <Badge variant="outline" className="text-xs">
                        {manager.roster_count}/{manager.max_coureurs}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Budget: {formatAmount(manager.budget_restant)}
                    </div>
                    {manager.slots_restants === 0 && (
                      <Badge variant="secondary" className="text-xs">Roster complet</Badge>
                    )}
                  </div>
                ))}
                {managersStatus.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune équipe à afficher
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="history">
            <AccordionTrigger className="text-sm font-medium">
              Historique récent ({recentOutcomes.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {recentOutcomes.slice(0, 10).map((bid) => (
                  <div key={bid.bid_id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                    {bid.outcome === 'won' && <Trophy className="h-3 w-3 text-green-600" />}
                    {bid.outcome === 'lost' && <XCircle className="h-3 w-3 text-red-600" />}
                    {bid.outcome === 'carried_over' && <Clock className="h-3 w-3 text-bordure-gold" />}
                    <div className="flex-1 truncate">
                      <p className="font-medium">{bid.coureur_nom}</p>
                      <p className="text-muted-foreground">Round {bid.round_number}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatAmount(bid.my_bid)}
                    </Badge>
                  </div>
                ))}
                {recentOutcomes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun historique disponible
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p>💡 Astuce : Ctrl/Cmd + K pour ouvrir/fermer</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
