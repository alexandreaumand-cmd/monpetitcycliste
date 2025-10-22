import { User, Building2, Calendar, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ManagerInfoDropdownProps {
  manager: any;
  displaySponsor?: string;
  selectedYear?: number;
  isAdmin: boolean;
}

export const ManagerInfoDropdown = ({ 
  manager, 
  displaySponsor, 
  selectedYear,
  isAdmin 
}: ManagerInfoDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="gap-2 h-9 text-sm font-medium hover:bg-accent"
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{manager.nom}</span>
          <span className="sm:hidden">Info</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 z-50 bg-popover">
        <DropdownMenuLabel>Informations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="cursor-default focus:bg-transparent">
          <User className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{manager.nom}</span>
            <span className="text-xs text-muted-foreground">Manager</span>
          </div>
        </DropdownMenuItem>

        {displaySponsor && (
          <DropdownMenuItem className="cursor-default focus:bg-transparent">
            <Building2 className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{displaySponsor}</span>
              <span className="text-xs text-muted-foreground">Sponsor</span>
            </div>
          </DropdownMenuItem>
        )}

        {selectedYear && (
          <DropdownMenuItem className="cursor-default focus:bg-transparent">
            <Calendar className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{selectedYear}</span>
              <span className="text-xs text-muted-foreground">Saison</span>
            </div>
          </DropdownMenuItem>
        )}

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-default focus:bg-transparent">
              <Shield className="mr-2 h-4 w-4 text-secondary" />
              <span className="text-sm font-medium text-secondary">Administrateur</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
