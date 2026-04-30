import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CommunicationTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useCommunicationTemplates() {
  return useQuery({
    queryKey: ["communication-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_templates")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CommunicationTemplate[];
    },
  });
}

export function useUpsertCommunicationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; subject: string; body_html: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      if (input.id) {
        const { error } = await supabase
          .from("communication_templates")
          .update({ name: input.name, subject: input.subject, body_html: input.body_html })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("communication_templates")
          .insert({
            name: input.name,
            subject: input.subject,
            body_html: input.body_html,
            created_by: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communication-templates"] });
      toast.success("Template enregistré");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
}

export function useDeleteCommunicationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("communication_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communication-templates"] });
      toast.success("Template supprimé");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
}
