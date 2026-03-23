import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStartlistRiders, type StartlistRider } from "@/hooks/useArenaPronostics";

interface PronosticStartlistComboboxProps {
  courseId: string;
  value: string | null;
  onSelect: (coureurId: string, coureurNom: string) => void;
  disabled?: boolean;
}

export const PronosticStartlistCombobox = ({
  courseId,
  value,
  onSelect,
  disabled = false,
}: PronosticStartlistComboboxProps) => {
  const { t } = useTranslation("arena");
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: riders, isLoading } = useStartlistRiders(courseId);

  const filteredRiders = useMemo(() => {
    if (!riders) return [];
    if (!searchTerm.trim()) return riders;
    const term = searchTerm.toLowerCase();
    return riders.filter(
      (r) =>
        r.nom.toLowerCase().includes(term) ||
        (r.team && r.team.toLowerCase().includes(term))
    );
  }, [riders, searchTerm]);

  const selectedRider = riders?.find((r) => r.coureur_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-8 text-xs px-2"
          disabled={disabled}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selectedRider
              ? `${selectedRider.nom}${selectedRider.team ? ` (${selectedRider.team})` : ""}`
              : t("pronostics.selectRider")}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(350px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder={t("pronostics.searchRider")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <CommandList className="max-h-[250px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">
                  {t("pronostics.loadingRiders")}
                </span>
              </div>
            ) : filteredRiders.length === 0 ? (
              <CommandEmpty>
                {riders?.length === 0
                  ? t("pronostics.noStartlist")
                  : t("pronostics.noRiderFound")}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredRiders.map((rider) => (
                  <CommandItem
                    key={rider.coureur_id}
                    value={rider.coureur_id}
                    onSelect={() => {
                      onSelect(rider.coureur_id, rider.nom);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === rider.coureur_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{rider.nom}</span>
                      {rider.team && (
                        <span className="text-xs text-muted-foreground">
                          {rider.team}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
