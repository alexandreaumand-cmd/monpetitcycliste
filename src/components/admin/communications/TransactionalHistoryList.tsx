import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Clock, Mail } from "lucide-react";
import {
  useTransactionalEmailLog,
  templateLabel,
  type TransactionalTemplateGroup,
} from "@/hooks/useTransactionalEmailLog";

export function TransactionalHistoryList() {
  const { data: groups, isLoading } = useTransactionalEmailLog();
  const [open, setOpen] = useState<TransactionalTemplateGroup | null>(null);

  const statusVariant = (s: string) => {
    const k = (s ?? "").toLowerCase();
    if (k === "sent" || k === "delivered") return "default";
    if (k === "pending" || k === "queued") return "secondary";
    return "destructive";
  };
  const statusLabel = (s: string) => {
    const k = (s ?? "").toLowerCase();
    if (k === "sent" || k === "delivered") return "Envoyé";
    if (k === "pending" || k === "queued") return "En attente";
    if (k === "failed" || k === "error") return "Échec";
    if (k === "dlq") return "Échec (DLQ)";
    if (k === "bounced") return "Rejeté";
    return s;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mails automatiques (par template)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : groups && groups.length > 0 ? (
          <div className="space-y-2">
            {groups.map((g) => (
              <div
                key={g.template_name}
                onClick={() => setOpen(g)}
                className="w-full text-left p-3 border rounded-lg hover:bg-muted/30 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {templateLabel(g.template_name)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Code : <span className="font-mono">{g.template_name}</span>
                    {g.last_sent_at && (
                      <> · Dernier envoi le {format(new Date(g.last_sent_at), "d MMM yyyy à HH:mm", { locale: fr })}</>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <Badge variant="secondary">{g.total} envoi{g.total > 1 ? "s" : ""}</Badge>
                  {g.sent > 0 && (
                    <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />{g.sent}</Badge>
                  )}
                  {g.pending > 0 && (
                    <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{g.pending}</Badge>
                  )}
                  {g.failed > 0 && (
                    <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{g.failed}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Aucun mail automatique envoyé pour le moment.
          </div>
        )}
      </CardContent>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open && templateLabel(open.template_name)}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Code template : <span className="font-mono">{open.template_name}</span> · {open.total} envoi{open.total > 1 ? "s" : ""}
              </div>
              <div className="border rounded max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Destinataire</th>
                      <th className="text-left p-2">Statut</th>
                      <th className="text-left p-2">Erreur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.entries.map((d) => (
                      <tr key={d.id} className="border-t">
                        <td className="p-2 text-xs whitespace-nowrap">
                          {format(new Date(d.created_at), "d MMM HH:mm", { locale: fr })}
                        </td>
                        <td className="p-2 font-mono text-xs">{d.recipient_email}</td>
                        <td className="p-2">
                          <Badge variant={statusVariant(d.status) as any}>{statusLabel(d.status)}</Badge>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{d.error_message ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
