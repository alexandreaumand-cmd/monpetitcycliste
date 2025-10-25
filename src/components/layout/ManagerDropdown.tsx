import { User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ManagerDropdownProps {
  manager: any;
  isAdmin: boolean;
  onSignOut: () => void;
  avatarUrl?: string;
}

export function ManagerDropdown({ manager, isAdmin, onSignOut, avatarUrl }: ManagerDropdownProps) {
  const navigate = useNavigate();
  const initials = manager.nom?.substring(0, 2).toUpperCase() || "?";
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-9">
          {avatarUrl ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={avatarUrl} alt={manager.nom} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          ) : null}
          <span className="font-medium text-sm text-white">{manager.nom}</span>
          {manager.sponsor && (
            <span className="text-xs text-gray-300">({manager.sponsor})</span>
          )}
          {isAdmin && <Badge variant="secondary" className="text-xs">Admin</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/dashboard/compte')}>
          <User className="mr-2 h-4 w-4" />
          <span>Paramètres du compte</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
