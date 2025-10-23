import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useLeague } from "@/contexts/LeagueContext";

type Coureur = {
  coureur_id: string;
  coureur_nom: string;
  coureur_equipe: string | null;
  is_taken: boolean;
  taken_by_manager_nom: string | null;
  // For bonus form compatibility
  id?: string;
  nom?: string;
  equipe?: string;
  manager_id?: string;
  manager_nom?: string;
};

type CoureursComboboxProps = {
  phaseId: string;
  value: string | null;
  onSelect: (coureur: Coureur | null) => void;
  placeholder?: string;
  showTakenRiders?: boolean;
  disabled?: boolean;
  showManager?: boolean;
};

export const CoureursCombobox = ({
  phaseId,
  value,
  onSelect,
  placeholder = "Sélectionner un coureur...",
  showTakenRiders = true,
  disabled = false,
  showManager = false,
}: CoureursComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const { leagueId } = useLeague();

  // Fetch selected coureur by ID
  const { data: selectedCoureurData } = useQuery({
    queryKey: ['coureur-by-id', phaseId, value],
    queryFn: async () => {
      if (!value) return null;
      
      const { data, error } = await supabase
        .from('coureurs_disponibilite')
        .select('*')
        .eq('phase_id', phaseId)
        .eq('coureur_id', value)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!value && open,
  });

  // Fetch coureurs using edge function with pagination
  const {
    data: coureursPages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['coureurs-search-infinite', phaseId, leagueId, debouncedSearchTerm, showTakenRiders, showManager],
    queryFn: async ({ pageParam = 0 }) => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        return { items: [], pagination: { limit: 100, offset: 0, has_more: false } };
      }

      const { data, error } = await supabase.functions.invoke('auction-search-riders', {
        body: {
          phase_id: phaseId,
          league_id: leagueId,
          q: debouncedSearchTerm,
          available_only: !showTakenRiders,
          limit: 100,
          offset: pageParam,
          exclude_rider_ids: null,
        },
      });

      if (error) throw error;
      return data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.pagination.has_more) {
        return allPages.length * 100;
      }
      return undefined;
    },
    enabled: debouncedSearchTerm.length >= 2,
  });

  // Flatten all pages into a single array
  const coureurs = coureursPages?.pages.flatMap(page => 
    page.items.map((item: any) => ({
      coureur_id: item.rider_id,
      coureur_nom: item.rider_nom,
      coureur_equipe: item.rider_team,
      is_taken: item.is_taken,
      taken_by_manager_nom: item.taken_by_manager_nom,
      id: item.rider_id,
      nom: item.rider_nom,
      equipe: item.rider_team,
      manager_nom: item.taken_by_manager_nom,
    }))
  ) || [];

  // Enrich with manager_id if showManager is true
  const enrichedCoureurs = showManager ? coureurs : coureurs;

  const selectedCoureur = selectedCoureurData || enrichedCoureurs.find((c) => c.coureur_id === value);

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
          {selectedCoureur ? (
            <span className="truncate">{selectedCoureur.coureur_nom}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Tapez au moins 2 lettres..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>
              {isLoading 
                ? "Recherche en cours..." 
                : searchTerm.length < 2
                ? "Tapez au moins 2 lettres pour rechercher"
                : "Aucun coureur trouvé"}
            </CommandEmpty>
            {enrichedCoureurs.length > 0 && (
              <CommandGroup>
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {enrichedCoureurs.length} coureur{enrichedCoureurs.length > 1 ? 's' : ''} trouvé{enrichedCoureurs.length > 1 ? 's' : ''}
                </div>
                {enrichedCoureurs.map((coureur) => {
                  // Skip taken riders if showTakenRiders is false
                  if (!showTakenRiders && coureur.is_taken) return null;
                  
                  return (
                    <CommandItem
                      key={coureur.coureur_id}
                      value={coureur.coureur_nom}
                      onSelect={() => {
                        onSelect(coureur);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === coureur.coureur_id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center justify-between flex-1">
                        <div className="flex flex-col">
                          <span>{coureur.coureur_nom}</span>
                          {coureur.coureur_equipe && (
                            <span className="text-xs text-muted-foreground">
                              {coureur.coureur_equipe}
                            </span>
                          )}
                        </div>
                        {coureur.is_taken && coureur.taken_by_manager_nom && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {coureur.taken_by_manager_nom}
                          </Badge>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
                {hasNextPage && (
                  <div className="p-2 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Chargement...
                        </>
                      ) : (
                        "Charger plus"
                      )}
                    </Button>
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};