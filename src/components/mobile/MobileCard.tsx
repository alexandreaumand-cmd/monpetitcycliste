import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MobileCardProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  meta?: string | React.ReactNode;
  avatar?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  expanded?: boolean;
  expandedContent?: React.ReactNode;
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
  expanded = false,
  expandedContent,
}: MobileCardProps) => {
  const content = (
    <>
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
          <ChevronDown 
            className={cn(
              "h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform duration-200",
              expanded && "rotate-180"
            )} 
          />
        )}
      </div>
      
      {expandedContent && (
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="pt-3 mt-3 border-t border-border">
            {expandedContent}
          </div>
        </CollapsibleContent>
      )}
    </>
  );

  if (onClick && expandedContent) {
    return (
      <Collapsible open={expanded}>
        <Card className={cn("rounded-2xl p-3 shadow-sm w-full border border-border", className)}>
          <CollapsibleTrigger asChild>
            <div
              className={cn(
                "cursor-pointer hover:bg-accent hover:border-primary active:scale-[0.98] transition-all touch-target",
                "w-full -m-3 p-3 rounded-2xl"
              )}
              onClick={onClick}
            >
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
                
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform duration-200",
                    expanded && "rotate-180"
                  )} 
                />
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="pt-3 border-t border-border">
              {expandedContent}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  if (onClick) {
    return (
      <Card
        className={cn(
          "rounded-2xl p-3 shadow-sm w-full border border-border",
          "cursor-pointer hover:bg-accent hover:border-primary active:scale-[0.98] transition-all touch-target",
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
