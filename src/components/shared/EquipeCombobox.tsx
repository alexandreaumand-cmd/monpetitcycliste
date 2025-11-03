import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type EquipeSaison = {
  id: string;
  equipe_id: string;
  nom_affiche: string;
  equipe?: {
    code_court: string;
  };
};

type EquipeComboboxProps = {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  saisonId: string;
  placeholder?: string;
  disabled?: boolean;
};

export function EquipeCombobox({
  value,
  onValueChange,
  saisonId,
  placeholder = "Sélectionner une équipe...",
  disabled = false,
}: EquipeComboboxProps) {
  const [open, setOpen] = useState(false);

  const { data: equipes = [], isLoading } = useQuery({
    queryKey: ["equipes-saisons", saisonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipes_saisons")
        .select(`
          id,
          equipe_id,
          nom_affiche,
          equipe:equipe_id (
            code_court
          )
        `)
        .eq("saison_id", saisonId)
        .eq("actif", true)
        .order("nom_affiche");

      if (error) throw error;
      return data as EquipeSaison[];
    },
    enabled: !!saisonId,
  });

  const selectedEquipe = equipes.find((e) => e.id === value);

  const getDisplayValue = (equipe: EquipeSaison) => {
    const code = equipe.equipe?.code_court || "";
    return code ? `${code} - ${equipe.nom_affiche}` : equipe.nom_affiche;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          {selectedEquipe ? getDisplayValue(selectedEquipe) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher une équipe..." />
          <CommandList>
            <CommandEmpty>Aucune équipe trouvée.</CommandEmpty>
            <CommandGroup>
              {equipes.map((equipe) => (
                <CommandItem
                  key={equipe.id}
                  value={getDisplayValue(equipe)}
                  onSelect={() => {
                    onValueChange(equipe.id === value ? undefined : equipe.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === equipe.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {getDisplayValue(equipe)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
