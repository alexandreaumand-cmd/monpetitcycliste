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
import { useStartlistTeams, type StartlistTeam } from "@/hooks/useArenaPronostics";

interface PronosticStartlistTeamComboboxProps {
  courseId: string;
  value: string | null; // equipe_saison_id
  onSelect: (equipeSaisonId: string, equipeName: string) => void;
  disabled?: boolean;
}

export const PronosticStartlistTeamCombobox = ({
  courseId,
  value,
  onSelect,
  disabled = false,
}: PronosticStartlistTeamComboboxProps) => {
  const { t } = useTranslation("arena");
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: teams, isLoading } = useStartlistTeams(courseId);

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!searchTerm.trim()) return teams;
    const term = searchTerm.toLowerCase();
    return teams.filter((t) => t.nom_affiche.toLowerCase().includes(term));
  }, [teams, searchTerm]);

  const selectedTeam = teams?.find((t) => t.equipe_saison_id === value);

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
            {selectedTeam
              ? selectedTeam.nom_affiche
              : t("pronostics.selectTeam")}
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
              placeholder={t("pronostics.searchTeam")}
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
            ) : filteredTeams.length === 0 ? (
              <CommandEmpty>
                {teams?.length === 0
                  ? t("pronostics.noStartlist")
                  : t("pronostics.noTeamFound")}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredTeams.map((team) => (
                  <CommandItem
                    key={team.equipe_saison_id}
                    value={team.equipe_saison_id}
                    onSelect={() => {
                      onSelect(team.equipe_saison_id, team.nom_affiche);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === team.equipe_saison_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-medium">{team.nom_affiche}</span>
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
