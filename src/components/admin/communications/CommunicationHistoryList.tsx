import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useCommunicationBatches, useCommunicationBatchDetail, type CommunicationBatch } from "@/hooks/useCommunicationBatches";

export function CommunicationHistoryList() {
  const { data: batches, isLoading } = useCommunicationBatches();
  const [openBatch, setOpenBatch] = useState<CommunicationBatch | null>(null);
  const { data: details, isLoading: detailLoading } = useCommunicationBatchDetail(openBatch?.id ?? null);

  const statusVariant = (s: string) => {
    if (s === "sent") return "default";
    if (s === "pending") return "secondary";
    if (s === "failed" || s === "dlq") return "destructive";
    return "outline";
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
                <Badge variant="secondary" className="ml-3">{b.recipient_count} destinataire{b.recipient_count > 1 ? "s" : ""}</Badge>
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
