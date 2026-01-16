import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, User, Check, ExternalLink, Loader2 } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

interface RiderSearchResult {
  id: string;
  nom: string;
  equipe: string | null;
  prix_initial: number;
  is_taken: boolean;
  taken_by_manager_nom: string | null;
  taken_by_manager_id: string | null;
}

interface RiderSearchBarProps {
  phaseId: string;
  leagueId: string;
  onSelectManager: (managerId: string) => void;
}

export const RiderSearchBar = ({ phaseId, leagueId, onSelectManager }: RiderSearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<RiderSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  useEffect(() => {
    const searchRiders = async () => {
      if (debouncedSearchTerm.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("coureurs_disponibilite")
          .select("id, nom, equipe, prix_initial, is_taken, taken_by_manager_nom, taken_by_manager_id")
          .eq("phase_id", phaseId)
          .or(`league_id.eq.${leagueId},league_id.is.null`)
          .ilike("nom", `%${debouncedSearchTerm}%`)
          .limit(10);

        if (error) throw error;
        
        // Filter to get unique riders - prioritize taken ones for the current league
        const uniqueRiders = new Map<string, RiderSearchResult>();
        (data || []).forEach((rider: any) => {
          const existing = uniqueRiders.get(rider.id);
          // If rider is taken in this league, keep that record
          if (!existing || (rider.is_taken && rider.taken_by_manager_id)) {
            uniqueRiders.set(rider.id, rider as RiderSearchResult);
          }
        });
        
        setResults(Array.from(uniqueRiders.values()));
      } catch (error) {
        console.error("Error searching riders:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchRiders();
  }, [debouncedSearchTerm, phaseId, leagueId]);

  const handleSelectManager = (managerId: string) => {
    onSelectManager(managerId);
    setIsOpen(false);
    setSearchTerm("");
    setResults([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length >= 2) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (searchTerm.length >= 2 && results.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un coureur..."
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            className="pl-9 pr-8"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {results.length === 0 && debouncedSearchTerm.length >= 2 && !isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Aucun coureur trouvé
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {results.map((rider) => (
              <div
                key={rider.id}
                className={cn(
                  "flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors",
                  rider.is_taken && "bg-muted/20"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{rider.nom}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {rider.equipe || "Équipe inconnue"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      💰 {rider.prix_initial}
                    </span>
                    {rider.is_taken && rider.taken_by_manager_nom ? (
                      <Badge variant="secondary" className="text-xs">
                        <User className="h-3 w-3 mr-1" />
                        {rider.taken_by_manager_nom}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        <Check className="h-3 w-3 mr-1" />
                        Libre
                      </Badge>
                    )}
                  </div>
                </div>
                
                {rider.is_taken && rider.taken_by_manager_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectManager(rider.taken_by_manager_id!)}
                    className="flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Voir
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
