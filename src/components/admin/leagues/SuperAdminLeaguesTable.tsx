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
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Search, AlertTriangle } from "lucide-react";
import { useDebounce } from "use-debounce";
import type { League } from "@/lib/leagues/types";

type LeagueWithStats = League & {
  member_count: number;
  invite_count: number;
  owner_name: string;
  owner_email: string | null;
};

type LeaguesResponse = {
  leagues: LeagueWithStats[];
  total: number;
  page: number;
  limit: number;
};

export function SuperAdminLeaguesTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [gameMode, setGameMode] = useState<string>("all");
  const [visibility, setVisibility] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const [debouncedSearch] = useDebounce(search, 500);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "admin-leagues-list",
      debouncedSearch,
      status,
      gameMode,
      visibility,
      page,
    ],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (gameMode !== "all") params.set("game_mode", gameMode);
      if (visibility !== "all") params.set("visibility", visibility);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-leagues-list?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du chargement des ligues');
      }

      return response.json() as Promise<LeaguesResponse>;
    },
  });

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "pending":
        return "secondary";
      case "completed":
        return "outline";
      default:
        return "destructive";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "pending":
        return "En attente";
      case "completed":
        return "Terminée";
      case "cancelled":
        return "Archivée";
      default:
        return status;
    }
  };

  const gameModeLabel = (mode: string) => {
    switch (mode) {
      case "full_season":
        return "Saison complète";
      case "short_gt":
        return "GT courts";
      case "short_wt":
        return "WT courts";
      case "short_classics":
        return "Classiques";
      default:
        return mode;
    }
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Toutes les ligues ({data?.total || 0})</CardTitle>
        <div className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une ligue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
              <SelectItem value="cancelled">Archivée</SelectItem>
            </SelectContent>
          </Select>

          <Select value={gameMode} onValueChange={setGameMode}>
            <SelectTrigger>
              <SelectValue placeholder="Mode de jeu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modes</SelectItem>
              <SelectItem value="full_season">Saison complète</SelectItem>
              <SelectItem value="short_gt">GT courts</SelectItem>
              <SelectItem value="short_wt">WT courts</SelectItem>
              <SelectItem value="short_classics">Classiques</SelectItem>
            </SelectContent>
          </Select>

          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger>
              <SelectValue placeholder="Visibilité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="public">Publique</SelectItem>
              <SelectItem value="private">Privée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Propriétaire</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Membres</TableHead>
                    <TableHead>Visibilité</TableHead>
                    <TableHead>Créée</TableHead>
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
                            <span className="text-xs text-muted-foreground">
                              {league.owner_email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{gameModeLabel(league.game_mode)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{league.member_count}</span>
                            <span className="text-muted-foreground">/ {league.max_players}</span>
                          </div>
                          <Progress
                            value={(league.member_count / league.max_players) * 100}
                            className="h-1"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={league.visibility === "public" ? "default" : "secondary"}>
                          {league.visibility === "public" ? "Publique" : "Privée"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(league.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <SuperAdminLeagueActions league={league} onActionComplete={() => refetch()} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page + 1} sur {totalPages} • {data.total} résultats
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Suivant
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
