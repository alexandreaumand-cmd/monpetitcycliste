import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface SuperAdminHeaderProps {
  manager: any;
  onSignOut: () => void;
}

export function SuperAdminHeader({ manager, onSignOut }: SuperAdminHeaderProps) {
  const navigate = useNavigate();
  
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Bouton retour */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/dashboard/home')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'interface Manager
        </Button>
        
        {/* Info manager + déconnexion */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{manager?.nom}</span>
            {manager?.sponsor && (
              <span className="text-xs text-muted-foreground">({manager.sponsor})</span>
            )}
            <Badge variant="secondary" className="text-xs">Admin</Badge>
          </div>
          
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
