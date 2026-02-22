import { cn } from "@/lib/utils";

interface TabGroupProps {
  items: Array<{
    label: string;
    value: string;
  }>;
  selected?: string;
  onSelect?: (value: string) => void;
  className?: string;
}

export const TabGroup = ({
  items,
  selected,
  onSelect,
  className,
}: TabGroupProps) => {
  return (
    <div
      className={cn(
        "flex gap-1 p-1 bg-muted rounded-lg w-full",
        "scrollbar-hide hide-scrollbar",
        className
      )}
    >
      {items.map((item) => {
        const isSelected = selected === item.value;

        return (
          <button
            key={item.value}
            className={cn(
              "flex-1 min-w-0 px-2 py-2 text-xs font-medium rounded-md transition-all text-center",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "bg-background text-foreground shadow-sm border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
            onClick={() => onSelect?.(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
