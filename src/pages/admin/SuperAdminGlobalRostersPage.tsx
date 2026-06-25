import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalRosters, type GlobalRostersFilters } from "@/hooks/useGlobalRosters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZE = 100;

export default function SuperAdminGlobalRostersPage() {
  const [searchParams] = useSearchParams();

  const [coureurInput, setCoureurInput] = useState("");
  const [managerInput, setManagerInput] = useState("");
  const [gameMode, setGameMode] = useState<string>("all");
  const [saisonId, setSaisonId] = useState<string>("all");
  const [leagueId, setLeagueId] = useState<string>(() => searchParams.get("leagueId") ?? "all");
  const [page, setPage] = useState(0);

  const coureurSearch = useDebouncedValue(coureurInput, 300);
  const managerSearch = useDebouncedValue(managerInput, 300);

  const { data: saisons } = useQuery({
    queryKey: ["saisons-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("saisons").select("id, annee").order("annee", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leagues } = useQuery({
    queryKey: ["leagues-list-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leagues")
        .select("id, name, saison:saison_id (annee)")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        saison_annee: (l.saison as { annee?: number } | null)?.annee ?? null,
      }));
    },
  });

  const filters: GlobalRostersFilters = useMemo(
    () => ({
      saisonId: saisonId === "all" ? null : saisonId,
      leagueIds: leagueId === "all" ? null : [leagueId],
      gameModes: gameMode === "all" ? null : [gameMode],
      coureurSearch,
      managerSearch,
      page,
      pageSize: PAGE_SIZE,
    }),
    [saisonId, leagueId, gameMode, coureurSearch, managerSearch, page],
  );

  const { data, isLoading, isFetching } = useGlobalRosters(filters);
  const rawRows = data?.rows ?? [];
  const total = Number(data?.totalCount ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  type SortKey =
    | "coureur_nom"
    | "equipe_nom"
    | "cote"
    | "manager_nom"
    | "league_name"
    | "game_mode"
    | "saison_annee"
    | "phase_index"
    | "prix_signature"
    | "round_achat";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const rows = useMemo(() => {
    if (!sortKey) return rawRows;
    const sorted = [...rawRows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "fr", { numeric: true });
    });
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [rawRows, sortKey, sortDir]);

  const SortHeader = ({
    label,
    sKey,
    align = "left",
  }: {
    label: string;
    sKey: SortKey;
    align?: "left" | "right" | "center";
  }) => {
    const active = sortKey === sKey;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
    return (
      <button
        type="button"
        onClick={() => toggleSort(sKey)}
        className={`flex items-center gap-1 w-full ${justify} hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
      >
        <span>{label}</span>
        <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    );
  };

  const uniqueCoureurs = new Set(rows.map((r) => r.coureur_id)).size;
  const uniqueManagers = new Set(rows.map((r) => r.manager_id)).size;

  const gameModeLabel = (m: string) =>
    m === "per_course" ? "À la course" : m === "five_phases" ? "5 phases" : m === "full_season" ? "Saison" : m;

  const exportCsv = () => {
    const header = [
      "Coureur",
      "Équipe",
      "Cote",
      "Manager",
      "Ligue",
      "Type",
      "Saison",
      "Phase",
      "Prix payé",
      "Round",
    ];
    const lines = rows.map((r) =>
      [
        r.coureur_nom,
        r.equipe_nom ?? "",
        r.cote ?? "",
        r.manager_nom,
        r.league_name,
        gameModeLabel(r.game_mode),
        r.saison_annee,
        r.phase_index,
        r.prix_signature ?? "",
        r.round_achat ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `global-rosters-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Rosters globaux</h2>
        <p className="text-sm text-muted-foreground">
          Toutes les détentions de coureurs, toutes ligues, toutes phases. Idéal pour vérifier si un coureur est détenu
          avant de saisir un résultat.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un coureur…"
              className="pl-8"
              value={coureurInput}
              onChange={(e) => {
                setCoureurInput(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un manager…"
              className="pl-8"
              value={managerInput}
              onChange={(e) => {
                setManagerInput(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <Select
            value={saisonId}
            onValueChange={(v) => {
              setSaisonId(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Saison" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les saisons</SelectItem>
              {saisons?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.annee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={gameMode}
            onValueChange={(v) => {
              setGameMode(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type de ligue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="five_phases">À la phase (5 phases)</SelectItem>
              <SelectItem value="full_season">À la phase (saison)</SelectItem>
              <SelectItem value="per_course">À la course</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={leagueId}
            onValueChange={(v) => {
              setLeagueId(v);
              setPage(0);
              const params = new URLSearchParams(searchParams);
              if (v === "all") {
                params.delete("leagueId");
              } else {
                params.set("leagueId", v);
              }
              window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ligue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les ligues</SelectItem>
              {leagues?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} {l.saison_annee ? `(${l.saison_annee})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            {isFetching && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
            <strong>{total}</strong> rosters · <strong>{uniqueCoureurs}</strong> coureurs (page) ·{" "}
            <strong>{uniqueManagers}</strong> managers (page)
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader label="Coureur" sKey="coureur_nom" /></TableHead>
                <TableHead><SortHeader label="Équipe" sKey="equipe_nom" /></TableHead>
                <TableHead className="text-right"><SortHeader label="Cote" sKey="cote" align="right" /></TableHead>
                <TableHead><SortHeader label="Manager" sKey="manager_nom" /></TableHead>
                <TableHead><SortHeader label="Ligue" sKey="league_name" /></TableHead>
                <TableHead><SortHeader label="Type" sKey="game_mode" /></TableHead>
                <TableHead className="text-center"><SortHeader label="Saison" sKey="saison_annee" align="center" /></TableHead>
                <TableHead className="text-center"><SortHeader label="Phase" sKey="phase_index" align="center" /></TableHead>
                <TableHead className="text-right"><SortHeader label="Prix payé" sKey="prix_signature" align="right" /></TableHead>
                <TableHead className="text-center"><SortHeader label="Round" sKey="round_achat" align="center" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    Aucun roster trouvé avec ces filtres.
                    {coureurInput && (
                      <div className="mt-1 text-xs">
                        → Personne ne détient « {coureurInput} » : tu peux sauter la saisie du résultat.
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.roster_id}>
                    <TableCell className="font-medium">{r.coureur_nom}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.equipe_nom ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.cote ?? "—"}</TableCell>
                    <TableCell>{r.manager_nom}</TableCell>
                    <TableCell>{r.league_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {gameModeLabel(r.game_mode)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{r.saison_annee}</TableCell>
                    <TableCell className="text-center tabular-nums">P{r.phase_index}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {r.prix_signature ?? "—"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {r.round_achat ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page + 1} / {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
