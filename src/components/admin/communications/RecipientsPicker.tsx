import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users } from "lucide-react";
import { useCommunicationRecipients, type CommunicationRecipient } from "@/hooks/useCommunicationRecipients";

interface RecipientsPickerProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

type StatusFilter = "all" | "confirmed" | "unconfirmed" | "banned";
type RoleFilter = "all" | "superadmin" | "league_admin" | "member";

export function RecipientsPicker({ selected, onChange }: RecipientsPickerProps) {
  const { data: recipients, isLoading } = useCommunicationRecipients();
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hideUnsubscribed, setHideUnsubscribed] = useState(true);

  const allLeagues = useMemo(() => {
    const map = new Map<string, string>();
    (recipients ?? []).forEach((r) => {
      r.league_ids.forEach((id, i) => {
        if (!map.has(id)) map.set(id, r.league_names[i] ?? "Ligue");
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [recipients]);

  const filtered = useMemo(() => {
    if (!recipients) return [];
    const q = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (hideUnsubscribed && r.unsubscribed) return false;
      if (q && !r.email.toLowerCase().includes(q) && !(r.manager_name ?? "").toLowerCase().includes(q)) return false;
      if (leagueFilter !== "all" && !r.league_ids.includes(leagueFilter)) return false;
      if (roleFilter === "superadmin" && !r.is_superadmin) return false;
      if (roleFilter === "league_admin" && !r.is_league_admin) return false;
      if (roleFilter === "member" && (r.is_superadmin || r.is_league_admin)) return false;
      if (statusFilter === "confirmed" && !r.email_confirmed) return false;
      if (statusFilter === "unconfirmed" && r.email_confirmed) return false;
      if (statusFilter === "banned" && !r.banned) return false;
      return true;
    });
  }, [recipients, search, leagueFilter, roleFilter, statusFilter, hideUnsubscribed]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.user_id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach((r) => next.delete(r.user_id));
    } else {
      filtered.forEach((r) => next.add(r.user_id));
    }
    onChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Destinataires
          </span>
          <Badge variant={selected.size > 0 ? "default" : "secondary"}>
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Recherche email ou nom"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={leagueFilter} onValueChange={setLeagueFilter}>
            <SelectTrigger><SelectValue placeholder="Ligue" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les ligues</SelectItem>
              {allLeagues.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger><SelectValue placeholder="Rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              <SelectItem value="superadmin">Super-admins</SelectItem>
              <SelectItem value="league_admin">Admins de ligue</SelectItem>
              <SelectItem value="member">Membres simples</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="confirmed">Email confirmé</SelectItem>
              <SelectItem value="unconfirmed">Non confirmé</SelectItem>
              <SelectItem value="banned">Banni</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={hideUnsubscribed} onCheckedChange={(c) => setHideUnsubscribed(!!c)} />
            Masquer les désinscrits
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll} disabled={filtered.length === 0}>
              {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner (filtre)"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(new Set())} disabled={selected.size === 0}>
              Vider
            </Button>
          </div>
        </div>

        <div className="border rounded-md max-h-[480px] overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Aucun utilisateur ne correspond aux filtres.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="w-10 p-2"></th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Manager</th>
                  <th className="text-left p-2">Ligues</th>
                  <th className="text-left p-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggleOne(r.user_id)}>
                    <td className="p-2"><Checkbox checked={selected.has(r.user_id)} /></td>
                    <td className="p-2 font-mono text-xs">{r.email}</td>
                    <td className="p-2">{r.manager_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.league_names.join(", ") || "—"}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {r.is_superadmin && <Badge variant="default" className="text-xs">SuperAdmin</Badge>}
                        {r.is_league_admin && <Badge variant="secondary" className="text-xs">Admin ligue</Badge>}
                        {!r.email_confirmed && <Badge variant="outline" className="text-xs">Non confirmé</Badge>}
                        {r.banned && <Badge variant="destructive" className="text-xs">Banni</Badge>}
                        {r.unsubscribed && <Badge variant="outline" className="text-xs">Désinscrit</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export type { CommunicationRecipient };
