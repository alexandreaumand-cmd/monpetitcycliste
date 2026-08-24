import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, Loader2, Save, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DEFAULT_SCHEDULE,
  ScrapeScheduleEditor,
  describeSchedule,
  type ScrapeWindow,
} from "@/components/arena/ScrapeScheduleEditor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StagePlan = {
  id?: string;
  etape_numero: number | null;
  stage_date: string | null;
  scrape_url: string;
  scrape_schedule: ScrapeWindow[];
  is_enabled: boolean;
  last_auto_scrape_at?: string | null;
  next_auto_scrape_at?: string | null;
};

interface Props {
  courseId: string;
  courseStart?: string | null;
  courseEnd?: string | null;
  isMultiStage: boolean;
}

const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (start: string, end: string) => {
  const a = new Date(`${start}T12:00:00Z`).getTime();
  const b = new Date(`${end}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
};

export const StagePlanEditor = ({ courseId, courseStart, courseEnd, isMultiStage }: Props) => {
  const [plans, setPlans] = useState<StagePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const today = parisToday();

  const load = async () => {
    setLoading(true);
    const [{ data: rows }, { data: stageDates }] = await Promise.all([
      (supabase.from("live_stage_plans" as any) as any)
        .select("*")
        .eq("course_id", courseId)
        .order("etape_numero", { ascending: true, nullsFirst: true }),
      supabase
        .from("course_stage_config")
        .select("etape_numero, stage_date")
        .eq("course_id", courseId),
    ]);

    const dateByStage = new Map<number, string>();
    for (const s of (stageDates || []) as any[]) {
      if (s.etape_numero != null && s.stage_date) dateByStage.set(s.etape_numero, s.stage_date);
    }

    setPlans(
      ((rows || []) as any[]).map((r) => ({
        id: r.id,
        etape_numero: r.etape_numero,
        stage_date: r.stage_date ?? (r.etape_numero != null ? dateByStage.get(r.etape_numero) ?? null : null),
        scrape_url: r.scrape_url ?? "",
        scrape_schedule:
          Array.isArray(r.scrape_schedule) && r.scrape_schedule.length > 0
            ? (r.scrape_schedule as ScrapeWindow[])
            : DEFAULT_SCHEDULE,
        is_enabled: r.is_enabled ?? true,
        last_auto_scrape_at: r.last_auto_scrape_at,
        next_auto_scrape_at: r.next_auto_scrape_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const stageCount = useMemo(() => {
    if (!isMultiStage || !courseStart || !courseEnd) return 1;
    return daysBetween(courseStart, courseEnd) + 1;
  }, [isMultiStage, courseStart, courseEnd]);

  const generate = async () => {
    const existing = new Map(plans.map((p) => [p.etape_numero ?? -1, p]));
    const { data: stageDates } = await supabase
      .from("course_stage_config")
      .select("etape_numero, stage_date")
      .eq("course_id", courseId);
    const dateByStage = new Map<number, string>();
    for (const s of (stageDates || []) as any[]) {
      if (s.etape_numero != null && s.stage_date) dateByStage.set(s.etape_numero, s.stage_date);
    }

    const base: StagePlan[] = [];
    if (!isMultiStage) {
      base.push(
        existing.get(-1) ?? {
          etape_numero: null,
          stage_date: courseStart ?? null,
          scrape_url: "",
          scrape_schedule: DEFAULT_SCHEDULE,
          is_enabled: true,
        }
      );
    } else {
      for (let n = 1; n <= stageCount; n++) {
        const found = existing.get(n);
        const fallbackDate = courseStart ? addDays(courseStart, n - 1) : null;
        base.push(
          found ?? {
            etape_numero: n,
            stage_date: dateByStage.get(n) ?? fallbackDate,
            scrape_url: "",
            scrape_schedule: DEFAULT_SCHEDULE,
            is_enabled: true,
          }
        );
      }
    }
    setPlans(base);
    toast.success(`${base.length} étape(s) préparée(s) — pensez à enregistrer`);
  };

  const update = (idx: number, patch: Partial<StagePlan>) =>
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const removeRow = async (idx: number) => {
    const row = plans[idx];
    if (row.id) {
      const { error } = await (supabase.from("live_stage_plans" as any) as any).delete().eq("id", row.id);
      if (error) {
        toast.error("Erreur : " + error.message);
        return;
      }
    }
    setPlans((prev) => prev.filter((_, i) => i !== idx));
  };

  const applyScheduleToAll = (idx: number) => {
    const schedule = plans[idx].scrape_schedule;
    setPlans((prev) => prev.map((p) => ({ ...p, scrape_schedule: schedule })));
    toast.success(`Plages appliquées à toutes les étapes (${describeSchedule(schedule)})`);
  };

  const applyBulkUrls = () => {
    const urls = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setPlans((prev) => prev.map((p, i) => (i < urls.length ? { ...p, scrape_url: urls[i] } : p)));
    toast.success(`${Math.min(urls.length, plans.length)} lien(s) affecté(s) — pensez à enregistrer`);
    setBulkText("");
    setBulkOpen(false);
  };

  const save = async () => {
    setSaving(true);
    const payload = plans.map((p) => ({
      ...(p.id ? { id: p.id } : {}),
      course_id: courseId,
      etape_numero: p.etape_numero,
      stage_date: p.stage_date || null,
      scrape_url: p.scrape_url || null,
      scrape_schedule: p.scrape_schedule,
      is_enabled: p.is_enabled,
    }));
    const { error } = await (supabase.from("live_stage_plans" as any) as any).upsert(payload, {
      onConflict: "id",
      defaultToNull: false,
    });
    setSaving(false);
    if (error) {
      toast.error("Erreur d'enregistrement : " + error.message);
      return;
    }
    toast.success("Planning enregistré");
    void load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Planning des étapes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Saisissez à l'avance le lien live et les plages horaires (heure de Paris) de chaque étape. Le serveur
          sélectionne automatiquement l'étape du jour. Sans planning pour aujourd'hui, le lien global de la course est
          utilisé.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void generate()}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Générer les étapes {isMultiStage ? `(1 → ${stageCount})` : ""}
          </Button>
          <Collapsible open={bulkOpen} onOpenChange={setBulkOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Coller des liens en masse
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={5}
                placeholder={"Un lien par ligne, dans l'ordre des étapes…"}
                className="text-xs"
              />
              <Button type="button" size="sm" className="mt-2" onClick={applyBulkUrls}>
                Affecter les liens
              </Button>
            </CollapsibleContent>
          </Collapsible>
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving || plans.length === 0}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Enregistrer
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Aucun planning. Cliquez sur « Générer les étapes » pour démarrer.
          </p>
        ) : (
          <div className="space-y-2">
            {plans.map((p, idx) => {
              const isToday = !!p.stage_date && p.stage_date === today;
              return (
                <div
                  key={p.id ?? `new-${idx}`}
                  className={`rounded-lg border p-3 space-y-2 ${isToday ? "border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isToday ? "default" : "secondary"} className="text-[11px]">
                      {p.etape_numero != null ? `Étape ${p.etape_numero}` : "Course"}
                    </Badge>
                    {isToday && (
                      <Badge variant="outline" className="text-[11px] border-primary text-primary">
                        Aujourd'hui
                      </Badge>
                    )}
                    <Input
                      type="date"
                      value={p.stage_date ?? ""}
                      onChange={(e) => update(idx, { stage_date: e.target.value })}
                      className="h-7 w-[150px] text-xs"
                    />
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-xs text-muted-foreground">Actif</span>
                      <Switch
                        checked={p.is_enabled}
                        onCheckedChange={(v) => update(idx, { is_enabled: v })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void removeRow(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <Input
                    value={p.scrape_url}
                    onChange={(e) => update(idx, { scrape_url: e.target.value })}
                    placeholder="https://… lien live de l'étape"
                    className="h-8 text-xs"
                  />

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Plages horaires (heure de Paris)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px]"
                        onClick={() => applyScheduleToAll(idx)}
                      >
                        Appliquer à toutes
                      </Button>
                    </div>
                    <ScrapeScheduleEditor
                      schedule={p.scrape_schedule}
                      onChange={(s) => update(idx, { scrape_schedule: s })}
                    />
                    {p.next_auto_scrape_at && isToday && (
                      <p className="text-[11px] text-muted-foreground">
                        Prochain import prévu :{" "}
                        {new Date(p.next_auto_scrape_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
