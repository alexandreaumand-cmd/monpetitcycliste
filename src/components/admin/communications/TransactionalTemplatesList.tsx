import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Pencil, Eye, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { EDITABLE_TRANSACTIONAL_TEMPLATES, type EditableTemplate } from "@/lib/transactionalTemplates";
import {
  useTransactionalEmailOverrides,
  useUpsertTransactionalEmailOverride,
  useResetTransactionalEmailOverride,
  previewTransactionalTemplate,
} from "@/hooks/useTransactionalEmailOverrides";
import { RichTextEditor } from "./RichTextEditor";
import { toast } from "sonner";

export function TransactionalTemplatesList() {
  const { data: overrides, isLoading } = useTransactionalEmailOverrides();
  const upsert = useUpsertTransactionalEmailOverride();
  const reset = useResetTransactionalEmailOverride();

  const [editing, setEditing] = useState<EditableTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [introHtml, setIntroHtml] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const openEdit = (t: EditableTemplate) => {
    const ov = overrides?.[t.key];
    setSubject(ov?.subject ?? t.defaults.subject);
    setIntroHtml(ov?.intro_html ?? t.defaults.intro_html);
    setCtaLabel(ov?.cta_label ?? t.defaults.cta_label);
    setPreviewHtml(null);
    setEditing(t);
  };

  const handleSave = async () => {
    if (!editing) return;
    await upsert.mutateAsync({
      template_key: editing.key,
      subject: subject.trim() || null,
      intro_html: introHtml.trim() || null,
      cta_label: ctaLabel.trim() || null,
    });
    setEditing(null);
  };

  const handleReset = async () => {
    if (!editing) return;
    await reset.mutateAsync(editing.key);
    setEditing(null);
  };

  const handlePreview = async () => {
    if (!editing) return;
    setPreviewLoading(true);
    try {
      const res = await previewTransactionalTemplate({
        templateKey: editing.key,
        override: {
          subject: subject.trim() || null,
          intro_html: introHtml.trim() || null,
          cta_label: ctaLabel.trim() || null,
        },
      });
      setPreviewHtml(res.html);
      setPreviewSubject(res.subject);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de prévisualisation");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates automatiques</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Mails transactionnels envoyés automatiquement par l'application. Vous pouvez personnaliser
          le sujet, le texte d'introduction et le libellé du bouton. Le reste du design (header, footer,
          encart d'infos, lien) suit la charte de l'app.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {EDITABLE_TRANSACTIONAL_TEMPLATES.map((t) => {
              const ov = overrides?.[t.key];
              const customized = !!ov;
              return (
                <div key={t.key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.displayName}</span>
                      {customized ? (
                        <Badge variant="default" className="text-[10px]">Personnalisé</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Par défaut</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{t.description}</div>
                    {ov && (
                      <div className="text-xs text-muted-foreground">
                        Modifié {format(new Date(ov.updated_at), "d MMM yyyy à HH:mm", { locale: fr })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Éditer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.displayName}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                <div className="font-medium text-foreground">Variables disponibles</div>
                <div className="flex flex-wrap gap-1.5">
                  {editing.variables.map((v) => (
                    <code key={v.key} className="px-1.5 py-0.5 rounded bg-background border text-[11px]">
                      {`{{${v.key}}}`} <span className="text-muted-foreground">— {v.label}</span>
                    </code>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sujet de l'email</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
              </div>

              <div className="space-y-2">
                <Label>Texte d'introduction (HTML)</Label>
                <RichTextEditor value={introHtml} onChange={setIntroHtml} />
              </div>

              <div className="space-y-2">
                <Label>Libellé du bouton</Label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={60} />
              </div>

              {previewHtml && (
                <div className="space-y-2">
                  <Label>Aperçu — Sujet : <span className="text-muted-foreground">{previewSubject}</span></Label>
                  <iframe
                    title="Aperçu"
                    srcDoc={previewHtml}
                    className="w-full h-[500px] border rounded-md bg-white"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={reset.isPending || !overrides?.[editing?.key ?? ""]}
              className="mr-auto"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
              <Eye className="h-4 w-4 mr-1" />
              {previewLoading ? "Aperçu…" : "Prévisualiser"}
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
