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
import { useIsMobile } from "@/hooks/use-mobile";

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

const CHANGES_LIMIT = 500;

export const StartlistTracker = () => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [raceUrl, setRaceUrl] = useState("");
  const [selectedChange, setSelectedChange] = useState<TrackerChange | null>(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riderFilter, setRiderFilter] = useState("");

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
        .limit(CHANGES_LIMIT);
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
      const { races_analyzed = 0, races_matched = 0, changes_detected = 0, changes_processed = 0 } = data;
      
      if (races_analyzed === 0) {
        toast.info("Aucune course avec modifications dans les 12 dernières heures.");
      } else if (races_matched === 0) {
        toast.warning(`${races_analyzed} courses analysées, mais aucune ne correspond à la base de données.`);
      } else if (changes_detected === 0) {
        toast.success(`${races_matched}/${races_analyzed} courses analysées. Startlists déjà à jour.`);
      } else {
        toast.success(`${races_matched} courses analysées: ${changes_detected} changements détectés, ${changes_processed} traités.`);
      }
      
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
      const riderMatch = !riderFilter || 
        change.rider_name.toLowerCase().includes(riderFilter.toLowerCase());
      return typeMatch && statusMatch && riderMatch;
    });
  }, [changes, typeFilter, statusFilter, riderFilter]);

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "all" || riderFilter !== "";

  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setRiderFilter("");
  };

  const getValidationBadge = (status: string) => {
    switch (status) {
      case "validated":
        return <Badge variant="outline" className="text-primary"><CheckCircle className="h-3 w-3 mr-1" />Validé</Badge>;
      case "unmatched":
        return <Badge variant="outline" className="text-destructive"><XCircle className="h-3 w-3 mr-1" />Unmatched</Badge>;
      case "skipped":
        return <Badge variant="outline" className="text-muted-foreground">Ignoré</Badge>;
      default:
        return <Badge variant="outline" className="text-warning">En attente</Badge>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold">Startlist Tracker</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Suivi auto des changements via PCS
          </p>
        </div>
        <Button
          onClick={() => globalScrapeMutation.mutate()}
          disabled={globalScrapeMutation.isPending}
          size={isMobile ? "sm" : "default"}
          className="self-start sm:self-auto"
        >
          {globalScrapeMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {isMobile ? "Scraping global" : "Lancer le scraping global"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {[
          { icon: Clock, value: stats.totalRuns, label: "Exécutions", color: "text-muted-foreground" },
          { icon: AlertCircle, value: stats.totalChanges, label: "Changements", color: "text-primary" },
          { icon: UserPlus, value: stats.addedCount, label: "Ajouts", color: "text-primary" },
          { icon: UserMinus, value: stats.removedCount, label: "Retraits", color: "text-destructive" },
        ].map(({ icon: Icon, value, label, color }) => (
          <Card key={label}>
            <CardContent className="p-3 sm:pt-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Icon className={`h-5 w-5 sm:h-8 sm:w-8 ${color}`} />
                <div>
                  <p className="text-lg sm:text-2xl font-bold">{value}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Race-specific scraping */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-lg">Scraper une course</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            URL PCS d'une course pour importer sa startlist
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="flex gap-2">
            <Input
              placeholder="https://www.procyclingstats.com/race/..."
              value={raceUrl}
              onChange={(e) => setRaceUrl(e.target.value)}
              className="flex-1 text-sm"
            />
            <Button
              onClick={() => raceScrapeMutation.mutate(raceUrl)}
              disabled={!raceUrl || raceScrapeMutation.isPending}
              size={isMobile ? "sm" : "default"}
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

      <Tabs defaultValue="changes">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="changes" className="text-xs sm:text-sm">Modifications</TabsTrigger>
          <TabsTrigger value="runs" className="text-xs sm:text-sm">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="mt-4">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-lg">Modifications récentes</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                    <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous types</SelectItem>
                      <SelectItem value="added">Ajouts</SelectItem>
                      <SelectItem value="removed">Retraits</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="validated">Validé</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="unmatched">Unmatched</SelectItem>
                      <SelectItem value="skipped">Ignoré</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Rechercher..."
                  value={riderFilter}
                  onChange={(e) => setRiderFilter(e.target.value)}
                  className="w-full sm:w-[180px] h-8 text-xs"
                />
                <div className="flex items-center justify-between sm:justify-start gap-2 sm:ml-auto">
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 h-7 text-xs">
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {filteredChanges.length}/{changes?.length || 0}
                  </span>
                </div>
              </div>

              {changesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredChanges.length > 0 ? (
                isMobile ? (
                  /* Mobile: card list */
                  <div className="space-y-2">
                    {filteredChanges.map((change: TrackerChange) => (
                      <div key={change.id} className="border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate flex-1">{change.rider_name}</span>
                          {getChangeTypeBadge(change.change_type)}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate">{change.course_name}</span>
                          {getValidationBadge(change.validation_status)}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {change.team_name || "-"} · {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true, locale: fr })}
                          </span>
                          {change.validation_status !== "validated" && change.validation_status !== "skipped" && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedChange(change); setMatchDialogOpen(true); }}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Desktop: table */
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
                          <TableCell>{getValidationBadge(change.validation_status)}</TableCell>
                          <TableCell>
                            {change.validation_status !== "validated" && change.validation_status !== "skipped" && (
                              <Button variant="ghost" size="icon" onClick={() => { setSelectedChange(change); setMatchDialogOpen(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : changes && changes.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucun résultat pour les filtres sélectionnés.
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucune modification détectée. Lancez le scraping.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-lg">Historique des exécutions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {runsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : runs && runs.length > 0 ? (
                isMobile ? (
                  /* Mobile: card list */
                  <div className="space-y-2">
                    {runs.map((run: any) => (
                      <div key={run.id} className="border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          {getStatusBadge(run.status)}
                          <Badge variant="secondary" className="text-xs">
                            {run.source_type === "global" ? "Global" : "Course"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: fr })}</span>
                          <span>
                            {run.completed_at
                              ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                              : "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span>{run.changes_detected} détectés</span>
                          <span>{run.changes_processed} traités</span>
                        </div>
                        {run.courses_processed && run.courses_processed.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {run.courses_processed.map((name: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Desktop: table */
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Statut</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Courses</TableHead>
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
                          <TableCell className="max-w-[250px]">
                            {run.courses_processed && run.courses_processed.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {run.courses_processed.map((name: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
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
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
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
