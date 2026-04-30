import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CommunicationRecipient {
  user_id: string;
  email: string;
  manager_name: string | null;
  is_superadmin: boolean;
  is_league_admin: boolean;
  email_confirmed: boolean;
  banned: boolean;
  league_ids: string[];
  league_names: string[];
  unsubscribed: boolean;
}

export function useCommunicationRecipients() {
  return useQuery({
    queryKey: ["communication-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-communication-recipients");
      if (error) throw error;
      return ((data?.recipients ?? []) as CommunicationRecipient[]);
    },
    staleTime: 60_000,
  });
}
