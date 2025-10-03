import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Users, TrendingUp, Award, Calendar, Megaphone, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import logo from "@/assets/logo.png";
import heroImage from "@/assets/hero-cycling.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch upcoming courses
  const { data: upcomingCourses } = useQuery({
    queryKey: ['home-upcoming-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_home_upcoming_courses')
        .select('*');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch recent results
  const { data: recentResults } = useQuery({
    queryKey: ['home-recent-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_home_recent_results')
        .select('*');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch top managers
  const { data: topManagers } = useQuery({
    queryKey: ['home-top-managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_manager_standings_total')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch auction status
  const { data: auctionStatus } = useQuery({
    queryKey: ['home-auction-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('next_auction_info')
        .select('*')
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const getDaysUntil = (date: string) => {
    const days = differenceInDays(new Date(date), new Date());
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Demain";
    return `J-${days}`;
  };

  const maxPoints = topManagers?.[0]?.total_points || 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[600px] flex items-center">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/80 to-background" />
        </div>
        
        <div className="container relative mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <img src={logo} alt="Mon Petit Cycliste" className="h-24 w-24 mx-auto mb-6 animate-fade-in" />
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground animate-fade-in">
              Mon Petit Cycliste
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 animate-fade-in">
              Participe aux enchères, compose ton équipe et marque des points avec les résultats réels des courses.
            </p>
            
            <div className="mb-8 animate-fade-in">
              <Badge className="px-6 py-3 text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl transition-shadow border-2 border-amber-300">
                <Star className="mr-2 h-5 w-5 fill-white" />
                Fini le tableau de l&apos;enfer
                <Star className="ml-2 h-5 w-5 fill-white" />
              </Badge>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 animate-fade-in">
              {user ? (
                <Button 
                  size="lg" 
                  className="gradient-primary text-white hover:opacity-90 transition-smooth shadow-elegant text-lg px-8"
                  onClick={() => navigate('/dashboard')}
                >
                  Accéder au Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  className="gradient-primary text-white hover:opacity-90 transition-smooth shadow-elegant text-lg px-8"
                  onClick={() => navigate('/auth')}
                >
                  Se connecter
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              )}
              <Button 
                size="lg" 
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10 transition-smooth text-lg px-8"
              >
                Découvrir les règles
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 justify-center animate-fade-in">
              <Badge variant="secondary" className="px-4 py-2 text-base">
                <Users className="mr-2 h-4 w-4" />
                10 managers
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-base">
                <Trophy className="mr-2 h-4 w-4" />
                Budget 2200€ / phase
              </Badge>
              <Badge variant="secondary" className="px-4 py-2 text-base">
                <Calendar className="mr-2 h-4 w-4" />
                5 phases / an
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Courses Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">À venir</h2>
            <Button variant="ghost" onClick={() => navigate('/dashboard/courses')}>
              Voir toutes les courses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingCourses?.map((course) => (
              <Card key={course.id} className="hover:shadow-elegant transition-smooth">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-lg">{course.nom}</CardTitle>
                    <Badge variant="outline">{getDaysUntil(course.date_debut)}</Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-primary/10 text-primary">{course.categorie}</Badge>
                    {course.type_course && (
                      <Badge variant="secondary">{course.type_course}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-3">
                    {format(new Date(course.date_debut), 'd MMM', { locale: fr })} 
                    {course.date_fin !== course.date_debut && 
                      ` → ${format(new Date(course.date_fin), 'd MMM', { locale: fr })}`
                    }
                  </div>
                  {course.points_total && (
                    <div className="text-sm font-medium">
                      <Award className="inline h-4 w-4 mr-1 text-primary" />
                      {course.points_total} points à gagner
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Results Section */}
      {recentResults && recentResults.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8">Résultats récents</h2>
            
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
              {recentResults.map((result) => (
                <Card key={result.course_id} className="min-w-[350px] snap-start">
                  <CardHeader>
                    <CardTitle className="text-base">{result.course_nom}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(result.date_fin), 'd MMMM yyyy', { locale: fr })}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Array.isArray(result.top3) && result.top3.map((performer: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="font-medium">
                            {idx + 1}. {performer.coureur_nom}
                          </span>
                          <Badge variant="secondary">{performer.points} pts</Badge>
                        </div>
                      ))}
                      <div className="pt-2 mt-2 border-t text-sm font-medium">
                        Total: {result.total_points} points
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Auction Status Section */}
      {auctionStatus && ['open', 'pending'].includes(auctionStatus.statut) && (
        <section className="py-12 bg-primary/5">
          <div className="container mx-auto px-4">
            <Card className="border-primary/20">
              <CardContent className="py-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <Megaphone className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="text-xl font-bold">Enchères en cours</h3>
                      <p className="text-muted-foreground">
                        Round {auctionStatus.round_number} — échéance le{' '}
                        {format(new Date(auctionStatus.deadline_at), "d MMMM 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Button 
                    className="gradient-primary text-white"
                    onClick={() => navigate('/dashboard/auctions')}
                  >
                    Accéder aux Enchères
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Standings Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Classement général</h2>
            <Button variant="ghost" onClick={() => navigate('/dashboard/rankings')}>
              Voir tous les classements
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {topManagers?.map((manager, index) => (
                  <div key={manager.manager_id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 text-2xl font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium mb-2">{manager.manager_nom}</div>
                        <div className="relative">
                          <Progress 
                            value={(manager.total_points / maxPoints) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{manager.total_points}</div>
                        <div className="text-sm text-muted-foreground">points</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Comment ça marche ?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Trophy,
                title: "Enchéris sur 30 coureurs",
                description: "Participe aux enchères pour constituer ton équipe avec un budget de 2200€"
              },
              {
                icon: Users,
                title: "Constitue ton équipe",
                description: "Sélectionne tes coureurs stratégiquement sans doublon d'équipe pro"
              },
              {
                icon: TrendingUp,
                title: "Score avec les résultats réels",
                description: "Gagne des points grâce aux performances de tes coureurs en course"
              },
              {
                icon: Award,
                title: "Gagne la phase/le général",
                description: "Domine le classement et deviens le meilleur manager de la saison"
              }
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="text-center hover:shadow-elegant transition-smooth">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Logo" className="h-8 w-8" />
              <span className="font-semibold">© 2025 Mon Petit Cycliste</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Règles</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
              <a href="#" className="hover:text-foreground transition-colors">Mentions légales</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;