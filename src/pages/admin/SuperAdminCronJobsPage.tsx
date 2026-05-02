import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, Clock, Power, PowerOff, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
  last_run_start: string | null;
  last_run_end: string | null;
  last_run_status: string | null;
  last_run_message: string | null;
  last_run_duration_ms: number | null;
  target_project_ref: string | null;
  current_project_ref: string | null;
  is_misrouted: boolean;
}

export default function SuperAdminCronJobsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const fetchJobs = useCallback(async (showToast = false) => {
    setRefreshing(true);
    const { data, error } = await supabase.rpc("get_cron_jobs_status");
    if (error) {
      toast.error(`Erreur : ${error.message}`);
    } else {
      setJobs((data as CronJob[]) ?? []);
      if (showToast) toast.success("Liste actualisée");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchJobs(), 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchJobs]);

  const renderStatus = (job: CronJob) => {
    if (!job.last_run_status) {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> Jamais exécuté
        </Badge>
      );
    }
    const s = job.last_run_status.toLowerCase();
    if (s === "succeeded") {
      return (
        <Badge className="gap-1 bg-green-600 hover:bg-green-600">
          <CheckCircle2 className="h-3 w-3" /> Succès
        </Badge>
      );
    }
    if (s === "failed") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Échec
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> {job.last_run_status}
      </Badge>
    );
  };

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => j.active).length,
    failed: jobs.filter((j) => j.last_run_status?.toLowerCase() === "failed").length,
    misrouted: jobs.filter((j) => j.is_misrouted).length,
  };
  const currentRef = jobs.find((j) => j.current_project_ref)?.current_project_ref ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Cron Jobs</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            État et dernière exécution des tâches planifiées de la base de données.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh ? <Power className="h-4 w-4 mr-1" /> : <PowerOff className="h-4 w-4 mr-1" />}
            Auto 15s
          </Button>
          <Button size="sm" variant="outline" onClick={() => fetchJobs(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Actifs</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">En échec</div>
          <div className={`text-2xl font-bold ${stats.failed > 0 ? "text-destructive" : ""}`}>
            {stats.failed}
          </div>
        </Card>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Chargement…</Card>
      ) : jobs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Aucun cron job configuré.</Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const isOpen = expanded[job.jobid];
            return (
              <Card key={job.jobid} className="overflow-hidden">
                <button
                  className="w-full p-3 sm:p-4 text-left hover:bg-muted/40 transition"
                  onClick={() => setExpanded((e) => ({ ...e, [job.jobid]: !e[job.jobid] }))}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm truncate">{job.jobname}</span>
                        {!job.active && (
                          <Badge variant="outline" className="text-xs">Désactivé</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <code className="bg-muted px-1.5 py-0.5 rounded">{job.schedule}</code>
                        {job.last_run_start && (
                          <span>
                            Dernière exécution{" "}
                            {formatDistanceToNow(new Date(job.last_run_start), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {renderStatus(job)}
                      {job.last_run_duration_ms !== null && (
                        <span className="text-xs text-muted-foreground">
                          {job.last_run_duration_ms} ms
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t p-3 sm:p-4 bg-muted/20 space-y-2 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="text-muted-foreground">Job ID</div>
                        <div className="font-mono">{job.jobid}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">État</div>
                        <div>{job.active ? "Actif" : "Désactivé"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Début dernière exécution</div>
                        <div className="font-mono">
                          {job.last_run_start
                            ? format(new Date(job.last_run_start), "dd/MM/yyyy HH:mm:ss", { locale: fr })
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Fin dernière exécution</div>
                        <div className="font-mono">
                          {job.last_run_end
                            ? format(new Date(job.last_run_end), "dd/MM/yyyy HH:mm:ss", { locale: fr })
                            : "—"}
                        </div>
                      </div>
                    </div>
                    {job.last_run_message && (
                      <div>
                        <div className="text-muted-foreground mb-1">Message</div>
                        <pre className="bg-background p-2 rounded text-xs whitespace-pre-wrap break-all max-h-32 overflow-auto">
                          {job.last_run_message}
                        </pre>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground mb-1">Commande</div>
                      <pre className="bg-background p-2 rounded text-xs whitespace-pre-wrap break-all max-h-40 overflow-auto">
                        {job.command}
                      </pre>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
