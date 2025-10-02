import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, TrendingUp, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Trophy,
      title: "Enchères en Direct",
      description: "Participez aux enchères en temps réel pour constituer votre équipe de rêve"
    },
    {
      icon: Users,
      title: "Gestion d'Équipe",
      description: "Gérez votre roster de 30 coureurs avec un budget de 2200€"
    },
    {
      icon: TrendingUp,
      title: "Classements Live",
      description: "Suivez vos performances en temps réel sur chaque course et phase"
    },
    {
      icon: Award,
      title: "Système de Points",
      description: "Gagnez des points basés sur les performances réelles de vos coureurs"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-10" />
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-primary-light to-accent bg-clip-text text-transparent">
              Fantasy Cycling League
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Créez votre équipe, participez aux enchères et dominez le classement avec vos coureurs favoris
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="gradient-primary text-white hover:opacity-90 transition-smooth shadow-elegant text-lg px-8"
                onClick={() => navigate('/auth')}
              >
                Commencer Maintenant
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10 transition-smooth text-lg px-8"
              >
                En Savoir Plus
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Comment Ça Marche ?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer votre équipe cycliste virtuelle
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index} 
                  className="p-6 hover:shadow-elegant transition-smooth border-border/50 bg-card"
                >
                  <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                2200€
              </div>
              <div className="text-muted-foreground">Budget par Phase</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                30
              </div>
              <div className="text-muted-foreground">Coureurs Maximum</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                5
              </div>
              <div className="text-muted-foreground">Phases par Saison</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Prêt à Commencer ?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Rejoignez la compétition et montrez vos talents de manager cycliste
          </p>
          <Button 
            size="lg" 
            className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-elegant text-lg px-8"
            onClick={() => navigate('/auth')}
          >
            S'inscrire Gratuitement
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
