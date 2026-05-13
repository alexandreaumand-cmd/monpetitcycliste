import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TransactionalEmailOverride {
  template_key: string;
  subject: string | null;
  intro_html: string | null;
  cta_label: string | null;
  updated_at: string;
  updated_by: string | null;
}

export function useTransactionalEmailOverrides() {
  return useQuery({
    queryKey: ["transactional-email-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactional_email_overrides" as any)
        .select("*");
      if (error) throw error;
      const map: Record<string, TransactionalEmailOverride> = {};
      for (const row of (data ?? []) as any[]) {
        map[row.template_key] = row as TransactionalEmailOverride;
      }
      return map;
    },
  });
}

export function useUpsertTransactionalEmailOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      template_key: string;
      subject: string | null;
      intro_html: string | null;
      cta_label: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("transactional_email_overrides" as any)
        .upsert(
          {
            template_key: input.template_key,
            subject: input.subject,
            intro_html: input.intro_html,
            cta_label: input.cta_label,
            updated_by: user?.id ?? null,
          },
          { onConflict: "template_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactional-email-overrides"] });
      toast.success("Template enregistré");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
}

export function useResetTransactionalEmailOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template_key: string) => {
      const { error } = await supabase
        .from("transactional_email_overrides" as any)
        .delete()
        .eq("template_key", template_key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactional-email-overrides"] });
      toast.success("Template réinitialisé");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
}

export async function previewTransactionalTemplate(input: {
  templateKey: string;
  override: { subject: string | null; intro_html: string | null; cta_label: string | null };
}): Promise<{ html: string; subject: string }> {
  const { data, error } = await supabase.functions.invoke(
    "admin-preview-transactional-template",
    { body: input }
  );
  if (error) throw error;
  return data as { html: string; subject: string };
}
