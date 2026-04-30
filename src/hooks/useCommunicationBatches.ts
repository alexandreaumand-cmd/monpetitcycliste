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

export function useCommunicationBatches() {
  return useQuery({
    queryKey: ["communication-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_batches" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CommunicationBatch[];
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
        .from("email_send_log" as any)
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
