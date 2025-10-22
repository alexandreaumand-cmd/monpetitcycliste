import * as React from "react";
import { cn } from "@/lib/utils";
import { UI_CONSTANTS } from "@/lib/ui-constants";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn(
      'mx-auto', 
      UI_CONSTANTS.maxWidth, 
      UI_CONSTANTS.mainPadding, 
      UI_CONSTANTS.sectionGap, 
      className
    )}>
      {children}
    </div>
  );
}
