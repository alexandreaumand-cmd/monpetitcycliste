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

type Rider = {
  coureur_id: string;
  coureur_nom: string;
  is_in_roster: boolean;
  roster_manager_nom: string | null;
};

export const RiderAutocomplete = ({
  phaseId,
  value,
  riderName,
  onChange,
}: {
  phaseId: string;
  value: string | null;
  riderName: string | null;
  onChange: (riderId: string | null, riderName: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  // Ne charge RIEN tant qu'on n'a pas tapé au moins 2 caractères
  const { data: riders, isLoading } = useQuery({
    queryKey: ['riders-lookup-admin', phaseId, debouncedSearchQuery],
    queryFn: async () => {
      // Double garde-fou : ne lance même pas la requête si < 2 caractères
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .rpc('search_riders_for_results', {
          p_phase_id: phaseId,
          p_query: debouncedSearchQuery.trim()
        });

      if (error) throw error;

      return (data || []).map(r => ({
        coureur_id: r.coureur_id,
        coureur_nom: r.coureur_nom,
        is_in_roster: !!r.manager_nom,
        roster_manager_nom: r.manager_nom,
      })) as Rider[];
    },
    staleTime: 0,
    gcTime: 0,
    // Désactive complètement la requête si < 2 caractères
    enabled: (debouncedSearchQuery?.trim().length ?? 0) >= 2,
  });

  // Items avec garde-fou côté UI : si < 2 chars, renvoie tableau vide
  const displayedRiders = (debouncedSearchQuery?.trim().length ?? 0) >= 2 
    ? (riders || []) 
    : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
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
            value={searchQuery}
            onValueChange={(newValue) => {
              setSearchQuery(newValue);
              // On Clear : vide la recherche
              if (!newValue) {
                setSearchQuery('');
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading 
                ? "Recherche en cours..." 
                : searchQuery.trim().length < 2 
                  ? "Tapez au moins 2 lettres" 
                  : "Aucun coureur trouvé."}
            </CommandEmpty>
            <CommandGroup>
              {displayedRiders.map((rider) => (
                <CommandItem
                  key={rider.coureur_id}
                  value={rider.coureur_id}
                  onSelect={() => {
                    onChange(rider.coureur_id, rider.coureur_nom);
                    setOpen(false);
                    setSearchQuery(''); // Clear après sélection
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === rider.coureur_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center justify-between flex-1">
                    <span>{rider.coureur_nom}</span>
                    {rider.is_in_roster && rider.roster_manager_nom && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {rider.roster_manager_nom}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {/* Debug temporaire */}
          <div className="px-2 py-1 text-xs text-muted-foreground border-t">
            DBG q="{searchQuery}" · n={displayedRiders.length}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
