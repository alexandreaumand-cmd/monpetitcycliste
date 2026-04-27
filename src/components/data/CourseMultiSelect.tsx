import { useState, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CourseOption = {
  id: string;
  nom: string;
  date_debut: string | null;
};

interface CourseMultiSelectProps {
  options: CourseOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function CourseMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Filtrer par course...",
  className,
}: CourseMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOptions = useMemo(
    () => options.filter((o) => selected.includes(o.id)),
    [options, selected]
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((v) => v !== id));
    else onChange([...selected, id]);
  };

  const clear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-sm">
              {selected.length === 0
                ? placeholder
                : `${selected.length} course${selected.length > 1 ? "s" : ""} sélectionnée${selected.length > 1 ? "s" : ""}`}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {selected.length > 0 && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={clear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command
            filter={(value, search) => {
              if (!search) return 1;
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Rechercher une course..." />
            <CommandList className="max-h-72">
              <CommandEmpty>Aucune course trouvée</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = selected.includes(opt.id);
                  const dateLabel = opt.date_debut
                    ? new Date(opt.date_debut).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "";
                  return (
                    <CommandItem
                      key={opt.id}
                      value={`${opt.nom} ${dateLabel}`}
                      onSelect={() => toggle(opt.id)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1 truncate">{opt.nom}</span>
                      {dateLabel && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {dateLabel}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt) => (
            <Badge
              key={opt.id}
              variant="secondary"
              className="text-xs gap-1 pr-1"
            >
              <span className="truncate max-w-[160px]">{opt.nom}</span>
              <button
                type="button"
                onClick={() => toggle(opt.id)}
                className="ml-0.5 rounded-sm hover:bg-muted-foreground/20"
                aria-label="Retirer"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
