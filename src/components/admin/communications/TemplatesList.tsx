import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Trash2, Copy, Send, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useCommunicationTemplates, useDeleteCommunicationTemplate, useUpsertCommunicationTemplate, type CommunicationTemplate } from "@/hooks/useCommunicationTemplates";
import { RichTextEditor } from "./RichTextEditor";

interface TemplatesListProps {
  onUseTemplate?: (template: CommunicationTemplate) => void;
}

export function TemplatesList({ onUseTemplate }: TemplatesListProps) {
  const { data: templates, isLoading } = useCommunicationTemplates();
  const upsert = useUpsertCommunicationTemplate();
  const del = useDeleteCommunicationTemplate();

  const [editor, setEditor] = useState<{ open: boolean; template: CommunicationTemplate | null }>({ open: false, template: null });
  const [confirmDelete, setConfirmDelete] = useState<CommunicationTemplate | null>(null);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const openCreate = () => {
    setName("");
    setSubject("");
    setBodyHtml("<p>Bonjour {{prenom}},</p>\n<p>...</p>\n<p>L'équipe La Bordure</p>");
    setEditor({ open: true, template: null });
  };
  const openEdit = (t: CommunicationTemplate) => {
    setName(t.name);
    setSubject(t.subject);
    setBodyHtml(t.body_html);
    setEditor({ open: true, template: t });
  };
  const openDuplicate = (t: CommunicationTemplate) => {
    setName(`${t.name} (copie)`);
    setSubject(t.subject);
    setBodyHtml(t.body_html);
    setEditor({ open: true, template: null });
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) return;
    await upsert.mutateAsync({
      id: editor.template?.id,
      name: name.trim(),
      subject: subject.trim(),
      body_html: bodyHtml,
    });
    setEditor({ open: false, template: null });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Bibliothèque de templates</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Variables disponibles : <code>{"{{prenom}}"}</code>, <code>{"{{nom_manager}}"}</code>, <code>{"{{email}}"}</code>
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau template
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    Modifié {format(new Date(t.updated_at), "d MMM yyyy à HH:mm", { locale: fr })}
                  </div>
                </div>
                <div className="flex gap-1 ml-3">
                  {onUseTemplate && (
                    <Button size="sm" variant="outline" onClick={() => onUseTemplate(t)}>
                      <Send className="h-4 w-4 mr-1" />
                      Utiliser
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)} title="Éditer">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openDuplicate(t)} title="Dupliquer">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(t)} title="Supprimer">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Aucun template. Créez-en un pour commencer.
          </div>
        )}
      </CardContent>

      <Dialog open={editor.open} onOpenChange={(o) => !o && setEditor({ open: false, template: null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor.template ? "Éditer le template" : "Nouveau template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom interne</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Annonce reprise saison" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Sujet de l'email</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label>Corps</Label>
              <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor({ open: false, template: null })}>Annuler</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !name.trim() || !subject.trim() || !bodyHtml.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" sera supprimé définitivement. Les envois passés ne seront pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDelete) await del.mutateAsync(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
