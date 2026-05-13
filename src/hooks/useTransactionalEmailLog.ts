import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TransactionalLogEntry {
  id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  message_id: string | null;
  metadata: any;
}

export interface TransactionalTemplateGroup {
  template_name: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  last_sent_at: string | null;
  entries: TransactionalLogEntry[];
}

// Friendly labels for known templates
const TEMPLATE_LABELS: Record<string, string> = {
  "public-league-created": "Ligue publique créée",
  "auction-round-opened": "Ouverture d'un round d'enchères",
  "auction-round-closed": "Clôture d'un round d'enchères",
  communication_general: "Campagne manuelle",
};

export function templateLabel(name: string): string {
  return TEMPLATE_LABELS[name] ?? name;
}

export function useTransactionalEmailLog() {
  return useQuery({
    queryKey: ["transactional-email-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, template_name, recipient_email, status, error_message, created_at, message_id, metadata")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;

      const rows = ((data ?? []) as any[]).filter((r) => {
        // Exclude rows tied to a manual batch (already shown in batches tab)
        const batchId = r.metadata?.batch_id;
        return !batchId;
      }) as TransactionalLogEntry[];

      const groups = new Map<string, TransactionalTemplateGroup>();
      for (const r of rows) {
        const key = r.template_name || "(inconnu)";
        let g = groups.get(key);
        if (!g) {
          g = {
            template_name: key,
            total: 0,
            sent: 0,
            failed: 0,
            pending: 0,
            last_sent_at: null,
            entries: [],
          };
          groups.set(key, g);
        }
        g.total++;
        const s = String(r.status ?? "").toLowerCase();
        if (s === "sent" || s === "delivered") g.sent++;
        else if (s === "failed" || s === "dlq" || s === "error" || s === "bounced") g.failed++;
        else g.pending++;
        if (!g.last_sent_at || new Date(r.created_at) > new Date(g.last_sent_at)) {
          g.last_sent_at = r.created_at;
        }
        g.entries.push(r);
      }

      return Array.from(groups.values()).sort((a, b) => {
        const ta = a.last_sent_at ? new Date(a.last_sent_at).getTime() : 0;
        const tb = b.last_sent_at ? new Date(b.last_sent_at).getTime() : 0;
        return tb - ta;
      });
    },
  });
}
