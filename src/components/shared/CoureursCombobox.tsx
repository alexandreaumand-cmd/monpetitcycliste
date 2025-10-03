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
import { normalizeString } from "@/lib/stringUtils";

type Coureur = {
  coureur_id: string;
  coureur_nom: string;
  coureur_equipe: string | null;
  is_taken: boolean;
  taken_by_manager_nom: string | null;
};

type CoureursComboboxProps = {
  phaseId: string;
  value: string | null;
  onSelect: (coureur: Coureur | null) => void;
  placeholder?: string;
  showTakenRiders?: boolean;
};

export const CoureursCombobox = ({
  phaseId,
  value,
  onSelect,
  placeholder = "Sélectionner un coureur...",
  showTakenRiders = true,
}: CoureursComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  const { data: coureurs = [], isLoading } = useQuery({
    queryKey: ['coureurs-search', phaseId, debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) return [];
      
      const normalizedSearch = normalizeString(debouncedSearchTerm);
      const { data, error } = await supabase
        .from('coureurs_disponibilite')
        .select('*')
        .eq('phase_id', phaseId)
        .ilike('search_text', `%${normalizedSearch}%`)
        .order('is_taken', { ascending: true })
        .order('coureur_nom', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearchTerm.length >= 2,
  });

  const selectedCoureur = coureurs.find((c) => c.coureur_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
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
            {coureurs.length > 0 && (
              <CommandGroup>
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {coureurs.length} coureur{coureurs.length > 1 ? 's' : ''} trouvé{coureurs.length > 1 ? 's' : ''}
                </div>
                {coureurs.map((coureur) => {
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
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
