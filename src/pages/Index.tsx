import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, TrendingUp, Award, MapPin, Calendar, Shield, Target, Zap, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-cycling.jpg";
import mpcLogo from "@/assets/mpc-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header fixe */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={mpcLogo} alt="Mon Petit Cycliste" className="h-10 w-10" />
            <span className="font-montserrat font-bold text-xl">Mon Petit Cycliste</span>
          </div>
          <Button onClick={() => (user ? navigate("/dashboard/home") : navigate("/auth"))}>
            {user ? "Mon Dashboard" : "Connexion"}
          </Button>
        </div>
      </header>

      {/* Hero Section - Tour de France Style */}
      <section className="relative overflow-hidden min-h-[550px] md:min-h-[600px] flex items-center tdf-black-bg">
        <div
          className="absolute inset-0 bg-cover bg-center grayscale opacity-40"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-black/60 to-black" />
        </div>

        <div className="container relative z-10 mx-auto px-4 py-12 md:py-16">
          <div className="max-w-4xl">
            <h1 className="font-montserrat text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.15]">
              Les cols c'est pour eux, <br className="hidden sm:block" />
              <span className="tdf-yellow-text">les points, c'est pour toi.</span>
            </h1>
            <p className="font-poppins text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              Mon Petit Cycliste, le jeu de fantasy cycling basé sur les vraies courses du calendrier UCI.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="tdf-yellow-bg text-black hover:bg-yellow-400 font-montserrat font-bold text-lg px-8 py-6 shadow-2xl transition-all hover:scale-105"
                onClick={() => (user ? navigate("/dashboard/home") : navigate("/auth"))}
              >
                🟡 {user ? "Mon Dashboard" : "Créer ma ligue"}
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
      <section className="py-20 bg-gradient-to-br from-gray-50 via-white to-yellow-50">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Comment ça marche ?
          </h2>
          <p className="font-poppins text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
            En 3 étapes simples, lance ton aventure de manager cycliste
          </p>

          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {[
              {
                icon: Trophy,
                title: "Crée ta ligue ou rejoins-en une",
                description: "Invite tes amis ou d'autres managers passionnés",
              },
              {
                icon: Users,
                title: "Compose ton équipe",
                description: "Fais ton mercato lors des enchères et choisis tes coureurs",
              },
              {
                icon: TrendingUp,
                title: "Suis les vraies courses",
                description: "Tes coureurs marquent des points selon leurs performances réelles",
              },
            ].map((step, i) => (
              <Card 
                key={i} 
                className="group border-2 border-gray-100 hover:border-yellow-400 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl bg-white/80 backdrop-blur-sm"
              >
                <CardContent className="pt-8 pb-6">
                  <div className="relative mb-6">
                    <div className="absolute -top-2 -left-2 bg-yellow-400 text-black font-montserrat font-black text-sm w-8 h-8 rounded-full flex items-center justify-center shadow-md">
                      {i + 1}
                    </div>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <step.icon className="w-10 h-10 text-black" />
                    </div>
                  </div>
                  <h3 className="font-montserrat font-bold text-xl mb-3 text-center">{step.title}</h3>
                  <p className="font-poppins text-gray-600 text-center leading-relaxed">{step.description}</p>
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
            <p className="font-poppins text-lg text-gray-600">Chaque joueur choisit sa ligue selon son envie de jeu.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              {
                type: "Ligues rapides",
                description: "Joue sur un seul Grand Tour",
                cta: "Tour de France",
                Icon: Zap,
                gradient: "from-yellow-50 to-yellow-100",
                border: "border-yellow-400",
              },
              {
                type: "Ligues saison",
                description: "Suis toute l'année cycliste",
                cta: "Saison complète",
                Icon: Calendar,
                gradient: "from-gray-50 to-gray-100",
                border: "border-gray-400",
              },
              {
                type: "Ligues entre amis",
                description: "Jusqu'à 10 managers",
                cta: "Créer ma ligue",
                Icon: Users,
                gradient: "from-yellow-100 to-amber-100",
                border: "border-amber-400",
              },
              {
                type: "Ligues publiques",
                description: "Affronte toute la communauté",
                cta: "Découvrir",
                Icon: Globe,
                gradient: "from-black to-gray-900",
                border: "border-yellow-400",
                textWhite: true,
              },
            ].map((league, i) => (
              <Card 
                key={i} 
                className={`hover:scale-105 transition-all duration-300 border-2 ${league.border} bg-gradient-to-br ${league.gradient} shadow-lg`}
              >
                <CardHeader>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                    <league.Icon className="w-8 h-8 text-black" />
                  </div>
                  <CardTitle className={`font-montserrat text-xl text-center ${league.textWhite ? 'text-white' : ''}`}>
                    {league.type}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`font-poppins mb-4 text-center ${league.textWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                    {league.description}
                  </p>
                  <Button
                    className="w-full bg-black text-yellow-400 hover:bg-gray-900 border border-yellow-500 font-montserrat font-semibold"
                    onClick={() => navigate("/auth")}
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
      <section className="py-20 bg-gradient-to-br from-gray-50 via-white to-yellow-50">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Comment gagner des points ?
          </h2>
          <p className="font-poppins text-center text-gray-600 mb-12 max-w-3xl mx-auto text-lg">
            Chaque action de tes coureurs durant les vraies courses UCI génère des points. 
            Plus tes coureurs performent, plus tu grimpes au classement !
          </p>

          {/* Grille détaillée */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {[
              {
                category: "Classements d'étape",
                items: [
                  { position: "1ère place", points: "100", icon: Trophy, color: "yellow" },
                  { position: "2ème place", points: "80", icon: Award, color: "gray" },
                  { position: "3ème place", points: "60", icon: Award, color: "orange" },
                  { position: "Top 10", points: "20-40", icon: Target, color: "blue" },
                ],
              },
              {
                category: "Maillots distinctifs",
                items: [
                  { position: "Maillot jaune", points: "+30/jour", icon: Shield, color: "yellow" },
                  { position: "Maillot vert", points: "+25/jour", icon: Shield, color: "green" },
                  { position: "Maillot à pois", points: "+20/jour", icon: Shield, color: "red" },
                ],
              },
              {
                category: "Classements généraux",
                items: [
                  { position: "GC Top 3", points: "150-300", icon: MapPin, color: "yellow" },
                  { position: "GC Top 10", points: "50-100", icon: MapPin, color: "gray" },
                ],
              },
            ].map((category, idx) => (
              <Card key={idx} className="border-2 border-yellow-400 shadow-xl bg-white">
                <CardHeader className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-b-2 border-yellow-400">
                  <CardTitle className="font-montserrat text-lg text-center">{category.category}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {category.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <item.icon className={`w-5 h-5 text-${item.color}-500`} />
                        <span className="font-poppins text-sm">{item.position}</span>
                      </div>
                      <Badge className="bg-black text-yellow-400 font-montserrat font-bold">
                        {item.points} pts
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Podium 3D moderne */}
          <div className="mt-12 flex justify-center items-end gap-6 max-w-md mx-auto">
            {/* 2ème place */}
            <div className="text-center flex-1">
              <div className="relative">
                <div className="w-full h-40 bg-gradient-to-b from-gray-300 to-gray-400 rounded-t-xl shadow-2xl flex flex-col items-center justify-between py-4 border-4 border-gray-500">
                  <Award className="w-10 h-10 text-gray-700" />
                  <span className="font-montserrat font-black text-4xl text-gray-700">2</span>
                </div>
                <div className="mt-3">
                  <p className="font-montserrat font-bold text-lg">Argent</p>
                  <Badge className="bg-gray-500 text-white mt-1">80 pts</Badge>
                </div>
              </div>
            </div>

            {/* 1ère place - plus haute */}
            <div className="text-center flex-1">
              <div className="relative">
                <div className="w-full h-56 bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-500 rounded-t-xl shadow-2xl flex flex-col items-center justify-between py-4 border-4 border-yellow-600 animate-pulse">
                  <Trophy className="w-12 h-12 text-yellow-900" />
                  <span className="font-montserrat font-black text-5xl text-yellow-900">1</span>
                </div>
                <div className="mt-3">
                  <p className="font-montserrat font-bold text-lg">Or</p>
                  <Badge className="bg-yellow-500 text-black mt-1 font-bold">100 pts</Badge>
                </div>
              </div>
            </div>

            {/* 3ème place */}
            <div className="text-center flex-1">
              <div className="relative">
                <div className="w-full h-32 bg-gradient-to-b from-orange-300 to-orange-500 rounded-t-xl shadow-2xl flex flex-col items-center justify-between py-4 border-4 border-orange-600">
                  <Award className="w-8 h-8 text-orange-800" />
                  <span className="font-montserrat font-black text-3xl text-orange-800">3</span>
                </div>
                <div className="mt-3">
                  <p className="font-montserrat font-bold text-lg">Bronze</p>
                  <Badge className="bg-orange-500 text-white mt-1">60 pts</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Témoignages / Communauté */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-4">
            Ce qu'ils en pensent
          </h2>
          <p className="font-poppins text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Des milliers de managers s'affrontent chaque saison
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                quote: "Une ambiance incroyable dans notre ligue entre potes ! On se challenge tous les soirs pendant le Tour.",
                author: "Maxime L.",
                location: "Lyon",
                initials: "ML",
                rating: 5,
              },
              {
                quote: "Le système d'enchères apporte une vraie dimension stratégique. Parfait pour les fans de cyclisme !",
                author: "Julie D.",
                location: "Nantes",
                initials: "JD",
                rating: 5,
              },
              {
                quote: "Suivre les courses prend une toute nouvelle dimension quand tes coureurs jouent les premières places.",
                author: "Thomas R.",
                location: "Paris",
                initials: "TR",
                rating: 5,
              },
            ].map((testimonial, i) => (
              <Card 
                key={i} 
                className="border-2 border-gray-200 hover:border-yellow-400 transition-all duration-300 hover:shadow-2xl bg-white/80 backdrop-blur-sm"
              >
                <CardContent className="pt-6 space-y-4">
                  {/* Rating stars */}
                  <div className="flex gap-1 justify-center">
                    {[...Array(testimonial.rating)].map((_, idx) => (
                      <Award key={idx} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="font-poppins text-base italic text-gray-700 leading-relaxed">
                    "{testimonial.quote}"
                  </p>

                  {/* Author avec avatar moderne */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-md">
                      <span className="font-montserrat font-black text-black text-sm">
                        {testimonial.initials}
                      </span>
                    </div>
                    <div>
                      <p className="font-montserrat font-bold text-gray-900">{testimonial.author}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {testimonial.location}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi jouer à MPC */}
      <section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-4">
            Pourquoi jouer à{" "}
            <span className="block text-yellow-400 mt-2">Mon Petit Cycliste</span>
          </h2>
          <p className="font-poppins text-center text-gray-400 mb-16 max-w-2xl mx-auto text-lg">
            Le fantasy cycling le plus immersif basé sur les vraies courses UCI
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                Icon: Trophy,
                text: "Basé sur les vraies courses",
                description: "Tous les résultats sont synchronisés avec le calendrier UCI officiel",
                gradient: "from-yellow-400 to-yellow-500",
              },
              {
                Icon: Target,
                text: "Stratégie et enchères",
                description: "Compose ton équipe lors des mercatos et choisis tes tactiques",
                gradient: "from-blue-400 to-blue-500",
              },
              {
                Icon: Users,
                text: "Joue avec tes amis",
                description: "Crée ta ligue privée et défie jusqu'à 10 managers",
                gradient: "from-green-400 to-green-500",
              },
              {
                Icon: Award,
                text: "Classements et trophées",
                description: "Grimpe au sommet et remporte les maillots prestigieux",
                gradient: "from-purple-400 to-purple-500",
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-yellow-400 transition-all duration-300 hover:scale-105 hover:bg-white/20 group"
              >
                <CardContent className="pt-8 pb-6 text-center space-y-4">
                  {/* Icône avec gradient */}
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mx-auto shadow-2xl group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.Icon className="w-9 h-9 text-white" />
                  </div>

                  {/* Titre */}
                  <h3 className="font-montserrat font-bold text-xl text-white">{feature.text}</h3>

                  {/* Description */}
                  <p className="font-poppins text-sm text-gray-300 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
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
          <p className="font-poppins text-xl text-gray-900 mb-8">Lance ta première ligue aujourd'hui.</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="tdf-black-bg text-white hover:bg-gray-900 font-montserrat font-bold text-lg px-10 py-6"
              onClick={() => navigate("/auth")}
            >
              🟡 Créer ma ligue
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-black text-black hover:bg-black/10 font-montserrat font-bold text-lg px-10 py-6 bg-transparent"
              onClick={() => navigate("/auth")}
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
              <p className="font-poppins text-gray-400 text-sm">Le fantasy cycling français</p>
            </div>

            {/* Liens Le jeu */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">Le jeu</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    À propos
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    Règles du jeu
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    Comment jouer
                  </a>
                </li>
              </ul>
            </div>

            {/* Liens Légal */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">Légal</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    Mentions légales
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    CGU
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    Confidentialité
                  </a>
                </li>
              </ul>
            </div>

            {/* Liens Communauté */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">Communauté</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    Discord
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="font-poppins text-gray-500 text-sm">© 2025 Mon Petit Cycliste. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
