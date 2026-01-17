import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, TrendingUp, Award, MapPin, Calendar, Shield, Target, Zap, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-cycling.jpg";
import mpcLogo from "@/assets/mpc-logo.png";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('home');
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

  const howItWorksSteps = [
    {
      icon: Trophy,
      title: t('howItWorks.steps.step1.title'),
      description: t('howItWorks.steps.step1.description'),
    },
    {
      icon: Users,
      title: t('howItWorks.steps.step2.title'),
      description: t('howItWorks.steps.step2.description'),
    },
    {
      icon: TrendingUp,
      title: t('howItWorks.steps.step3.title'),
      description: t('howItWorks.steps.step3.description'),
    },
  ];

  const leagueTypes = [
    {
      type: t('leagues.quick.type'),
      description: t('leagues.quick.description'),
      cta: t('leagues.quick.cta'),
      Icon: Zap,
      gradient: "from-yellow-50 to-yellow-100",
      border: "border-yellow-400",
    },
    {
      type: t('leagues.season.type'),
      description: t('leagues.season.description'),
      cta: t('leagues.season.cta'),
      Icon: Calendar,
      gradient: "from-gray-50 to-gray-100",
      border: "border-gray-400",
    },
    {
      type: t('leagues.friends.type'),
      description: t('leagues.friends.description'),
      cta: t('leagues.friends.cta'),
      Icon: Users,
      gradient: "from-yellow-100 to-amber-100",
      border: "border-amber-400",
    },
    {
      type: t('leagues.public.type'),
      description: t('leagues.public.description'),
      cta: t('leagues.public.cta'),
      Icon: Globe,
      gradient: "from-black to-gray-900",
      border: "border-yellow-400",
      textWhite: true,
    },
  ];

  const scoringCategories = [
    {
      category: t('scoring.categories.stage'),
      items: [
        { position: t('scoring.positions.first'), points: "100", icon: Trophy, color: "yellow" },
        { position: t('scoring.positions.second'), points: "80", icon: Award, color: "gray" },
        { position: t('scoring.positions.third'), points: "60", icon: Award, color: "orange" },
        { position: t('scoring.positions.top10'), points: "20-40", icon: Target, color: "blue" },
      ],
    },
    {
      category: t('scoring.categories.jerseys'),
      items: [
        { position: t('scoring.positions.yellowJersey'), points: "+30/jour", icon: Shield, color: "yellow" },
        { position: t('scoring.positions.greenJersey'), points: "+25/jour", icon: Shield, color: "green" },
        { position: t('scoring.positions.polkaDotJersey'), points: "+20/jour", icon: Shield, color: "red" },
      ],
    },
    {
      category: t('scoring.categories.gc'),
      items: [
        { position: t('scoring.positions.gcTop3'), points: "150-300", icon: MapPin, color: "yellow" },
        { position: t('scoring.positions.gcTop10'), points: "50-100", icon: MapPin, color: "gray" },
      ],
    },
  ];

  const testimonials = [
    {
      quote: t('testimonials.quotes.quote1.text'),
      author: t('testimonials.quotes.quote1.author'),
      location: t('testimonials.quotes.quote1.location'),
      initials: "JM",
      rating: 5,
    },
    {
      quote: t('testimonials.quotes.quote2.text'),
      author: t('testimonials.quotes.quote2.author'),
      location: t('testimonials.quotes.quote2.location'),
      initials: "ML",
      rating: 5,
    },
    {
      quote: t('testimonials.quotes.quote3.text'),
      author: t('testimonials.quotes.quote3.author'),
      location: t('testimonials.quotes.quote3.location'),
      initials: "TR",
      rating: 5,
    },
  ];

  const whyPlayFeatures = [
    {
      Icon: Trophy,
      text: t('whyPlay.features.realRaces.title'),
      description: t('whyPlay.features.realRaces.description'),
      gradient: "from-yellow-400 to-yellow-500",
    },
    {
      Icon: Target,
      text: t('whyPlay.features.strategy.title'),
      description: t('whyPlay.features.strategy.description'),
      gradient: "from-blue-400 to-blue-500",
    },
    {
      Icon: Users,
      text: t('whyPlay.features.friends.title'),
      description: t('whyPlay.features.friends.description'),
      gradient: "from-green-400 to-green-500",
    },
    {
      Icon: Award,
      text: t('whyPlay.features.rankings.title'),
      description: t('whyPlay.features.rankings.description'),
      gradient: "from-purple-400 to-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header fixe */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={mpcLogo} alt="Mon Petit Cycliste" className="h-10 w-10" />
            <span className="font-montserrat font-bold text-xl">Mon Petit Cycliste</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="ghost" size="icon" />
            <Button onClick={() => (user ? navigate("/dashboard/home") : navigate("/auth"))}>
              {user ? t('header.myLeagues') : t('header.login')}
            </Button>
          </div>
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
              {t('hero.title1')} <br className="hidden sm:block" />
              <span className="tdf-yellow-text">{t('hero.title2')}</span>
            </h1>
            <p className="font-poppins text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="tdf-yellow-bg text-black hover:bg-yellow-400 font-montserrat font-bold text-lg px-8 py-6 shadow-2xl transition-all hover:scale-105"
                onClick={() => (user ? navigate("/dashboard/home") : navigate("/auth"))}
              >
                🟡 {user ? t('hero.cta.myLeagues') : t('hero.cta.createLeague')}
              </Button>
              <Button
                size="lg"
                className="bg-transparent text-white border-2 border-white hover:bg-white/10 font-montserrat font-bold text-lg px-8 py-6"
              >
                {t('hero.cta.discover')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche - 3 colonnes */}
      <section className="py-20 bg-gradient-to-br from-gray-50 via-white to-yellow-50">
        <div className="container mx-auto px-4">
          <h2 className="font-montserrat text-4xl md:text-5xl font-bold text-center mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            {t('howItWorks.title')}
          </h2>
          <p className="font-poppins text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
            {t('howItWorks.subtitle')}
          </p>

          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {howItWorksSteps.map((step, i) => (
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
            <h2 className="font-montserrat text-4xl md:text-5xl font-bold mb-4">{t('leagues.title')}</h2>
            <p className="font-poppins text-lg text-gray-600">{t('leagues.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {leagueTypes.map((league, i) => (
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
            {t('scoring.title')}
          </h2>
          <p className="font-poppins text-center text-gray-600 mb-12 max-w-3xl mx-auto text-lg">
            {t('scoring.subtitle')}
          </p>

          {/* Grille détaillée */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {scoringCategories.map((category, idx) => (
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
                        {item.points} {t('scoring.points')}
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
                  <p className="font-montserrat font-bold text-lg">{t('scoring.podium.silver')}</p>
                  <Badge className="bg-gray-500 text-white mt-1">80 {t('scoring.points')}</Badge>
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
                  <p className="font-montserrat font-bold text-lg">{t('scoring.podium.gold')}</p>
                  <Badge className="bg-yellow-500 text-black mt-1 font-bold">100 {t('scoring.points')}</Badge>
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
                  <p className="font-montserrat font-bold text-lg">{t('scoring.podium.bronze')}</p>
                  <Badge className="bg-orange-500 text-white mt-1">60 {t('scoring.points')}</Badge>
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
            {t('testimonials.title')}
          </h2>
          <p className="font-poppins text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            {t('testimonials.subtitle')}
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, i) => (
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
            {t('whyPlay.title')}{" "}
            <span className="block text-yellow-400 mt-2">{t('whyPlay.brandName')}</span>
            <span className="text-yellow-400">{t('whyPlay.questionMark')}</span>
          </h2>
          <p className="font-poppins text-center text-gray-400 mb-16 max-w-2xl mx-auto text-lg">
            {t('whyPlay.subtitle')}
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {whyPlayFeatures.map((feature, i) => (
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
            {t('cta.title')}
          </h2>
          <p className="font-poppins text-xl text-gray-900 mb-8">{t('cta.subtitle')}</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="tdf-black-bg text-white hover:bg-gray-900 font-montserrat font-bold text-lg px-10 py-6"
              onClick={() => navigate("/auth")}
            >
              🟡 {t('cta.createLeague')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-black text-black hover:bg-black/10 font-montserrat font-bold text-lg px-10 py-6 bg-transparent"
              onClick={() => navigate("/auth")}
            >
              ⚫ {t('cta.trySolo')}
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
              <p className="font-poppins text-gray-400 text-sm">{t('footer.tagline')}</p>
            </div>

            {/* Liens Le jeu */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">{t('footer.game.title')}</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.game.about')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.game.rules')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.game.howToPlay')}
                  </a>
                </li>
              </ul>
            </div>

            {/* Liens Légal */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">{t('footer.legal.title')}</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.legal.legalNotice')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.legal.terms')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.legal.privacy')}
                  </a>
                </li>
              </ul>
            </div>

            {/* Liens Communauté */}
            <div>
              <h4 className="font-montserrat font-bold mb-3">{t('footer.community.title')}</h4>
              <ul className="space-y-2 font-poppins text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.community.contact')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.community.discord')}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                    {t('footer.community.instagram')}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="font-poppins text-gray-500 text-sm">{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
