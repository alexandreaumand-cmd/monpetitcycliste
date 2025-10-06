import { cn } from "@/lib/utils";

interface MobileEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const MobileEmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: MobileEmptyStateProps) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-6",
      className
    )}>
      {icon && (
        <div className="mb-4 text-muted-foreground opacity-40">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-semibold mb-1">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {description}
        </p>
      )}
      
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
