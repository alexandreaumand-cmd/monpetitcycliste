import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface MobileCardProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  meta?: string | React.ReactNode;
  avatar?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const MobileCard = ({
  title,
  subtitle,
  meta,
  avatar,
  badge,
  onClick,
  className,
  children,
}: MobileCardProps) => {
  const content = (
    <div className="flex items-start gap-3">
      {avatar && <div className="flex-shrink-0">{avatar}</div>}
      
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm leading-tight truncate min-w-0">
            {title}
          </div>
          {badge && <div className="flex-shrink-0">{badge}</div>}
        </div>
        
        {subtitle && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {subtitle}
          </div>
        )}
        
        {meta && (
          <p className="text-xs text-muted-foreground/70">{meta}</p>
        )}
        
        {children}
      </div>
      
      {onClick && (
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      )}
    </div>
  );

  if (onClick) {
    return (
      <Card
        className={cn(
          "rounded-2xl p-3 shadow-sm w-full",
          "cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all touch-target",
          className
        )}
        onClick={onClick}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card className={cn("rounded-2xl p-3 shadow-sm w-full", className)}>
      {content}
    </Card>
  );
};
