import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Trophy, Users, Calendar, BarChart3, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { DataImport } from "@/components/admin/DataImport";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: managerData } = await supabase
        .from("managers")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      setManager(managerData);
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
              Fantasy Cycling
            </h1>
            {manager && (
              <p className="text-sm text-muted-foreground">
                {manager.nom} {manager.sponsor && `• ${manager.sponsor}`}
                {isAdmin && <span className="ml-2 text-secondary font-semibold">• Admin</span>}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="encheres" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} max-w-3xl`}>
            <TabsTrigger value="encheres" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Enchères</span>
            </TabsTrigger>
            <TabsTrigger value="equipe" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Mon Équipe</span>
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Courses</span>
            </TabsTrigger>
            <TabsTrigger value="classement" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Classement</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="encheres" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Enchères en Cours</CardTitle>
                <CardDescription>
                  Participez aux enchères pour recruter vos coureurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Aucune enchère en cours pour le moment
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipe" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Mon Équipe</CardTitle>
                <CardDescription>
                  Gérez votre roster de coureurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Vous n'avez pas encore de coureurs
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Calendrier des Courses</CardTitle>
                <CardDescription>
                  Consultez les courses à venir et les résultats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Aucune course programmée pour le moment
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="classement" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Classement Général</CardTitle>
                <CardDescription>
                  Comparez vos performances avec les autres managers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Le classement sera disponible une fois les courses commencées
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <Card className="shadow-card border-secondary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-secondary" />
                    Administration
                  </CardTitle>
                  <CardDescription>
                    Gérez les enchères, importez les résultats et administrez la plateforme
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="mb-6">
                    <DataImport />
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="bg-muted/50">
                      <CardHeader>
                        <CardTitle className="text-lg">Gestion des Enchères</CardTitle>
                        <CardDescription>Ouvrir et fermer les rounds d'enchères</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full">
                          Gérer les Enchères
                        </Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-muted/50">
                      <CardHeader>
                        <CardTitle className="text-lg">Import de Résultats</CardTitle>
                        <CardDescription>Importer les résultats des courses</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" variant="secondary">
                          Importer les Résultats
                        </Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-muted/50">
                      <CardHeader>
                        <CardTitle className="text-lg">Gestion des Phases</CardTitle>
                        <CardDescription>Créer et gérer les phases de la saison</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" variant="outline">
                          Gérer les Phases
                        </Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-muted/50">
                      <CardHeader>
                        <CardTitle className="text-lg">Utilisateurs</CardTitle>
                        <CardDescription>Gérer les managers et les rôles</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full" variant="outline">
                          Gérer les Utilisateurs
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
