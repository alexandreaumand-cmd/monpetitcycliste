import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function EmailNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("email_preferences")
        .select("marketing")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setMarketing(data.marketing);
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const previous = marketing;
    setMarketing(checked);
    const { error } = await supabase
      .from("email_preferences")
      .upsert({ user_id: user.id, marketing: checked, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      setMarketing(previous);
      toast.error("Erreur lors de la mise à jour");
      return;
    }
    toast.success(checked ? "Vous recevrez les emails" : "Vous ne recevrez plus d'emails");
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Emails
        </CardTitle>
        <CardDescription className="hidden sm:block">
          Choisissez si vous souhaitez recevoir les emails de Labordure (annonces, nouveautés, ligues publiques).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-marketing" className="text-base font-medium">
              Recevoir les emails
            </Label>
            <p className="text-sm text-muted-foreground">
              Annonces et notifications globales par email.
            </p>
          </div>
          {loading || saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Switch
              id="email-marketing"
              checked={marketing}
              onCheckedChange={handleToggle}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
