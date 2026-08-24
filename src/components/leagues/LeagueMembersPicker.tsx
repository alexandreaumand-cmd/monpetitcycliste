import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { SourceMember } from "@/hooks/useLeagueSourceSettings";
import { Search, Plus, X, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

export type PickedMember = {
  userId: string;
  name: string;
};

type Props = {
  sourceMembers: SourceMember[];
  /** user_id of the current user — always kept as owner, not removable. */
  selfUserId: string | null;
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  extraMembers: PickedMember[];
  onExtraMembersChange: (members: PickedMember[]) => void;
  maxPlayers: number;
};

export function LeagueMembersPicker({
  sourceMembers,
  selfUserId,
  selectedUserIds,
  onChange,
  extraMembers,
  onExtraMembersChange,
  maxPlayers,
}: Props) {
  const { t } = useTranslation('leagues');
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const knownUserIds = useMemo(
    () => new Set([
      ...sourceMembers.map(m => m.userId),
      ...extraMembers.map(m => m.userId),
      ...(selfUserId ? [selfUserId] : []),
    ]),
    [sourceMembers, extraMembers, selfUserId]
  );

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['managers-search-members', debouncedSearch],
    enabled: debouncedSearch.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers')
        .select('id, user_id, nom')
        .not('user_id', 'is', null)
        .ilike('nom', `%${debouncedSearch.trim()}%`)
        .order('nom')
        .limit(12);
      if (error) throw error;
      return (data || []) as Array<{ id: string; user_id: string; nom: string }>;
    },
  });

  // Selected members exclude self (always owner) — total counts self in.
  const otherSourceMembers = sourceMembers.filter(m => m.userId !== selfUserId);
  const totalSelected = 1 + selectedUserIds.length + extraMembers.length;
  const isFull = totalSelected >= maxPlayers;

  const toggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter(id => id !== userId));
    } else if (!isFull) {
      onChange([...selectedUserIds, userId]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('members.desc')}</p>
        <Badge variant={isFull ? "default" : "secondary"} className="text-xs shrink-0">
          {t('members.counter', { count: totalSelected, max: maxPlayers })}
        </Badge>
      </div>

      {otherSourceMembers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {t('members.fromSource')}
          </p>
          <ScrollArea className="h-56 rounded-md border">
            <div className="space-y-1 p-2">

              {otherSourceMembers.map((m) => {
                const checked = selectedUserIds.includes(m.userId);
                return (
                  <label
                    key={m.userId}
                    className="flex items-center gap-3 p-2 rounded-md border hover:bg-accent/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!checked && isFull}
                      onCheckedChange={() => toggle(m.userId)}
                    />
                    <span className="text-sm flex-1 truncate">{m.name}</span>
                    {m.role !== 'member' && (
                      <Badge variant="outline" className="text-xs">{m.role}</Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {t('members.addOthers')}
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('members.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {debouncedSearch.trim().length >= 2 && (
          <div className="space-y-1">
            {isFetching && (
              <p className="text-xs text-muted-foreground">{t('members.searching')}</p>
            )}
            {!isFetching && searchResults.filter(r => !knownUserIds.has(r.user_id)).length === 0 && (
              <p className="text-xs text-muted-foreground">{t('members.noResults')}</p>
            )}
            {searchResults
              .filter(r => !knownUserIds.has(r.user_id))
              .map((r) => (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded-md border">
                  <span className="text-sm flex-1 truncate">{r.nom}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isFull}
                    onClick={() => onExtraMembersChange([...extraMembers, { userId: r.user_id, name: r.nom }])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('members.add')}
                  </Button>
                </div>
              ))}
          </div>
        )}

        {extraMembers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {extraMembers.map((m) => (
              <Badge key={m.userId} variant="secondary" className="gap-1">
                <UserPlus className="h-3 w-3" />
                {m.name}
                <button
                  type="button"
                  onClick={() => onExtraMembersChange(extraMembers.filter(x => x.userId !== m.userId))}
                  className="ml-0.5 hover:text-destructive"
                  aria-label={t('members.remove')}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground italic">{t('members.inviteHint')}</p>
    </div>
  );
}
