import { cn } from "@/lib/utils";

interface MobileStickyBottomProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileStickyBottom = ({
  children,
  className,
}: MobileStickyBottomProps) => {
  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-20",
        "bg-black/95 backdrop-blur-sm border-t border-bordure-gold/30",
        "safe-bottom p-4",
        "shadow-lg shadow-bordure-gold/10",
        className
      )}
    >
      {children}
    </div>
  );
};
