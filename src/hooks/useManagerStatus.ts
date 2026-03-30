import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock } from "lucide-react";
import { createElement } from "react";

export const useManagerStatus = (activePhaseId: string | undefined) => {
  const { data: managersStatus = [] } = useQuery({
    queryKey: ['managers-rosters-status', activePhaseId],
    queryFn: async () => {
      if (!activePhaseId) return [];
      const { data, error } = await supabase
        .from('managers_rosters_status')
        .select('*')
        .eq('phase_id', activePhaseId)
        .order('manager_nom');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activePhaseId
  });

  const getManagerStatus = (manager: any) => {
    const slotsMatch = manager.pending_count === manager.slots_restants;
    const budgetMatch = Math.abs(parseFloat(manager.budget_restant.toString()) - parseFloat(manager.pending_sum.toString())) < 1;

    if (manager.slots_restants === 0) {
      return {
        label: "Complet",
        variant: "default" as const,
        icon: createElement(CheckCircle2, { className: "h-3 w-3" })
      };
    }

    if (slotsMatch && budgetMatch) {
      return {
        label: "Prêt",
        variant: "default" as const,
        icon: createElement(CheckCircle2, { className: "h-3 w-3" })
      };
    }

    return {
      label: "En attente",
      variant: "secondary" as const,
      icon: createElement(Clock, { className: "h-3 w-3" })
    };
  };

  return { managersStatus, getManagerStatus };
};
