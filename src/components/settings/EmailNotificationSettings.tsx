import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Prefs = {
  marketing: boolean;
  auction_opened: boolean;
  auction_closed: boolean;
};

const DEFAULTS: Prefs = {
  marketing: true,
  auction_opened: true,
  auction_closed: true,
};

const ROWS: Array<{
  key: keyof Prefs;
  label: string;
  description: string;
}> = [
  {
    key: "marketing",
    label: "Annonces & nouveautés",
    description: "Emails globaux : ligues publiques, nouveautés produit.",
  },
  {
    key: "auction_opened",
    label: "Ouverture d'un round d'enchères",
    description: "Recevoir un email quand un round d'enchères est ouvert dans une de vos ligues.",
  },
  {
    key: "auction_closed",
    label: "Clôture d'un round d'enchères",
    description: "Recevoir un email quand un round d'enchères est clôturé dans une de vos ligues.",
  },
];

export function EmailNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof Prefs | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("email_preferences")
        .select("marketing, auction_opened, auction_closed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          marketing: data.marketing ?? true,
          auction_opened: data.auction_opened ?? true,
          auction_closed: data.auction_closed ?? true,
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (key: keyof Prefs, checked: boolean) => {
    setSavingKey(key);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingKey(null); return; }
    const previous = prefs[key];
    const next = { ...prefs, [key]: checked };
    setPrefs(next);
    const { error } = await supabase
      .from("email_preferences")
      .upsert({
        user_id: user.id,
        ...next,
        updated_at: new Date().toISOString(),
      });
    setSavingKey(null);
    if (error) {
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    toast.success("Préférences mises à jour");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Emails
        </CardTitle>
        <CardDescription className="hidden sm:block">
          Choisissez quels emails vous souhaitez recevoir de Labordure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`email-${row.key}`} className="text-base font-medium">
                {row.label}
              </Label>
              <p className="text-sm text-muted-foreground">{row.description}</p>
            </div>
            {loading || savingKey === row.key ? (
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            ) : (
              <Switch
                id={`email-${row.key}`}
                checked={prefs[row.key]}
                onCheckedChange={(c) => handleToggle(row.key, c)}
                disabled={savingKey !== null}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
