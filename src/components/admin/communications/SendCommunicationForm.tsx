import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCommunicationTemplates, type CommunicationTemplate } from "@/hooks/useCommunicationTemplates";
import { RichTextEditor } from "./RichTextEditor";
import { RecipientsPicker } from "./RecipientsPicker";
import { useQueryClient } from "@tanstack/react-query";

interface SendCommunicationFormProps {
  initialTemplate: CommunicationTemplate | null;
  onSent?: () => void;
}

export function SendCommunicationForm({ initialTemplate, onSent }: SendCommunicationFormProps) {
  const { data: templates } = useCommunicationTemplates();
  const qc = useQueryClient();

  const [templateId, setTemplateId] = useState<string>(initialTemplate?.id ?? "none");
  const [subject, setSubject] = useState(initialTemplate?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(initialTemplate?.body_html ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      setTemplateId(initialTemplate.id);
      setSubject(initialTemplate.subject);
      setBodyHtml(initialTemplate.body_html);
    }
  }, [initialTemplate]);

  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    if (value === "none") {
      setSubject("");
      setBodyHtml("");
      return;
    }
    const t = templates?.find((tt) => tt.id === value);
    if (t) {
      setSubject(t.subject);
      setBodyHtml(t.body_html);
    }
  };

  const previewHtml = bodyHtml
    .replace(/\{\{\s*prenom\s*\}\}/gi, "Marie")
    .replace(/\{\{\s*nom_manager\s*\}\}/gi, "Marie Dupont")
    .replace(/\{\{\s*email\s*\}\}/gi, "marie@example.com");

  const canSend = subject.trim().length > 0 && bodyHtml.trim().length > 0 && selected.size > 0;

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-communication-email", {
        body: {
          subject: subject.trim(),
          body_html: bodyHtml,
          template_id: templateId === "none" ? null : templateId,
          recipient_user_ids: Array.from(selected),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success || typeof data?.queued !== "number") {
        throw new Error("Réponse inattendue du serveur (envoi non confirmé)");
      }
      toast.success(`Envoi en file d'attente : ${data.queued} email(s)${data.skipped_unsubscribed ? `, ${data.skipped_unsubscribed} désinscrit(s) ignoré(s)` : ""}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["communication-batches"] });
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'envoi");
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>1. Choix du template</CardTitle></CardHeader>
        <CardContent>
          <Select value={templateId} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-full md:w-[400px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sans template (vide)</SelectItem>
              {templates?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Composition</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sujet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label>Corps</Label>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Édition</TabsTrigger>
                <TabsTrigger value="preview">Aperçu</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md p-4 bg-muted/30 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <p className="text-xs text-muted-foreground mt-2">Aperçu avec : prenom=Marie, nom_manager=Marie Dupont, email=marie@example.com</p>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <RecipientsPicker selected={selected} onChange={setSelected} />

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-3 border-t">
        <Button size="lg" disabled={!canSend || sending} onClick={() => setConfirmOpen(true)}>
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Envoyer à {selected.size} destinataire{selected.size > 1 ? "s" : ""}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'envoi</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point d'envoyer cet email à <strong>{selected.size} destinataire{selected.size > 1 ? "s" : ""}</strong>.
              Cette action ne peut pas être annulée. Continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer l'envoi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
