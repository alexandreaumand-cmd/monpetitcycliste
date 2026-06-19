import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import i18n from "i18next";

/**
 * Synchronise la langue actuelle d'i18n (détectée automatiquement ou via localStorage)
 * vers la colonne managers.preferred_language en base de données.
 * Cela évite que les utilisateurs ayant un navigateur en anglais soient affichés
 * comme "FR" dans l'admin simplement parce qu'ils n'ont jamais cliqué sur le switcher.
 */
export function useLanguageSync() {
  useEffect(() => {
    const sync = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const currentLang = (i18n.language?.split("-")[0] || "fr") as "fr" | "en";
        if (!["fr", "en"].includes(currentLang)) return;

        const { data: manager } = await supabase
          .from("managers")
          .select("preferred_language")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (manager && manager.preferred_language !== currentLang) {
          await supabase
            .from("managers")
            .update({ preferred_language: currentLang })
            .eq("user_id", session.user.id);
        }
      } catch (e) {
        // Silencieux — ce n'est pas critique pour le fonctionnement de l'app
        console.warn("[useLanguageSync] failed:", e);
      }
    };

    if (i18n.isInitialized) {
      sync();
    } else {
      i18n.on("initialized", sync);
      return () => {
        i18n.off("initialized", sync);
      };
    }
  }, []);
}
