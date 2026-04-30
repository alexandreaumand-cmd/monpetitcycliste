import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useCommunicationBatches, useCommunicationBatchDetail, type CommunicationBatch, type CommunicationBatchWithStatus } from "@/hooks/useCommunicationBatches";
import { CheckCircle2, AlertCircle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export function CommunicationHistoryList() {
  const { data: batches, isLoading } = useCommunicationBatches();
  const [openBatch, setOpenBatch] = useState<CommunicationBatchWithStatus | null>(null);
  const { data: details, isLoading: detailLoading } = useCommunicationBatchDetail(openBatch?.id ?? null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleResendFailed = async (batchId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setResendingId(batchId);
    try {
      const { data, error } = await supabase.functions.invoke("resend-failed-communication", {
        body: { batch_id: batchId },
      });
      if (error) throw error;
      const requeued = (data as any)?.requeued ?? 0;
      toast({
        title: "Renvoi lancé",
        description: requeued > 0 ? `${requeued} email${requeued > 1 ? "s" : ""} remis en file d'attente.` : "Aucun email à renvoyer.",
      });
      await queryClient.invalidateQueries({ queryKey: ["communication-batches-with-status"] });
      await queryClient.invalidateQueries({ queryKey: ["communication-batch-detail", batchId] });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message ?? "Impossible de renvoyer", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const statusVariant = (s: string) => {
    if (s === "sent") return "default";
    if (s === "pending") return "secondary";
    if (s === "failed" || s === "dlq") return "destructive";
    return "outline";
  };

  const renderBatchStatus = (b: CommunicationBatchWithStatus) => {
    const { sent, pending, failed, total } = b.status_counts;
    if (total === 0) {
      return <Badge variant="outline" className="ml-2"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
    if (failed > 0 && sent === 0 && pending === 0) {
      return <Badge variant="destructive" className="ml-2"><AlertCircle className="h-3 w-3 mr-1" />Échec ({failed}/{b.recipient_count})</Badge>;
    }
    if (failed > 0) {
      return <Badge variant="destructive" className="ml-2"><AlertCircle className="h-3 w-3 mr-1" />{failed} échec{failed > 1 ? "s" : ""} / {b.recipient_count}</Badge>;
    }
    if (pending > 0) {
      return <Badge variant="secondary" className="ml-2"><Clock className="h-3 w-3 mr-1" />{pending} en attente</Badge>;
    }
    return <Badge variant="default" className="ml-2"><CheckCircle2 className="h-3 w-3 mr-1" />Envoyé ({sent}/{b.recipient_count})</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des envois</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
        ) : batches && batches.length > 0 ? (
          <div className="space-y-2">
            {batches.map((b) => (
              <button
                key={b.id}
                onClick={() => setOpenBatch(b)}
                className="w-full text-left p-3 border rounded-lg hover:bg-muted/30 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{b.subject}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(b.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                    {b.template_name_snapshot && <> · Template : {b.template_name_snapshot}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <Badge variant="secondary">{b.recipient_count} destinataire{b.recipient_count > 1 ? "s" : ""}</Badge>
                  {renderBatchStatus(b)}
                  {b.status_counts.failed > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resendingId === b.id}
                      onClick={(e) => handleResendFailed(b.id, e)}
                    >
                      {resendingId === b.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Renvoyer les échecs
                    </Button>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">Aucun envoi pour le moment.</div>
        )}
      </CardContent>

      <Dialog open={!!openBatch} onOpenChange={(o) => !o && setOpenBatch(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openBatch?.subject}</DialogTitle>
          </DialogHeader>
          {openBatch && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Envoyé {format(new Date(openBatch.created_at), "d MMM yyyy à HH:mm", { locale: fr })} ·
                {" "}{openBatch.recipient_count} destinataire{openBatch.recipient_count > 1 ? "s" : ""}
              </div>
              <div className="border rounded p-3 bg-muted/20 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: openBatch.body_html }} />
              <div>
                <h4 className="font-semibold mb-2">Statut par destinataire</h4>
                {detailLoading ? (
                  <Skeleton className="h-32" />
                ) : details && details.length > 0 ? (
                  <div className="border rounded max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">Statut</th>
                          <th className="text-left p-2">Erreur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((d) => (
                          <tr key={d.message_id ?? d.recipient_email} className="border-t">
                            <td className="p-2 font-mono text-xs">{d.recipient_email}</td>
                            <td className="p-2"><Badge variant={statusVariant(d.status) as any}>{d.status}</Badge></td>
                            <td className="p-2 text-xs text-muted-foreground">{d.error_message ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Aucun détail disponible.</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
