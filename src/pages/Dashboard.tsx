import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Trophy, Users, Calendar, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>(null);

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

  if (loading) {
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
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
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
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
