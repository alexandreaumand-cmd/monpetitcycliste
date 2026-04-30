import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommunicationBatch {
  id: string;
  template_id: string | null;
  template_name_snapshot: string | null;
  subject: string;
  body_html: string;
  recipient_count: number;
  sent_by: string;
  created_at: string;
}

export interface BatchStatusCounts {
  sent: number;
  pending: number;
  failed: number;
  total: number;
}

export interface CommunicationBatchWithStatus extends CommunicationBatch {
  status_counts: BatchStatusCounts;
}

export function useCommunicationBatches() {
  return useQuery({
    queryKey: ["communication-batches-with-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const batches = (data ?? []) as unknown as CommunicationBatch[];

      // Fetch recent send logs to compute per-batch status counts
      const { data: logs, error: logsError } = await supabase
        .from("email_send_log")
        .select("status, metadata")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (logsError) throw logsError;

      const counts = new Map<string, BatchStatusCounts>();
      for (const row of (logs ?? []) as any[]) {
        const batchId = row.metadata?.batch_id as string | undefined;
        if (!batchId) continue;
        const c = counts.get(batchId) ?? { sent: 0, pending: 0, failed: 0, total: 0 };
        const s = String(row.status ?? "").toLowerCase();
        if (s === "sent" || s === "delivered") c.sent++;
        else if (s === "failed" || s === "dlq" || s === "error" || s === "bounced") c.failed++;
        else c.pending++;
        c.total++;
        counts.set(batchId, c);
      }

      return batches.map((b) => ({
        ...b,
        status_counts: counts.get(b.id) ?? { sent: 0, pending: 0, failed: 0, total: 0 },
      })) as CommunicationBatchWithStatus[];
    },
  });
}

export interface BatchRecipientLog {
  message_id: string | null;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useCommunicationBatchDetail(batchId: string | null) {
  return useQuery({
    queryKey: ["communication-batch-detail", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("message_id, recipient_email, status, error_message, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as any[])
        .filter((r) => r.metadata && r.metadata.batch_id === batchId)
        .map((r) => ({
          message_id: r.message_id,
          recipient_email: r.recipient_email,
          status: r.status,
          error_message: r.error_message,
          created_at: r.created_at,
        })) as BatchRecipientLog[];
    },
  });
}
