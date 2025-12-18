import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
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
import { useDebounce } from "use-debounce";

interface Coureur {
  id: string;
  nom: string;
  uci_id: string | null;
}

interface CoureurSearchComboboxProps {
  value: string;
  onSelect: (coureurId: string) => void;
  placeholder?: string;
}

export const CoureurSearchCombobox = ({
  value,
  onSelect,
  placeholder = "Sélectionner un coureur...",
}: CoureurSearchComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 300);

  // Fetch coureurs with search - server-side filtering
  const { data: coureurs, isLoading } = useQuery({
    queryKey: ["admin-coureurs-search", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("coureurs")
        .select("id, nom, uci_id")
        .order("nom")
        .limit(100);

      if (debouncedSearch.trim()) {
        query = query.ilike("nom", `%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Coureur[];
    },
    enabled: open,
  });

  // Fetch selected coureur info if we have a value
  const { data: selectedCoureur } = useQuery({
    queryKey: ["admin-coureur-selected", value],
    queryFn: async () => {
      if (!value) return null;
      const { data, error } = await supabase
        .from("coureurs")
        .select("id, nom, uci_id")
        .eq("id", value)
        .single();
      if (error) return null;
      return data as Coureur;
    },
    enabled: !!value,
  });

  const displayValue = useMemo(() => {
    if (selectedCoureur) {
      return selectedCoureur.uci_id
        ? `${selectedCoureur.nom} (UCI: ${selectedCoureur.uci_id})`
        : selectedCoureur.nom;
    }
    return placeholder;
  }, [selectedCoureur, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {displayValue}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Rechercher un coureur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <CommandList className="max-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Chargement...</span>
              </div>
            ) : !coureurs?.length ? (
              <CommandEmpty>
                {debouncedSearch
                  ? "Aucun coureur trouvé"
                  : "Tapez pour rechercher un coureur"}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {coureurs.map((coureur) => (
                  <CommandItem
                    key={coureur.id}
                    value={coureur.id}
                    onSelect={() => {
                      onSelect(coureur.id);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === coureur.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{coureur.nom}</span>
                      {coureur.uci_id && (
                        <span className="text-xs text-muted-foreground">
                          UCI: {coureur.uci_id}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
                {coureurs.length >= 100 && (
                  <div className="py-2 px-4 text-xs text-muted-foreground text-center">
                    Affinez votre recherche pour voir plus de résultats
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
