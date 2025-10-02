import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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

  const { data: riders } = useQuery({
    queryKey: ['riders-lookup', phaseId],
    queryFn: async () => {
      const { data: coureurs, error: coureursError } = await supabase
        .from('coureurs')
        .select('id, nom')
        .order('nom');

      if (coureursError) throw coureursError;

      const { data: rosters, error: rostersError } = await supabase
        .from('rosters')
        .select('coureur_id, managers(nom)')
        .eq('phase_id', phaseId);

      if (rostersError) throw rostersError;

      const rosterMap = new Map(
        rosters?.map(r => [
          r.coureur_id,
          (r.managers as any)?.nom || null
        ]) || []
      );

      return coureurs.map(c => ({
        coureur_id: c.id,
        coureur_nom: c.nom,
        is_in_roster: rosterMap.has(c.id),
        roster_manager_nom: rosterMap.get(c.id) || null,
      })) as Rider[];
    },
  });

  const filteredRiders = riders?.filter(r => 
    r.coureur_nom.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 50); // Limit to 50 for performance

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
            <CommandEmpty>Aucun coureur trouvé.</CommandEmpty>
            <CommandGroup>
              {filteredRiders?.map((rider) => (
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
