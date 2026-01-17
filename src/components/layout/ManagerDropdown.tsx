import { User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  compact?: boolean;
}

export function ManagerDropdown({ manager, isAdmin, onSignOut, avatarUrl, compact = false }: ManagerDropdownProps) {
  const { t } = useTranslation('navigation');
  const navigate = useNavigate();
  const initials = manager.nom?.substring(0, 2).toUpperCase() || "?";
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Avatar className="h-6 w-6">
              <AvatarImage src={avatarUrl} alt={manager.nom} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        ) : (
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
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>{t('dropdown.myAccount')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/dashboard/compte')}>
          <User className="mr-2 h-4 w-4" />
          <span>{t('dropdown.settings')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('dropdown.signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
