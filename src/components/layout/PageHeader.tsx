import * as React from "react";
import { cn } from "@/lib/utils";
import { UI_CONSTANTS } from "@/lib/ui-constants";

interface PageHeaderProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}

export function PageHeader({ 
  icon: Icon, 
  title, 
  subtitle, 
  actions, 
  filters,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-8 w-8 text-primary" />}
          <div>
            <h1 className={UI_CONSTANTS.pageTitle}>{title}</h1>
            {subtitle && <p className={UI_CONSTANTS.pageSubtitle}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {filters && <div className="flex flex-col md:flex-row gap-4">{filters}</div>}
    </div>
  );
}
