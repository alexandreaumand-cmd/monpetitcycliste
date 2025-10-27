import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MultiSegmentProgress } from "./MultiSegmentProgress";

interface ManagerStatus {
  nom: string;
  status: 'validated' | 'pending' | 'incomplete';
  slots_filled: number;
  max_slots: number;
  budget_used: number;
  total_budget: number;
  budget_remaining: number;
  last_activity: string | null;
  riders_per_round: number[];
}

interface ManagerStatusCardProps {
  manager: ManagerStatus;
}

export const ManagerStatusCard = ({ manager }: ManagerStatusCardProps) => {
  const statusConfig = {
    validated: {
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
      badgeVariant: "default" as const,
      label: "Validé"
    },
    pending: {
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      badgeVariant: "secondary" as const,
      label: "En attente"
    },
    incomplete: {
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      badgeVariant: "destructive" as const,
      label: "Incomplet"
    }
  };

  const config = statusConfig[manager.status];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border ${config.bgColor} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className="font-medium">{manager.nom}</span>
        </div>
        <Badge variant={config.badgeVariant} className="text-xs">
          {config.label}
        </Badge>
      </div>
      
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Coureurs</span>
            <span>{manager.slots_filled}/{manager.max_slots}</span>
          </div>
          <MultiSegmentProgress 
            ridersPerRound={manager.riders_per_round} 
            maxSlots={manager.max_slots} 
          />
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground pt-1">
          <span>Budget restant: {manager.budget_remaining}€</span>
          {manager.last_activity && (
            <span className="text-xs">
              il y a {formatDistanceToNow(new Date(manager.last_activity), { locale: fr })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
