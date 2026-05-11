import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, AlertTriangle, RefreshCw, Database, Package, FileCode, Image as ImageIcon, ListChecks } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type Snapshot = {
  generatedAt: string;
  thresholds: { edgeFunctions: number; assetsMB: number; migrations: number; distMB: number; singleAssetKB: number };
  edgeFunctions: number;
  migrations: number;
  assets: { count: number; totalMB: number; top: { path: string; kb: number }[] };
  distMB: number | null;
};

type CloudHealth = {
  dbReachable: boolean;
  pingMs: number | null;
  error: string | null;
};

const CHECKLIST_KEY = "publish-health-checklist-v1";
const checklistItems = [
  "Aucune erreur dans la console (F12) sur les pages clés",
  "Build local OK (`bun run build` sans erreur)",
  "Pas de migrations en attente non testées",
  "Secrets edge functions configurés",
  "Assets > 500 KB justifiés ou compressés",
  "Backup DB récent disponible",
];

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />{label}</Badge>
  ) : (
    <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{label}</Badge>
  );
}

function MetricRow({ icon: Icon, label, value, threshold, unit = "" }: { icon: any; label: string; value: number; threshold: number; unit?: string }) {
  const ok = value <= threshold;
  const pct = Math.min(100, (value / threshold) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" />{label}</span>
        <span className={ok ? "font-medium" : "font-semibold text-destructive"}>
          {value}{unit} <span className="text-muted-foreground text-xs">/ {threshold}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={ok ? "h-full bg-primary" : "h-full bg-destructive"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SuperAdminPublishHealthPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [cloud, setCloud] = useState<CloudHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Record<number, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}"); } catch { return {}; }
  });

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/publish-health.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnapshot(await res.json());
      setSnapshotError(null);
    } catch (e: any) {
      setSnapshotError(e.message);
    }
  }, []);

  const pingCloud = useCallback(async () => {
    const t0 = performance.now();
    const { error } = await supabase.from("coureurs").select("id", { head: true, count: "exact" }).limit(1);
    const ms = Math.round(performance.now() - t0);
    setCloud({ dbReachable: !error, pingMs: ms, error: error?.message ?? null });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSnapshot(), pingCloud()]);
    setLoading(false);
  }, [fetchSnapshot, pingCloud]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleCheck = (i: number) => {
    const next = { ...checks, [i]: !checks[i] };
    setChecks(next);
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
  };
  const resetChecks = () => {
    setChecks({});
    localStorage.removeItem(CHECKLIST_KEY);
  };

  const checkedCount = Object.values(checks).filter(Boolean).length;
  const allChecked = checkedCount === checklistItems.length;

  const sizeOk = snapshot
    ? snapshot.edgeFunctions <= snapshot.thresholds.edgeFunctions &&
      snapshot.migrations <= snapshot.thresholds.migrations &&
      snapshot.assets.totalMB <= snapshot.thresholds.assetsMB
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">État du publish</h1>
          <p className="text-sm text-muted-foreground">Diagnostic pré-publication — sandbox & infra Cloud</p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      <Card className="p-6 bg-muted/30 border-dashed">
        <p className="text-xs text-muted-foreground">
          ℹ️ Lovable n'expose pas l'API interne du sandbox de publication. Cet écran agrège ce qui est mesurable
          côté repo (volumes) et côté Cloud (DB). Il ne montre <strong>pas</strong> les étapes en temps réel
          d'un publish en cours — Lovable n'expose que le résultat final dans le modal.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Volumes */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Volumes du repo
            </h2>
            {snapshot && <StatusBadge ok={sizeOk} label={sizeOk ? "OK" : "Risque"} />}
          </div>

          {snapshotError && (
            <div className="text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>
                <p>Snapshot introuvable.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Régénère via <code className="bg-muted px-1 rounded">bun run report</code> ou redémarre le dev server.
                </p>
              </div>
            </div>
          )}

          {snapshot && (
            <>
              <div className="space-y-3">
                <MetricRow icon={FileCode} label="Edge functions" value={snapshot.edgeFunctions} threshold={snapshot.thresholds.edgeFunctions} />
                <MetricRow icon={Database} label="Migrations" value={snapshot.migrations} threshold={snapshot.thresholds.migrations} />
                <MetricRow icon={ImageIcon} label="Assets bruts" value={snapshot.assets.totalMB} threshold={snapshot.thresholds.assetsMB} unit=" MB" />
                {snapshot.distMB != null && (
                  <MetricRow icon={Package} label="Dist build" value={snapshot.distMB} threshold={snapshot.thresholds.distMB} unit=" MB" />
                )}
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Top 5 assets</p>
                <ul className="space-y-1 text-xs font-mono">
                  {snapshot.assets.top.slice(0, 5).map((a) => (
                    <li key={a.path} className="flex justify-between gap-2">
                      <span className="truncate text-muted-foreground">{a.path}</span>
                      <span className={a.kb > snapshot.thresholds.singleAssetKB ? "text-destructive font-semibold" : ""}>
                        {a.kb.toFixed(0)} KB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                Snapshot {formatDistanceToNow(new Date(snapshot.generatedAt), { addSuffix: true, locale: fr })}
              </p>
            </>
          )}
        </Card>

        {/* Cloud health */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              Healthcheck Cloud
            </h2>
            {cloud && <StatusBadge ok={cloud.dbReachable} label={cloud.dbReachable ? "DB up" : "DB down"} />}
          </div>

          {cloud ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base de données</span>
                <span className="font-medium">{cloud.dbReachable ? "✓ joignable" : "✗ injoignable"}</span>
              </div>
              {cloud.pingMs != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latence</span>
                  <span className={`font-medium ${cloud.pingMs > 500 ? "text-destructive" : cloud.pingMs > 200 ? "text-yellow-600" : ""}`}>
                    {cloud.pingMs} ms
                  </span>
                </div>
              )}
              {cloud.error && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2">
                  {cloud.error}
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-3 border-t mt-3">
                Les edge functions et migrations sont déployées <strong>automatiquement</strong> par Lovable.
                Si le publish échoue, c'est généralement le build du frontend ou l'upload des assets qui sature.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Mesure en cours...</p>
          )}
        </Card>
      </div>

      {/* Checklist */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Checklist pré-publish
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{checkedCount}/{checklistItems.length}</span>
            {allChecked && <Badge className="bg-green-600 hover:bg-green-600">Prêt à publier</Badge>}
            <Button variant="ghost" size="sm" onClick={resetChecks}>Réinitialiser</Button>
          </div>
        </div>
        <div className="space-y-2">
          {checklistItems.map((item, i) => (
            <label
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 cursor-pointer transition-colors"
            >
              <Checkbox checked={!!checks[i]} onCheckedChange={() => toggleCheck(i)} className="mt-0.5" />
              <span className={`text-sm ${checks[i] ? "line-through text-muted-foreground" : ""}`}>{item}</span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
