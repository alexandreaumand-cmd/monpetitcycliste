import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ManagerStatus {
  nom: string;
  status: 'validated' | 'pending' | 'incomplete';
  slots_filled: number;
  max_slots: number;
  budget_used: number;
  total_budget: number;
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
  const slotsProgress = (manager.slots_filled / manager.max_slots) * 100;
  const budgetProgress = (manager.budget_used / manager.total_budget) * 100;

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
          <Progress value={slotsProgress} className="h-1.5" />
        </div>
        
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Avancement budget</span>
            <span>{Math.round(budgetProgress)}%</span>
          </div>
          <Progress value={budgetProgress} className="h-1.5" />
        </div>
      </div>
    </div>
  );
};
