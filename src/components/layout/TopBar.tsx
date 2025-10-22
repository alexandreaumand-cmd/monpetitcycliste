import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./NotificationCenter";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface TopBarProps {
  onSignOut: () => void;
}

export function TopBar({ onSignOut }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger />
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Button
            variant="ghost"
            size="icon"
            onClick={onSignOut}
            title="Se déconnecter"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
