import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SuperAdminLeagueActions } from "./SuperAdminLeagueActions";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Users,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { useDebounce } from "use-debounce";
import { useIsMobile } from "@/hooks/use-mobile";
import type { League } from "@/lib/leagues/types";

type LeagueWithStats = League & {
  member_count: number;
  invite_count: number;
  owner_name: string;
  owner_email: string | null;
  member_names: string[];
  course_names: string[];
};

type LeaguesResponse = {
  leagues: LeagueWithStats[];
  total: number;
  page: number;
  limit: number;
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "active": return "default" as const;
    case "pending": return "secondary" as const;
    case "completed": return "outline" as const;
    default: return "destructive" as const;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "active": return "Active";
    case "pending": return "En attente";
    case "completed": return "Terminée";
    case "cancelled": return "Archivée";
    default: return status;
  }
};

const gameModeLabel = (mode: string) => {
  switch (mode) {
    case "five_phases": return "5 Phases";
    case "per_course": return "À la course";
    case "full_season": return "Saison complète";
    case "short_gt": return "GT courts";
    case "short_wt": return "WT courts";
    case "short_classics": return "Classiques";
    default: return mode;
  }
};

export function SuperAdminLeaguesTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [gameMode, setGameMode] = useState<string>("all");
  const [visibility, setVisibility] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const limit = 20;
  const isMobile = useIsMobile();

  const [debouncedSearch] = useDebounce(search, 500);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-leagues-list", debouncedSearch, status, gameMode, visibility, sortOrder, page],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (gameMode !== "all") params.set("game_mode", gameMode);
      if (visibility !== "all") params.set("visibility", visibility);
      params.set("sort_order", sortOrder);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-leagues-list?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erreur lors du chargement des ligues");
      }

      return response.json() as Promise<LeaguesResponse>;
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const renderMobileCard = (league: LeagueWithStats) => (
    <div key={league.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header: name + status + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-semibold text-sm truncate">{league.name}</span>
          <div className="flex flex-wrap gap-1">
            <Badge variant={statusBadgeVariant(league.status)} className="text-[10px]">
              {statusLabel(league.status)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {gameModeLabel(league.game_mode)}
            </Badge>
            <Badge variant={league.visibility === "public" ? "default" : "secondary"} className="text-[10px]">
              {league.visibility === "public" ? "Publique" : "Privée"}
            </Badge>
          </div>
        </div>
        <SuperAdminLeagueActions league={league} onActionComplete={() => refetch()} />
      </div>

      {/* Owner */}
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{league.owner_name}</span>
        {league.owner_email && <span className="ml-1">({league.owner_email})</span>}
      </div>

      {/* Date */}
      <div className="text-xs text-muted-foreground">
        Créée le {format(new Date(league.created_at), "dd MMM yyyy", { locale: fr })}
      </div>

      {/* Members progress */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{league.member_count}</span>
          <span className="text-muted-foreground">/ {league.max_players}</span>
        </div>
        <Progress value={(league.member_count / league.max_players) * 100} className="h-1" />
      </div>

      {/* Collapsible members */}
      {league.member_names && league.member_names.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-3 w-3" />
            <Users className="h-3 w-3" />
            Voir les membres ({league.member_names.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-1">
              {league.member_names.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {name}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Collapsible courses (per_course only) */}
      {league.game_mode === "per_course" && league.course_names && league.course_names.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-3 w-3" />
            <MapPin className="h-3 w-3" />
            Courses sélectionnées ({league.course_names.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-1">
              {league.course_names.map((name, i) => (
                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                  {name}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );

  const renderDesktopTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Propriétaire</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>Visibilité</TableHead>
          <TableHead>Membres</TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 font-medium hover:bg-transparent"
              onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
            >
              Créée
              <ArrowUpDown className="ml-1 h-3 w-3" />
            </Button>
          </TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.leagues.map((league) => (
          <TableRow key={league.id}>
            <TableCell>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{league.name}</span>
                <Badge variant={statusBadgeVariant(league.status)} className="w-fit">
                  {statusLabel(league.status)}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{league.owner_name}</span>
                {league.owner_email && (
                  <span className="text-xs text-muted-foreground">{league.owner_email}</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{gameModeLabel(league.game_mode)}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={league.visibility === "public" ? "default" : "secondary"}>
                {league.visibility === "public" ? "Publique" : "Privée"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{league.member_count}</span>
                  <span className="text-muted-foreground">/ {league.max_players}</span>
                </div>
                <Progress value={(league.member_count / league.max_players) * 100} className="h-1" />
                {/* Expandable member names */}
                {league.member_names && league.member_names.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Voir les noms ▸
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1">
                      <div className="flex flex-wrap gap-1">
                        {league.member_names.map((name, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{name}</Badge>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {format(new Date(league.created_at), "dd MMM yyyy", { locale: fr })}
            </TableCell>
            <TableCell className="text-right">
              <SuperAdminLeagueActions league={league} onActionComplete={() => refetch()} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-2xl">Toutes les ligues ({data?.total || 0})</CardTitle>
        <div className="grid gap-2 pt-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
              <SelectItem value="cancelled">Archivée</SelectItem>
            </SelectContent>
          </Select>

          <Select value={gameMode} onValueChange={setGameMode}>
            <SelectTrigger className="h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous modes</SelectItem>
              <SelectItem value="five_phases">5 Phases</SelectItem>
              <SelectItem value="per_course">À la course</SelectItem>
              <SelectItem value="full_season">Saison complète</SelectItem>
              <SelectItem value="short_gt">GT courts</SelectItem>
              <SelectItem value="short_wt">WT courts</SelectItem>
              <SelectItem value="short_classics">Classiques</SelectItem>
            </SelectContent>
          </Select>

          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger className="h-9 text-xs sm:text-sm">
              <SelectValue placeholder="Visibilité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="public">Publique</SelectItem>
              <SelectItem value="private">Privée</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs sm:text-sm"
            onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            Date {sortOrder === "desc" ? "↓" : "↑"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            {isMobile ? (
              <div className="space-y-3">
                {data?.leagues.map(renderMobileCard)}
                {data?.leagues.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucune ligue trouvée
                  </p>
                )}
              </div>
            ) : (
              renderDesktopTable()
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Page {page + 1}/{totalPages} • {data?.total} résultats
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Précédent</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
                    <span className="hidden sm:inline">Suivant</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
