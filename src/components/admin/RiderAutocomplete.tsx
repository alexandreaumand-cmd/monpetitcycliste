import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Rider = {
  coureur_id: string;
  coureur_nom: string;
  is_in_roster: boolean;
  roster_manager_nom: string | null;
  total_count?: number;
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
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 50;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['riders-lookup-paginated', phaseId, debouncedSearchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const query = (debouncedSearchQuery?.trim().length ?? 0) >= 2 ? debouncedSearchQuery : '';
      const started = performance.now();
      console.debug('[RiderAutocomplete] queryFn start', {
        pageParam,
        PAGE_SIZE,
        q: query,
        raw: debouncedSearchQuery,
      });
      const { data, error } = await supabase
        .rpc('search_riders_paginated', {
          p_phase_id: phaseId,
          p_query: query,
          p_page: pageParam,
          p_page_size: PAGE_SIZE,
        });

      if (error) {
        console.error('[RiderAutocomplete] queryFn error', error);
        throw error;
      }

      const mapped = (data || []).map(r => ({
        coureur_id: r.coureur_id,
        coureur_nom: r.coureur_nom,
        is_in_roster: !!r.manager_nom,
        roster_manager_nom: r.manager_nom,
        total_count: r.total_count,
      })) as Rider[];
      const totalCount = data?.[0]?.total_count || 0;
      const duration = Math.round(performance.now() - started);
      console.debug('[RiderAutocomplete] queryFn done', {
        pageParam,
        returned: mapped.length,
        totalCount,
        durationMs: duration,
      });

      return {
        riders: mapped,
        nextPage: pageParam + 1,
        totalCount,
      };
    },
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.totalCount / PAGE_SIZE);
      return lastPage.nextPage < totalPages ? lastPage.nextPage : undefined;
    },
    initialPageParam: 0,
    staleTime: 30000,
  });

  // Flatten all pages into a single rider array
  const riders = data?.pages.flatMap(page => page.riders) || [];
  const totalCount = data?.pages[0]?.totalCount || 0;

  // Infinite scroll observer
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    const target = observerTarget.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.debug('[RiderAutocomplete] auto-fetch next page');
          fetchNextPage();
        }
      },
      {
        root,
        rootMargin: "0px 0px 200px 0px",
        threshold: 0,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [open, riders.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher un coureur..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList ref={scrollRef} className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>
              {isLoading 
                ? "Recherche en cours..." 
                : "Aucun coureur trouvé."}
            </CommandEmpty>
            {riders.length > 0 && (
              <CommandGroup>
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {riders.length} / {totalCount} coureurs
                </div>
                {riders.map((rider) => (
                  <CommandItem
                    key={rider.coureur_id}
                    value={rider.coureur_nom}
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
                {/* Infinite scroll trigger */}
                <div ref={observerTarget} className="h-4 w-full" />
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {hasNextPage && !isFetchingNextPage && (
                  <div className="flex items-center justify-center py-2">
                    <Button variant="ghost" size="sm" onClick={() => {
                      console.debug('[RiderAutocomplete] manual load more click');
                      fetchNextPage();
                    }}>
                      Charger plus
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
