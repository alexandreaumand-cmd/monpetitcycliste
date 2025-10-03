import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RotateCcw, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface ResultHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultId: string;
  onRevert: () => void;
}

export const ResultHistoryDrawer = ({
  open,
  onOpenChange,
  resultId,
  onRevert
}: ResultHistoryDrawerProps) => {
  const [revertReason, setRevertReason] = useState("");
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useQuery({
    queryKey: ['race-result-history', resultId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-race-results', {
        body: {
          action: 'get_history',
          race_result_id: resultId
        }
      });

      if (error) throw error;
      return data.history || [];
    },
    enabled: open && !!resultId
  });

  const revertMutation = useMutation({
    mutationFn: async ({ historyId, reason }: { historyId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-race-results', {
        body: {
          action: 'revert_result',
          race_result_id: resultId,
          history_id: historyId,
          revert_reason: reason
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Résultat restauré avec succès");
      setRevertReason("");
      onRevert();
      queryClient.invalidateQueries({ queryKey: ['race-result-history'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  const handleRevert = (historyId: string) => {
    if (!revertReason.trim()) {
      toast.error("Veuillez indiquer une raison pour la restauration");
      return;
    }
    revertMutation.mutate({ historyId, reason: revertReason });
  };

  const getActionBadge = (actionType: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-500',
      update: 'bg-blue-500',
      delete: 'bg-red-500',
      revert: 'bg-purple-500'
    };

    return (
      <Badge className={colors[actionType] || 'bg-gray-500'}>
        {actionType}
      </Badge>
    );
  };

  const getStatutLabel = (statut: string | null) => {
    if (!statut) return '-';
    const labels: Record<string, string> = {
      finished: 'Terminé',
      dnf: 'DNF',
      dns: 'DNS',
      dsq: 'DSQ'
    };
    return labels[statut] || statut;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>Historique des modifications</DrawerTitle>
          <DrawerDescription>
            Consultez et restaurez les versions antérieures
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="text-center py-8">Chargement de l'historique...</div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry: any) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getActionBadge(entry.action_type)}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(entry.changed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {entry.changed_by?.nom}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">Ancienne valeur</div>
                      <div className="space-y-1">
                        <div>Position: <span className="font-medium">{entry.old_position || '-'}</span></div>
                        <div>Statut: <span className="font-medium">{getStatutLabel(entry.old_statut)}</span></div>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Nouvelle valeur</div>
                      <div className="space-y-1">
                        <div>Position: <span className="font-medium">{entry.new_position || '-'}</span></div>
                        <div>Statut: <span className="font-medium">{getStatutLabel(entry.new_statut)}</span></div>
                      </div>
                    </div>
                  </div>

                  {entry.change_reason && (
                    <div className="text-sm">
                      <div className="text-muted-foreground">Raison:</div>
                      <div className="italic">{entry.change_reason}</div>
                    </div>
                  )}

                  {entry.action_type !== 'revert' && (
                    <div className="pt-2 border-t">
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Raison de la restauration (obligatoire)"
                          value={revertReason}
                          onChange={(e) => setRevertReason(e.target.value)}
                          rows={2}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(entry.id)}
                          disabled={revertMutation.isPending || !revertReason.trim()}
                          className="gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Revenir à cette version
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun historique disponible
            </div>
          )}
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" className="gap-2">
              <X className="h-4 w-4" />
              Fermer
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
