import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User, Lock, Palette } from "lucide-react";

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [manager, setManager] = useState<any>(null);
  
  // Form states
  const [nomManager, setNomManager] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
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
        setSponsor(managerData.sponsor || "");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Erreur lors du chargement des données");
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
          sponsor: sponsor,
        })
        .eq("id", manager.id);

      if (error) throw error;

      toast.success("Profil mis à jour avec succès");
      loadUserData();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Mot de passe modifié avec succès");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Erreur lors du changement de mot de passe");
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

  const userInitials = manager?.nom ? manager.nom.substring(0, 2).toUpperCase() : "?";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Mon Compte</h1>
      
      {/* Section Profil */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profil
          </CardTitle>
          <CardDescription>
            Gérez vos informations personnelles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src="" alt={manager?.nom} />
              <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">Photo de profil</p>
              <Button variant="outline" size="sm" disabled>
                Changer la photo (bientôt disponible)
              </Button>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              L'email ne peut pas être modifié pour le moment
            </p>
          </div>

          {/* Nom du manager */}
          <div className="space-y-2">
            <Label htmlFor="nom_manager">Nom du manager</Label>
            <Input
              id="nom_manager"
              value={nomManager}
              onChange={(e) => setNomManager(e.target.value)}
              placeholder="Votre nom de manager"
            />
          </div>

          {/* Sponsor */}
          <div className="space-y-2">
            <Label htmlFor="sponsor">Sponsor</Label>
            <Input
              id="sponsor"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              placeholder="Nom de votre sponsor"
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
                Mise à jour...
              </>
            ) : (
              "Mettre à jour le profil"
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Section Sécurité */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Sécurité
          </CardTitle>
          <CardDescription>
            Modifiez votre mot de passe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">Nouveau mot de passe</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Entrez votre nouveau mot de passe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmer le mot de passe</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmez votre nouveau mot de passe"
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
                Modification...
              </>
            ) : (
              "Changer le mot de passe"
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Section Personnalisation */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Personnalisation
          </CardTitle>
          <CardDescription>
            Personnalisez l'apparence de votre équipe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Photo d'équipe</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Fonctionnalité bientôt disponible
              </p>
              <Button variant="outline" size="sm" disabled>
                Télécharger une photo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
