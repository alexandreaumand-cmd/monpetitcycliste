import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Trophy, Users } from "lucide-react";

interface RoundStatsProps {
  pendingBids: number;
  wonBids: number;
  ties: number;
  totalManagers: number;
  validatedManagers: number;
}

export const RoundStats = ({
  pendingBids,
  wonBids,
  ties,
  totalManagers,
  validatedManagers
}: RoundStatsProps) => {
  const stats = [
    {
      label: "Enchères validées",
      value: `${validatedManagers}/${totalManagers}`,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      label: "En attente",
      value: pendingBids,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      label: "Gains",
      value: wonBids,
      icon: Trophy,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      label: "Égalités",
      value: ties,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
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
      })}
    </div>
  );
};
