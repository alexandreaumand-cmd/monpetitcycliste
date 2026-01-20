import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Clock, CheckCircle, XCircle, UserPlus, UserMinus, AlertCircle, Edit, Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { TrackerChangeMatchDialog } from "./TrackerChangeMatchDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TrackerChange {
  id: string;
  rider_name: string;
  team_name: string | null;
  course_name: string;
  course_id: string | null;
  coureur_id: string | null;
  change_type: string;
  processed: boolean;
  detected_at: string;
  validation_status: string;
}

type TypeFilter = "all" | "added" | "removed";
type StatusFilter = "all" | "validated" | "pending" | "unmatched" | "skipped";

export const StartlistTracker = () => {
  const queryClient = useQueryClient();
  const [raceUrl, setRaceUrl] = useState("");
  const [selectedChange, setSelectedChange] = useState<TrackerChange | null>(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Fetch recent runs
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["startlist-tracker-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("startlist_tracker_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent changes
  const { data: changes, isLoading: changesLoading } = useQuery({
    queryKey: ["startlist-tracker-changes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("startlist_tracker_changes")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Trigger global scrape
  const globalScrapeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("startlist-tracker", {
        body: { source_type: "global" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Scraping terminé: ${data.changes_detected} changements détectés, ${data.changes_processed} traités`);
      queryClient.invalidateQueries({ queryKey: ["startlist-tracker-runs"] });
      queryClient.invalidateQueries({ queryKey: ["startlist-tracker-changes"] });
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Trigger race-specific scrape
  const raceScrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke("startlist-tracker", {
        body: { source_type: "race", race_url: url },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Scraping terminé: ${data.changes_detected} coureurs détectés, ${data.changes_processed} traités`);
      queryClient.invalidateQueries({ queryKey: ["startlist-tracker-runs"] });
      queryClient.invalidateQueries({ queryKey: ["startlist-tracker-changes"] });
      setRaceUrl("");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge variant="outline" className="text-primary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En cours</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-primary"><CheckCircle className="h-3 w-3 mr-1" />Terminé</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Échoué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getChangeTypeBadge = (type: string) => {
    if (type === "added") {
      return <Badge variant="secondary" className="bg-primary/10 text-primary"><UserPlus className="h-3 w-3 mr-1" />Ajouté</Badge>;
    }
    return <Badge variant="destructive"><UserMinus className="h-3 w-3 mr-1" />Retiré</Badge>;
  };

  // Stats
  const stats = {
    totalRuns: runs?.length || 0,
    lastRun: runs?.[0],
    totalChanges: changes?.length || 0,
    addedCount: changes?.filter((c: any) => c.change_type === "added").length || 0,
    removedCount: changes?.filter((c: any) => c.change_type === "removed").length || 0,
    processedCount: changes?.filter((c: any) => c.processed).length || 0,
  };

  // Filtered changes
  const filteredChanges = useMemo(() => {
    if (!changes) return [];
    return changes.filter((change: TrackerChange) => {
      const typeMatch = typeFilter === "all" || change.change_type === typeFilter;
      const statusMatch = statusFilter === "all" || change.validation_status === statusFilter;
      return typeMatch && statusMatch;
    });
  }, [changes, typeFilter, statusFilter]);

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "all";

  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Startlist Tracker</h2>
          <p className="text-muted-foreground">
            Suivi automatique des changements de startlists via ProCyclingStats
          </p>
        </div>
        <Button
          onClick={() => globalScrapeMutation.mutate()}
          disabled={globalScrapeMutation.isPending}
        >
          {globalScrapeMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Lancer le scraping global
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.totalRuns}</p>
                <p className="text-sm text-muted-foreground">Exécutions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalChanges}</p>
                <p className="text-sm text-muted-foreground">Changements détectés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.addedCount}</p>
                <p className="text-sm text-muted-foreground">Ajouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserMinus className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.removedCount}</p>
                <p className="text-sm text-muted-foreground">Retraits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Race-specific scraping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scraper une course spécifique</CardTitle>
          <CardDescription>
            Entrez l'URL PCS d'une course pour importer sa startlist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.procyclingstats.com/race/tour-de-france/2025/startlist"
              value={raceUrl}
              onChange={(e) => setRaceUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => raceScrapeMutation.mutate(raceUrl)}
              disabled={!raceUrl || raceScrapeMutation.isPending}
            >
              {raceScrapeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Scraper"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for runs and changes */}
      <Tabs defaultValue="changes">
        <TabsList>
          <TabsTrigger value="changes">Dernières modifications</TabsTrigger>
          <TabsTrigger value="runs">Historique des exécutions</TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Modifications récentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="added">
                      <span className="flex items-center gap-1">
                        <UserPlus className="h-3 w-3" /> Ajouts
                      </span>
                    </SelectItem>
                    <SelectItem value="removed">
                      <span className="flex items-center gap-1">
                        <UserMinus className="h-3 w-3" /> Retraits
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="validated">Validé</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="unmatched">Unmatched</SelectItem>
                    <SelectItem value="skipped">Ignoré</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Réinitialiser
                  </Button>
                )}
                <span className="ml-auto text-sm text-muted-foreground">
                  {filteredChanges.length} résultat{filteredChanges.length > 1 ? "s" : ""} sur {changes?.length || 0}
                </span>
              </div>

              {changesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredChanges.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Coureur</TableHead>
                      <TableHead>Équipe</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Détecté</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChanges.map((change: TrackerChange) => (
                      <TableRow key={change.id}>
                        <TableCell>{getChangeTypeBadge(change.change_type)}</TableCell>
                        <TableCell className="font-medium">{change.rider_name}</TableCell>
                        <TableCell>{change.team_name || "-"}</TableCell>
                        <TableCell>{change.course_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true, locale: fr })}
                        </TableCell>
                        <TableCell>
                          {change.validation_status === "validated" ? (
                            <Badge variant="outline" className="text-primary">
                              <CheckCircle className="h-3 w-3 mr-1" />Validé
                            </Badge>
                          ) : change.validation_status === "unmatched" ? (
                            <Badge variant="outline" className="text-destructive">
                              <XCircle className="h-3 w-3 mr-1" />Unmatched
                            </Badge>
                          ) : change.validation_status === "skipped" ? (
                            <Badge variant="outline" className="text-muted-foreground">Ignoré</Badge>
                          ) : (
                            <Badge variant="outline" className="text-warning">En attente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {change.validation_status !== "validated" && change.validation_status !== "skipped" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedChange(change);
                                setMatchDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : changes && changes.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun résultat pour les filtres sélectionnés.
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune modification détectée. Lancez le scraping pour commencer.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historique des exécutions</CardTitle>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : runs && runs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statut</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Démarré</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead>Changements</TableHead>
                      <TableHead>Traités</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run: any) => (
                      <TableRow key={run.id}>
                        <TableCell>{getStatusBadge(run.status)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {run.source_type === "global" ? "Global" : "Course"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: fr })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {run.completed_at
                            ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                            : "-"}
                        </TableCell>
                        <TableCell>{run.changes_detected}</TableCell>
                        <TableCell>{run.changes_processed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune exécution pour le moment.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TrackerChangeMatchDialog
        change={selectedChange}
        open={matchDialogOpen}
        onOpenChange={setMatchDialogOpen}
      />
    </div>
  );
};
