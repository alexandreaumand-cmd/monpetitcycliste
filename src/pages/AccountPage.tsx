import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User, Lock } from "lucide-react";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SponsorJerseyEditor } from "@/components/account/SponsorJerseyEditor";

export default function AccountPage() {
  const { t } = useTranslation('account');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [manager, setManager] = useState<any>(null);
  
  // Form states
  const [nomManager, setNomManager] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setUser(session.user);

      const { data: managerData } = await supabase
        .from("managers")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (managerData) {
        setManager(managerData);
        setNomManager(managerData.nom || "");
        setAvatarUrl(managerData.avatar_url || null);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error(t('profile.updateSuccess'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!manager) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("managers")
        .update({
          nom: nomManager,
        })
        .eq("id", manager.id);

      if (error) throw error;

      toast.success(t('profile.updateSuccess'));
      loadUserData();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(t('profile.updateSuccess'));
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('security.passwordMismatch'));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t('security.passwordMismatch'));
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success(t('security.passwordChanged'));
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error(t('security.passwordChanged'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      
      {/* Section Profil */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('profile.title')}
          </CardTitle>
          <CardDescription>
            {t('profile.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Uploader */}
          <AvatarUploader
            currentAvatarUrl={avatarUrl || undefined}
            managerName={manager?.nom || ""}
            userId={user.id}
            onAvatarChange={setAvatarUrl}
          />

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">{t('profile.email')}</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Nom du manager */}
          <div className="space-y-2">
            <Label htmlFor="nom_manager">{t('profile.managerName')}</Label>
            <Input
              id="nom_manager"
              value={nomManager}
              onChange={(e) => setNomManager(e.target.value)}
              placeholder={t('profile.managerName')}
            />
          </div>

          <Button 
            onClick={handleUpdateProfile} 
            disabled={updating}
            className="w-full sm:w-auto"
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('profile.updating')}
              </>
            ) : (
              t('buttons.updateProfile')
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Section Sponsor & Maillot */}
      {manager && (
        <SponsorJerseyEditor 
          managerId={manager.id} 
          managerName={manager.nom || ""} 
        />
      )}
      
      {/* Section Sécurité */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('security.title')}
          </CardTitle>
          <CardDescription>
            {t('security.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">{t('security.newPassword')}</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('security.newPassword')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">{t('security.confirmPassword')}</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('security.confirmPassword')}
            />
          </div>

          <Button 
            onClick={handleChangePassword} 
            disabled={updating || !newPassword || !confirmPassword}
            className="w-full sm:w-auto"
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('security.changing')}
              </>
            ) : (
              t('security.changePassword')
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Section Notifications Push */}
      <NotificationSettings />
      
    </div>
  );
}
