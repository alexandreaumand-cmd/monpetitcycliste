import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MobileBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const MobileBottomSheet = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: MobileBottomSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "h-[90vh] rounded-t-3xl safe-bottom",
          "flex flex-col",
          className
        )}
      >
        <SheetHeader className="text-left pb-4 border-b flex-shrink-0">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetTitle className="text-xl">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-sm">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};
