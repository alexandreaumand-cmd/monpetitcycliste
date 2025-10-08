import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useState } from "react";

export const AnnouncementBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  const { data: banner } = useQuery({
    queryKey: ['announcement-banner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_banner')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as { is_active: boolean; message: string };
    },
  });

  if (!banner?.is_active || dismissed) return null;

  return (
    <div className="bg-primary text-primary-foreground py-2 px-4 text-center relative">
      <p className="text-sm font-medium">{banner.message}</p>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
        aria-label="Fermer l'annonce"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
