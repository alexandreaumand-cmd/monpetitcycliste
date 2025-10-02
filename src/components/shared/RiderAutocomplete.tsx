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
  allowTaken = true,
}: RiderAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  const { data: coureurs, isLoading } = useQuery({
    queryKey: ['coureurs-disponibilite', debouncedSearchTerm, phaseId, open],
    queryFn: async () => {
      const q = (debouncedSearchTerm || "").trim();

      // 1) Fetch riders from base table 'coureurs'
      let coureursQuery = supabase
        .from('coureurs')
        .select('id, nom, equipe, prix_initial');

      // Apply filter only if search has 2+ chars
      if (q.length >= 2) {
        coureursQuery = coureursQuery.ilike('nom', `%${q}%`);
      }

      const { data: baseRiders, error: ridersError } = await coureursQuery
        .order('nom', { ascending: true })
        .limit(50);

      if (ridersError) throw ridersError;

      // 2) Fetch roster assignments for the phase to annotate availability + manager name
      const { data: rosters, error: rostersError } = await supabase
        .from('rosters')
        .select('coureur_id, manager_id')
        .eq('phase_id', phaseId);

      if (rostersError) throw rostersError;

      const managerIds = Array.from(new Set((rosters || []).map((r: any) => r.manager_id).filter(Boolean)));
      let managersMap: Record<string, string> = {};

      if (managerIds.length > 0) {
        const { data: managers, error: managersError } = await supabase
          .from('managers')
          .select('id, nom')
          .in('id', managerIds as string[]);

        if (managersError) throw managersError;
        managersMap = Object.fromEntries((managers || []).map((m: any) => [m.id as string, m.nom as string]));
      }

      const rosterMap = new Map<string, string | null>();
      (rosters || []).forEach((r: any) => {
        if (r.coureur_id) {
          const managerName = r.manager_id ? managersMap[r.manager_id as string] : null;
          if (!rosterMap.has(r.coureur_id)) {
            rosterMap.set(r.coureur_id, managerName || null);
          }
        }
      });

      const result = (baseRiders || []).map((c: any) => ({
        coureur_id: c.id,
        coureur_nom: c.nom,
        coureur_equipe: c.equipe ?? null,
        prix_initial: c.prix_initial ?? null,
        is_taken: rosterMap.has(c.id),
        taken_by_manager_nom: rosterMap.get(c.id) || null,
      }));

      // Sort: available first, then by name asc
      result.sort((a: any, b: any) => {
        if (a.is_taken !== b.is_taken) return a.is_taken ? 1 : -1;
        return a.coureur_nom.localeCompare(b.coureur_nom);
      });

      return result;
    },
    enabled: open, // Only fetch when popover is open
    staleTime: 0,
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
