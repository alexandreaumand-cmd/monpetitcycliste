import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, TrendingUp, Calendar, Clock, ArrowRight, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
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

  // Fetch top standings
  const { data: topStandings } = useQuery({
    queryKey: ['home-top-standings'],
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
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const getDaysUntil = (date: string) => {
    const days = differenceInDays(new Date(date), new Date());
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Demain";
    return `J-${days}`;
  };

  const maxPoints = topStandings?.[0]?.total_points || 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <img 
            src={logo} 
            alt="Velo Fantasy Quest" 
            className="h-12 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(user ? '/dashboard' : '/')}
          />
          <Button 
            onClick={() => navigate(user ? '/dashboard' : '/auth')}
            className="gradient-primary text-white"
          >
            {user ? 'Accéder au Dashboard' : 'Se connecter'}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[70vh] flex items-center">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background" />
        </div>
        <div className="container relative mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
            Velo Fantasy Quest
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto animate-fade-in">
            Participe aux enchères, compose ton équipe et marque des points avec les résultats réels des courses.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in">
            <Button 
              size="lg" 
              className="gradient-primary text-white text-lg px-8"
              onClick={() => navigate(user ? '/dashboard' : '/auth')}
            >
              {user ? 'Accéder au Dashboard' : 'Se connecter'}
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8"
              onClick={() => navigate('/dashboard/courses')}
            >
              Découvrir les règles
            </Button>
          </div>

          <div className="flex flex-wrap gap-4 justify-center animate-fade-in">
            <Badge variant="secondary" className="text-base px-4 py-2">
              <Users className="w-4 h-4 mr-2" />
              10 managers
            </Badge>
            <Badge variant="secondary" className="text-base px-4 py-2">
              <Target className="w-4 h-4 mr-2" />
              Budget 2200€ / phase
            </Badge>
            <Badge variant="secondary" className="text-base px-4 py-2">
              <Trophy className="w-4 h-4 mr-2" />
              5 phases / an
            </Badge>
          </div>
        </div>
      </section>

      {/* Auction Status */}
      {auctionStatus && auctionStatus.label && (
        <section className="py-12 bg-primary/5">
          <div className="container mx-auto px-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Enchères en cours</h3>
                    <p className="text-muted-foreground">
                      Round {auctionStatus.round_number} — Échéance: {format(new Date(auctionStatus.deadline_at), "dd MMM 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate('/dashboard/auctions')} className="gradient-primary text-white">
                  Accéder aux Enchères
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Upcoming Courses */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">À venir</h2>
            <Button variant="ghost" onClick={() => navigate('/dashboard/courses')}>
              Voir toutes les courses
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingCourses?.map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/dashboard/courses')}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg">{course.nom}</h3>
                    <Badge variant="secondary">{getDaysUntil(course.date_debut)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{course.categorie}</Badge>
                    {course.type_course && (
                      <Badge variant="outline">{course.type_course}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(course.date_debut), "dd MMM", { locale: fr })}
                      {course.date_fin !== course.date_debut && 
                        ` → ${format(new Date(course.date_fin), "dd MMM", { locale: fr })}`
                      }
                    </div>
                    {course.points_total && (
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        {course.points_total} points à gagner
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Results */}
      {recentResults && recentResults.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8">Résultats récents</h2>
            
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {recentResults.map((result) => (
                  <Card key={result.course_id} className="min-w-[300px] hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <h4 className="font-bold mb-3">{result.course_nom}</h4>
                      <div className="space-y-2">
                        {Array.isArray(result.top3) && result.top3.map((performer: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2">
                              <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                                {idx + 1}
                              </Badge>
                              {performer.coureur_nom}
                            </span>
                            <span className="font-semibold">{performer.points} pts</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                        Total: {result.total_points} points
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Top Standings */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Classement général</h2>
            <Button variant="ghost" onClick={() => navigate('/dashboard/rankings')}>
              Voir tous les classements
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {topStandings?.map((standing, idx) => (
                  <div key={standing.manager_id} className="p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold mb-1">{standing.manager_nom}</div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="gradient-primary h-2 rounded-full transition-all"
                          style={{ width: `${(standing.total_points / maxPoints) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{standing.total_points}</div>
                      <div className="text-xs text-muted-foreground">points</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Comment ça marche ?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">1</div>
              <h3 className="font-bold text-lg mb-2">Enchéris</h3>
              <p className="text-muted-foreground">Enchéris sur 30 coureurs avec un budget de 2200€</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">2</div>
              <h3 className="font-bold text-lg mb-2">Constitue</h3>
              <p className="text-muted-foreground">Compose ton équipe stratégiquement</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">3</div>
              <h3 className="font-bold text-lg mb-2">Score</h3>
              <p className="text-muted-foreground">Marque des points avec les résultats réels (étapes, GC, points, montagne, jeune)</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">4</div>
              <h3 className="font-bold text-lg mb-2">Gagne</h3>
              <p className="text-muted-foreground">Remporte la phase et le classement général</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-muted-foreground text-sm">
              © 2024 Velo Fantasy Quest
            </div>
            <div className="flex gap-6 text-sm">
              <button className="hover:text-primary transition-colors">Règles</button>
              <button className="hover:text-primary transition-colors">Contact</button>
              <button className="hover:text-primary transition-colors">Mentions</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
