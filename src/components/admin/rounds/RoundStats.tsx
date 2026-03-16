import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Trophy, Users, CircleCheckBig } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RoundStatsProps {
  pendingBids: number;
  wonBids: number;
  ties: number;
  totalManagers: number;
  validatedManagers: number;
  validatedManagerNames: string[];
  waitingManagerNames: string[];
  completedManagerNames: string[];
}

export const RoundStats = ({
  pendingBids,
  wonBids,
  ties,
  totalManagers,
  validatedManagers,
  validatedManagerNames,
  waitingManagerNames,
  completedManagerNames
}: RoundStatsProps) => {
  const stats = [
    {
      label: "Enchères validées",
      value: `${validatedManagers}/${totalManagers}`,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
      cardBg: "bg-green-50/50",
      tooltip: (
        <div className="space-y-2">
          {validatedManagerNames.length > 0 && (
            <div>
              <p className="font-semibold text-green-700">✅ Validés :</p>
              <p className="text-sm">{validatedManagerNames.join(", ")}</p>
            </div>
          )}
          {waitingManagerNames.length > 0 && (
            <div>
              <p className="font-semibold text-orange-600">⏳ En attente :</p>
              <p className="text-sm">{waitingManagerNames.join(", ")}</p>
            </div>
          )}
        </div>
      )
    },
    {
      label: "En attente",
      value: pendingBids,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      cardBg: "bg-orange-50/50"
    },
    {
      label: "Gains",
      value: wonBids,
      icon: Trophy,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      cardBg: "bg-blue-50/50"
    },
    {
      label: "Égalités",
      value: ties,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      cardBg: "bg-purple-50/50"
    },
    {
      label: "Enchères terminées",
      value: completedManagerNames.length,
      icon: CircleCheckBig,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      cardBg: "bg-secondary/5",
      tooltip: completedManagerNames.length > 0 && (
        <div>
          <p className="font-semibold text-secondary">✔️ Roster complet :</p>
          <p className="text-sm">{completedManagerNames.join(", ")}</p>
        </div>
      )
    }
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const CardWrapper = stat.tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Card key={index} className={`${stat.cardBg} cursor-help`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {stat.tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Card key={index} className={stat.cardBg}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
          
          return CardWrapper;
        })}
      </div>
    </TooltipProvider>
  );
};
