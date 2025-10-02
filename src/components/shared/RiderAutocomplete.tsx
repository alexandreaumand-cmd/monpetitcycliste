import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type RiderAutocompleteProps = {
  phaseId: string;
  value: string | null;
  riderName: string | null;
  onChange: (riderId: string | null, riderName: string | null) => void;
  disabled?: boolean;
  showTakenTag?: boolean;
  allowTaken?: boolean;
};

// Normalize string: remove accents and convert to lowercase
const normalizeString = (str: string) => 
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const RiderAutocomplete = ({
  phaseId,
  value,
  riderName,
  onChange,
  disabled = false,
  showTakenTag = true,
  allowTaken = false,
}: RiderAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  const { data: coureurs, isLoading } = useQuery({
    queryKey: ['coureurs-disponibilite', debouncedSearchTerm, phaseId],
    queryFn: async () => {
      let query = supabase
        .from('coureurs_disponibilite')
        .select('*')
        .eq('phase_id', phaseId);
      
      // Recherche : si searchTerm >= 2 chars, on filtre, sinon on affiche les 50 premiers
      if (debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2) {
        const normalizedSearch = normalizeString(debouncedSearchTerm);
        query = query.ilike('search_text', `%${normalizedSearch}%`);
      }
      
      // Pas de filtre sur is_taken - on veut TOUS les coureurs
      // Tri : disponibles en premier, puis par nom
      const { data, error } = await query
        .order('is_taken', { ascending: true })
        .order('coureur_nom', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 0, // Pas de cache
    gcTime: 0,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value && riderName ? (
            <span className="truncate">{riderName}</span>
          ) : (
            <span className="text-muted-foreground">Sélectionner un coureur...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher un coureur..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                "Recherche en cours..."
              ) : debouncedSearchTerm.length > 0 && debouncedSearchTerm.length < 2 ? (
                "Tapez au moins 2 lettres pour rechercher"
              ) : (
                "Aucun coureur trouvé"
              )}
            </CommandEmpty>
            <CommandGroup>
              {coureurs?.map((coureur) => {
                const isTaken = coureur.is_taken;
                const isDisabled = !allowTaken && isTaken;
                
                return (
                  <CommandItem
                    key={coureur.coureur_id}
                    value={coureur.coureur_id}
                    onSelect={() => {
                      if (!isDisabled) {
                        onChange(coureur.coureur_id, coureur.coureur_nom);
                        setOpen(false);
                      }
                    }}
                    disabled={isDisabled}
                    className={isDisabled ? "opacity-50" : ""}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === coureur.coureur_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center justify-between flex-1">
                      <div>
                        <span>{coureur.coureur_nom}</span>
                        {coureur.coureur_equipe && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {coureur.coureur_equipe}
                          </span>
                        )}
                      </div>
                      {showTakenTag && isTaken && coureur.taken_by_manager_nom && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Pris par {coureur.taken_by_manager_nom}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
