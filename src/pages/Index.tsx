import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, TrendingUp, Award, MapPin, Calendar, Shield, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Tour de France Style */}
      <section className="relative overflow-hidden min-h-[700px] flex items-center tdf-black-bg">
        <div 
          className="absolute inset-0 bg-cover bg-center grayscale opacity-40"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-black/60 to-black" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 py-20">
          <div className="max-w-4xl">
            <h1 className="font-montserrat text-6xl md:text-8xl font-extrabold text-white mb-6 leading-tight">
              Joue la saison, <br />
              <span className="tdf-yellow-text">gagne la gloire.</span>
            </h1>
            <p className="font-poppins text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              Mon Petit Cycliste, le jeu de fantasy cycling basé sur les vraies courses du calendrier UCI.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg"
                className="tdf-yellow-bg text-black hover:bg-yellow-400 font-montserrat font-bold text-lg px-8 py-6 shadow-2xl transition-all hover:scale-105"
                onClick={() => user ? navigate('/dashboard/home') : navigate('/auth')}
              >
                🟡 {user ? 'Mon Dashboard' : 'Créer ma ligue'}
              </Button>
              <Button 
                size="lg"
                className="bg-transparent text-white border-2 border-white hover:bg-white/10 font-montserrat font-bold text-lg px-8 py-6"
              >
                Découvrir le jeu
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche - 3 colonnes */}
      <section className="py-20 bg-[#F5F5F5]">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-16">
            Comment ça marche ?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {[
              {
                icon: Trophy,
                title: "Crée ta ligue ou rejoins-en une",
                description: "Invite tes amis ou d'autres managers passionnés"
              },
              {
                icon: Users,
                title: "Compose ton équipe",
                description: "Fais ton mercato lors des enchères et choisis tes coureurs"
              },
              {
                icon: TrendingUp,
                title: "Suis les vraies courses",
                description: "Tes coureurs marquent des points selon leurs performances réelles"
              }
            ].map((step, i) => (
              <Card key={i} className="text-center hover-lift border-none shadow-lg bg-white">
                <CardContent className="pt-8 pb-6">
                  <div className="w-20 h-20 rounded-full tdf-yellow-bg flex items-center justify-center mx-auto mb-6">
                    <step.icon className="w-10 h-10 text-black" />
                  </div>
                  <h3 className="font-montserrat font-bold text-xl mb-3">{step.title}</h3>
                  <p className="font-poppins text-gray-600">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Les ligues disponibles */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-montserrat text-4xl md:text-5xl font-bold mb-4">Les ligues disponibles</h2>
            <p className="font-poppins text-lg text-gray-600">
              Chaque joueur choisit sa ligue selon son envie de jeu.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              {
                type: "Ligues rapides",
                description: "Joue sur un seul Grand Tour",
                cta: "Tour de France",
                icon: "🚴",
                color: "bg-yellow-50 border-yellow-400"
              },
              {
                type: "Ligues saison",
                description: "Suis toute l'année cycliste",
                cta: "Saison complète",
                icon: "📅",
                color: "bg-blue-50 border-blue-400"
              },
              {
                type: "Ligues entre amis",
                description: "Jusqu'à 10 managers",
                cta: "Créer ma ligue",
                icon: "👥",
                color: "bg-green-50 border-green-400"
              },
              {
                type: "Ligues publiques",
                description: "Affronte toute la communauté",
                cta: "Découvrir",
                icon: "🌍",
                color: "bg-purple-50 border-purple-400"
              }
            ].map((league, i) => (
              <Card key={i} className={`hover-lift border-2 ${league.color}`}>
                <CardHeader>
                  <div className="text-5xl mb-3">{league.icon}</div>
                  <CardTitle className="font-montserrat text-xl">{league.type}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-poppins text-gray-600 mb-4">{league.description}</p>
                  <Button 
                    className="w-full tdf-black-bg text-white hover:bg-gray-800 font-montserrat"
                    onClick={() => navigate('/auth')}
                  >
                    {league.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Le système de points */}
      <section className="py-20 bg-[#F5F5F5]">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-4">Le système de points</h2>
          <p className="font-poppins text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Chaque jour de course, tes coureurs gagnent des points selon leurs résultats officiels :
          </p>
          
          <Card className="max-w-3xl mx-auto shadow-2xl border-2 border-yellow-400">
            <CardContent className="p-8">
              <div className="space-y-4">
                {[
                  { action: "Victoire d'étape", points: "+100 pts", icon: "🏆" },
                  { action: "Maillot à pois", points: "+50 pts", icon: "🔴" },
                  { action: "Maillot jaune", points: "Bonus cumulatif", icon: "🟡" }
                ].map((rule, i) => (
                  <div key={i} className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{rule.icon}</span>
                      <span className="font-poppins text-lg">{rule.action}</span>
                    </div>
                    <Badge className="tdf-yellow-bg text-black font-montserrat font-bold text-base px-4 py-2">
                      {rule.points}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Graphique podium */}
          <div className="mt-12 flex justify-center gap-4">
            <div className="text-center">
              <div className="w-20 h-32 bg-gray-300 rounded-t-lg flex items-end justify-center pb-2">
                <span className="font-montserrat font-bold text-2xl">2</span>
              </div>
              <p className="font-poppins text-sm mt-2">Argent</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-40 tdf-yellow-bg rounded-t-lg flex items-end justify-center pb-2">
                <span className="font-montserrat font-bold text-2xl">1</span>
              </div>
              <p className="font-poppins text-sm mt-2">Or</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-24 bg-orange-400 rounded-t-lg flex items-end justify-center pb-2">
                <span className="font-montserrat font-bold text-2xl">3</span>
              </div>
              <p className="font-poppins text-sm mt-2">Bronze</p>
            </div>
          </div>
        </div>
      </section>

      {/* Témoignages / Communauté */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-12">
            Ce qu'ils en pensent
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                quote: "Une ambiance incroyable dans notre ligue entre potes !",
                author: "Max",
                location: "Lyon",
                avatar: "👨"
              },
              {
                quote: "On suit les étapes du Tour tous les soirs, c'est génial !",
                author: "Julie",
                location: "Nantes",
                avatar: "👩"
              }
            ].map((testimonial, i) => (
              <Card key={i} className="border-2 border-yellow-400 shadow-lg hover-lift">
                <CardContent className="pt-6">
                  <p className="font-poppins text-lg italic mb-4">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{testimonial.avatar}</div>
                    <div>
                      <p className="font-montserrat font-bold">{testimonial.author}</p>
                      <p className="text-sm text-gray-500">{testimonial.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi jouer à MPC */}
      <section className="py-20 tdf-black-bg text-white">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-16 tdf-yellow-text">
            Pourquoi jouer à Mon Petit Cycliste
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[
              { icon: "🔥", text: "Basé sur les vraies courses" },
              { icon: "🧠", text: "Stratégie et enchères" },
              { icon: "👥", text: "Joue avec tes amis" },
              { icon: "🏅", text: "Classements et trophées" }
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="text-6xl mb-4">{feature.icon}</div>
                <p className="font-poppins text-lg">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-r from-yellow-400 to-yellow-500">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-montserrat text-4xl md:text-5xl font-extrabold text-black mb-6">
            Rejoins la communauté de managers cyclistes
          </h2>
          <p className="font-poppins text-xl text-gray-900 mb-8">
            Lance ta première ligue aujourd'hui.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="tdf-black-bg text-white hover:bg-gray-900 font-montserrat font-bold text-lg px-10 py-6"
              onClick={() => navigate('/auth')}
            >
              🟡 Créer ma ligue
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-black text-black hover:bg-black/10 font-montserrat font-bold text-lg px-10 py-6 bg-transparent"
              onClick={() => navigate('/auth')}
            >
              ⚫ Essayer en solo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer Tour de France Style */}
      <footer className="tdf-black-bg text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Logo */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-12 h-12 tdf-yellow-bg rounded-full flex items-center justify-center">
                  <span className="font-montserrat font-extrabold text-black text-xl">MPC</span>
                </div>
              </div>
              <p className="font-poppins text-gray-400 text-sm">
                Le fantasy cycling français
              </p>
            </div>
            
            {/* Liens Le jeu */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">Le jeu</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">À propos</a></li>
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Règles du jeu</a></li>
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Comment jouer</a></li>
              </ul>
            </div>
            
            {/* Liens Légal */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">Légal</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Mentions légales</a></li>
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">CGU</a></li>
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Confidentialité</a></li>
              </ul>
            </div>
            
            {/* Liens Communauté */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">Communauté</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Contact</a></li>
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Discord</a></li>
                <li><a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">Instagram</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="font-poppins text-gray-500 text-sm">
              © 2025 Mon Petit Cycliste. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
