import { useState, ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomBar } from "./MobileBottomBar";
import { MobileDrawer } from "./MobileDrawer";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface MobileLayoutProps {
  children: ReactNode;
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
  title?: string;
}

export const MobileLayout = ({
  children,
  manager,
  isAdmin,
  onSignOut,
  title = "Mon Petit Cycliste",
}: MobileLayoutProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header with menu button */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-top">
        <div className="flex h-14 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            className="touch-target"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Ouvrir le menu</span>
          </Button>

          <h1 className="text-lg font-bold truncate flex-1 text-center">
            {title}
          </h1>

          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main content */}
      <main className="pb-safe">{children}</main>

      {/* Bottom navigation bar */}
      <MobileBottomBar isAdmin={isAdmin} />

      {/* Side drawer */}
      <MobileDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        manager={manager}
        isAdmin={isAdmin}
        onSignOut={onSignOut}
      />
    </div>
  );
};
