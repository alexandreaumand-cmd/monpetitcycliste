import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChipGroupProps {
  items: Array<{
    label: string;
    value: string;
    count?: number;
  }>;
  selected?: string;
  onSelect?: (value: string) => void;
  className?: string;
}

export const ChipGroup = ({
  items,
  selected,
  onSelect,
  className,
}: ChipGroupProps) => {
  return (
    <div className={cn("chips-scroll", className)}>
      {items.map((item) => {
        const isSelected = selected === item.value;
        
        return (
          <Badge
            key={item.value}
            variant={isSelected ? "default" : "outline"}
            className={cn(
              "cursor-pointer min-h-[44px] px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              "active:scale-95 transition-all",
              isSelected && "shadow-sm"
            )}
            onClick={() => onSelect?.(item.value)}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn(
                "ml-1.5 text-xs",
                isSelected ? "opacity-90" : "opacity-60"
              )}>
                ({item.count})
              </span>
            )}
          </Badge>
        );
      })}
    </div>
  );
};
