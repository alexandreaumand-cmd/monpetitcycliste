import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Send, Loader2, CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
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

  // Scheduling
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState<string>("09:00");

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

  // Compute combined Date from date + HH:mm
  const scheduledAt: Date | null = useMemo(() => {
    if (!scheduleEnabled || !scheduleDate) return null;
    const [hh, mm] = (scheduleTime || "00:00").split(":").map((n) => parseInt(n, 10));
    if (isNaN(hh) || isNaN(mm)) return null;
    const d = new Date(scheduleDate);
    d.setHours(hh, mm, 0, 0);
    return d;
  }, [scheduleEnabled, scheduleDate, scheduleTime]);

  const scheduledInFuture = scheduledAt ? scheduledAt.getTime() > Date.now() + 60_000 : false;
  const scheduleValid = !scheduleEnabled || scheduledInFuture;

  const canSend =
    subject.trim().length > 0 &&
    bodyHtml.trim().length > 0 &&
    selected.size > 0 &&
    scheduleValid;

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-communication-email", {
        body: {
          subject: subject.trim(),
          body_html: bodyHtml,
          template_id: templateId === "none" ? null : templateId,
          recipient_user_ids: Array.from(selected),
          scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success || typeof data?.queued !== "number") {
        throw new Error("Réponse inattendue du serveur (envoi non confirmé)");
      }
      if (scheduledAt) {
        toast.success(
          `Envoi programmé : ${data.queued} email(s) le ${format(scheduledAt, "d MMM yyyy 'à' HH:mm", { locale: fr })}` +
            (data.skipped_unsubscribed ? `, ${data.skipped_unsubscribed} désinscrit(s) ignoré(s)` : "")
        );
      } else {
        toast.success(
          `Envoi en file d'attente : ${data.queued} email(s)` +
            (data.skipped_unsubscribed ? `, ${data.skipped_unsubscribed} désinscrit(s) ignoré(s)` : "")
        );
      }
      setSelected(new Set());
      setScheduleEnabled(false);
      setScheduleDate(undefined);
      setScheduleTime("09:00");
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

      <Card>
        <CardHeader>
          <CardTitle>4. Programmation (optionnel)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="schedule-toggle"
              checked={scheduleEnabled}
              onCheckedChange={(v) => {
                setScheduleEnabled(v);
                if (v && !scheduleDate) {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setScheduleDate(tomorrow);
                }
              }}
            />
            <Label htmlFor="schedule-toggle" className="cursor-pointer">
              {scheduleEnabled ? "Programmer l'envoi" : "Envoyer maintenant"}
            </Label>
          </div>

          {scheduleEnabled && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="space-y-2 flex-1">
                  <Label>Date d'envoi</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduleDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduleDate
                          ? format(scheduleDate, "PPP", { locale: fr })
                          : "Choisir une date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(d) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const max = new Date();
                          max.setDate(max.getDate() + 90);
                          return d < today || d > max;
                        }}
                        initialFocus
                        locale={fr}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 sm:w-40">
                  <Label htmlFor="schedule-time">Heure (locale)</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="schedule-time"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {scheduledAt && (
                <div
                  className={cn(
                    "text-sm rounded-md border p-3",
                    scheduledInFuture
                      ? "bg-muted/40 text-foreground"
                      : "bg-destructive/10 text-destructive border-destructive/30"
                  )}
                >
                  {scheduledInFuture ? (
                    <>
                      Envoi prévu le{" "}
                      <strong>
                        {format(scheduledAt, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </strong>{" "}
                      (heure locale).
                    </>
                  ) : (
                    <>La date programmée doit être au moins 1 minute dans le futur.</>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-3 border-t">
        <Button size="lg" disabled={!canSend || sending} onClick={() => setConfirmOpen(true)}>
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {scheduledAt && scheduledInFuture
            ? `Programmer l'envoi à ${selected.size} destinataire${selected.size > 1 ? "s" : ""}`
            : `Envoyer à ${selected.size} destinataire${selected.size > 1 ? "s" : ""}`}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {scheduledAt ? "Confirmer la programmation" : "Confirmer l'envoi"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {scheduledAt ? (
                <>
                  Cet email sera envoyé à <strong>{selected.size} destinataire{selected.size > 1 ? "s" : ""}</strong>{" "}
                  le <strong>{format(scheduledAt, "d MMMM yyyy 'à' HH:mm", { locale: fr })}</strong>.
                  Une fois programmé, il ne peut plus être annulé. Continuer ?
                </>
              ) : (
                <>
                  Vous êtes sur le point d'envoyer cet email à <strong>{selected.size} destinataire{selected.size > 1 ? "s" : ""}</strong>.
                  Cette action ne peut pas être annulée. Continuer ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {scheduledAt ? "Confirmer la programmation" : "Confirmer l'envoi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
