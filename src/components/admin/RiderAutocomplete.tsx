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
  const [debouncedSearchQuery] = useDebounce(searchQuery, 200);

  const { data: riders, isLoading } = useQuery({
    queryKey: ['riders-lookup-admin', phaseId, debouncedSearchQuery],
    queryFn: async () => {
      // Server-side search using unaccent for better matching
      let query = supabase
        .from('coureurs')
        .select(`
          id,
          nom,
          rosters!left(
            coureur_id,
            managers(nom)
          )
        `)
        .eq('rosters.phase_id', phaseId);

      // Apply search filter if query is not empty
      if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
        // Use the normalize_text function for accent-insensitive search
        const normalizedQuery = debouncedSearchQuery.toLowerCase().trim();
        query = query.or(`nom.ilike.%${normalizedQuery}%`);
      }

      const { data: coureurs, error } = await query
        .order('nom')
        .limit(50);

      if (error) throw error;

      // Transform the data
      return coureurs.map(c => {
        const roster = Array.isArray(c.rosters) && c.rosters.length > 0 
          ? c.rosters.find((r: any) => r.coureur_id === c.id)
          : null;
        
        return {
          coureur_id: c.id,
          coureur_nom: c.nom,
          is_in_roster: !!roster,
          roster_manager_nom: roster?.managers?.nom || null,
        };
      }) as Rider[];
    },
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
        <Command>
          <CommandInput 
            placeholder="Rechercher un coureur..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Recherche en cours..." : "Aucun coureur trouvé."}
            </CommandEmpty>
            <CommandGroup>
              {riders?.map((rider) => (
                <CommandItem
                  key={rider.coureur_id}
                  value={rider.coureur_id}
                  onSelect={() => {
                    onChange(rider.coureur_id, rider.coureur_nom);
                    setOpen(false);
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
        </Command>
      </PopoverContent>
    </Popover>
  );
};
