import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPIItem {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

interface KPIRowProps {
  items: KPIItem[];
  className?: string;
}

export const KPIRow = ({ items, className }: KPIRowProps) => {
  // Max 3 KPI par ligne
  const displayItems = items.slice(0, 3);
  
  return (
    <div className={cn("grid gap-2", className)} style={{
      gridTemplateColumns: `repeat(${displayItems.length}, minmax(0, 1fr))`
    }}>
      {displayItems.map((item, index) => (
        <Card
          key={index}
          className="p-3 space-y-1 rounded-xl shadow-sm"
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs text-muted-foreground line-clamp-1">
              {item.label}
            </p>
            {item.icon && (
              <div className="flex-shrink-0 text-muted-foreground">
                {item.icon}
              </div>
            )}
          </div>
          
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-semibold leading-none truncate">
              {item.value}
            </p>
            
            {item.trend && (
              <span className={cn(
                "text-xs font-medium",
                item.trend === "up" && "text-green-600",
                item.trend === "down" && "text-red-600",
                item.trend === "neutral" && "text-muted-foreground"
              )}>
                {item.trend === "up" && "↑"}
                {item.trend === "down" && "↓"}
                {item.trend === "neutral" && "→"}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};
