import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import logoCarreTexte from "@/assets/logo-carre-texte.png";

const CompleteProfile = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [nom, setNom] = useState("");
  const [sponsor, setSponsor] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const nextUrl = searchParams.get('next') || '/dashboard/home';

  useEffect(() => {
    // Redirect if not authenticated or already has a manager profile
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (manager) {
        navigate(nextUrl);
      }
    };
    check();
  }, [navigate, nextUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { error } = await supabase
        .from("managers")
        .insert({
          user_id: session.user.id,
          nom,
          sponsor: sponsor || null,
          email: session.user.email || "",
        });

      if (error) throw error;

      toast({
        title: t('completeProfile.success', 'Profil créé !'),
      });
      navigate(nextUrl);
    } catch (error: any) {
      toast({
        title: t('errors.generic'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoCarreTexte} alt="La Bordure Fantasy Cycling" className="h-40 w-auto object-contain" />
          </div>
          <p className="text-muted-foreground text-sm">
            {t('completeProfile.description', 'Complétez votre profil pour commencer')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manager-nom">{t('labels.managerName')}</Label>
              <Input
                id="manager-nom"
                type="text"
                placeholder={t('placeholders.managerName')}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager-sponsor">{t('labels.sponsor')}</Label>
              <Input
                id="manager-sponsor"
                type="text"
                placeholder={t('placeholders.sponsor')}
                value={sponsor}
                onChange={(e) => setSponsor(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary text-white hover:opacity-90"
              disabled={loading || !nom.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? t('buttons.registering') : t('completeProfile.submit', 'Commencer')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfile;
