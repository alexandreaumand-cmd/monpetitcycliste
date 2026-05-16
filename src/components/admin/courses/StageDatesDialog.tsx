import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Coffee, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface StageDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: { id: string; nom: string; date_debut: string | null; date_fin: string | null } | null;
}

type Row = { etape_numero: number; stage_date: string };

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export const StageDatesDialog = ({ open, onOpenChange, course }: StageDatesDialogProps) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [nbStages, setNbStages] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const courseId = course?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["stage-dates", courseId],
    enabled: !!courseId && open,
    queryFn: async () => {
      const [{ data: cfg }, { data: rrEtapes }] = await Promise.all([
        supabase
          .from("course_stage_config")
          .select("etape_numero, stage_date")
          .eq("course_id", courseId!),
        supabase
          .from("race_results")
          .select("etape_numero")
          .eq("course_id", courseId!)
          .not("etape_numero", "is", null),
      ]);
      const maxFromResults = (rrEtapes || []).reduce(
        (m, r: any) => (r.etape_numero && r.etape_numero > m ? r.etape_numero : m),
        0,
      );
      const maxFromCfg = (cfg || []).reduce(
        (m, r: any) => (r.etape_numero && r.etape_numero > m ? r.etape_numero : m),
        0,
      );
      return {
        cfg: (cfg || []) as Array<{ etape_numero: number | null; stage_date: string | null }>,
        suggestedN: Math.max(maxFromResults, maxFromCfg, 0),
      };
    },
  });

  useEffect(() => {
    if (!open || !data || !course?.date_debut) return;
    const start = course.date_debut;
    const end = course.date_fin || course.date_debut;
    const span = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
    const guessed = Math.max(data.suggestedN, span);
    setNbStages(guessed);
    const cfgMap = new Map<number, string>();
    (data.cfg || []).forEach((c) => {
      if (c.etape_numero && c.stage_date) cfgMap.set(c.etape_numero, c.stage_date);
    });
    const next: Row[] = [];
    for (let i = 1; i <= guessed; i++) {
      next.push({ etape_numero: i, stage_date: cfgMap.get(i) || addDays(start, i - 1) });
    }
    setRows(next);
  }, [open, data, course?.date_debut, course?.date_fin]);

  const updateDate = (etape: number, value: string) => {
    setRows((prev) => prev.map((r) => (r.etape_numero === etape ? { ...r, stage_date: value } : r)));
  };

  const shiftFrom = (etape: number, delta: number) => {
    setRows((prev) =>
      prev.map((r) => (r.etape_numero >= etape ? { ...r, stage_date: addDays(r.stage_date, delta) } : r)),
    );
  };

  const resetLinear = () => {
    if (!course?.date_debut) return;
    setRows((prev) => prev.map((r) => ({ ...r, stage_date: addDays(course.date_debut!, r.etape_numero - 1) })));
  };

  const changeNbStages = (n: number) => {
    if (!course?.date_debut || n < 1) return;
    setNbStages(n);
    setRows((prev) => {
      const next = [...prev];
      if (n > next.length) {
        for (let i = next.length + 1; i <= n; i++) {
          next.push({ etape_numero: i, stage_date: addDays(course.date_debut!, i - 1) });
        }
      } else {
        next.length = n;
      }
      return next;
    });
  };

  const save = async () => {
    if (!courseId) return;
    setSaving(true);
    try {
      // Upsert each row (composite key not declared, so we delete-then-insert by etape)
      for (const r of rows) {
        const { data: existing } = await supabase
          .from("course_stage_config")
          .select("id")
          .eq("course_id", courseId)
          .eq("etape_numero", r.etape_numero)
          .maybeSingle();
        if (existing?.id) {
          await supabase
            .from("course_stage_config")
            .update({ stage_date: r.stage_date, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("course_stage_config")
            .insert({ course_id: courseId, etape_numero: r.etape_numero, stage_date: r.stage_date });
        }
      }
      toast.success("Dates des étapes enregistrées");
      queryClient.invalidateQueries({ queryKey: ["stage-dates", courseId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dates des étapes — {course?.nom}</DialogTitle>
          <DialogDescription>
            Définis la date réelle de chaque étape. Utilise « Jour de repos » pour décaler toutes les étapes suivantes d'un jour.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="nb-stages">Nombre d'étapes</Label>
                <Input
                  id="nb-stages"
                  type="number"
                  min={1}
                  max={30}
                  value={nbStages}
                  onChange={(e) => changeNbStages(Number(e.target.value))}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={resetLinear}>
                <RotateCcw className="h-4 w-4 mr-1" /> Réinitialiser
              </Button>
            </div>

            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.etape_numero} className="flex items-center gap-2">
                  <span className="w-16 text-sm font-medium">Étape {r.etape_numero}</span>
                  <Input
                    type="date"
                    value={r.stage_date}
                    onChange={(e) => updateDate(r.etape_numero, e.target.value)}
                    className="flex-1"
                  />
                  {r.etape_numero < rows.length && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Insérer un jour de repos après cette étape"
                      onClick={() => shiftFrom(r.etape_numero + 1, 1)}
                    >
                      <Coffee className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={save} disabled={saving || rows.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
