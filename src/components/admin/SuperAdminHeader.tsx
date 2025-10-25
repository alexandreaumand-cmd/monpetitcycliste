import { ArrowLeft, LogOut, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SuperAdminHeaderProps {
  manager: any;
  onSignOut: () => void;
}

export function SuperAdminHeader({ manager, onSignOut }: SuperAdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedSeason, seasons, setSelectedSeason } = useSeasonContext();
  
  const shouldShowSeasonSelector = 
    location.pathname.includes('/super-admin/results') || 
    location.pathname.includes('/super-admin/startlists');
  
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
        
        {/* Sélecteur de saison (centre) */}
        {shouldShowSeasonSelector && selectedSeason && seasons.length > 0 && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select 
              value={selectedSeason.id} 
              onValueChange={(value) => {
                const season = seasons.find(s => s.id === value);
                if (season) setSelectedSeason(season);
              }}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    Saison {season.annee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
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
