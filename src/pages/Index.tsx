import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, TrendingUp, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import heroImage from "@/assets/hero-cycling.jpg";
import climbingImage from "@/assets/cyclist-climbing.jpg";
import victoryImage from "@/assets/team-victory.jpg";

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
      <section className="relative overflow-hidden h-screen">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
        <div className="container relative mx-auto px-4 h-full flex flex-col justify-center items-center text-center">
          <img src={logo} alt="Mon Petit Cycliste" className="h-32 w-32 mb-8 animate-fade-in" />
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground animate-fade-in">
            Mon Petit Cycliste
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in">
            Créez votre équipe, participez aux enchères et dominez le classement avec vos coureurs favoris
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
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

      {/* Image Showcase Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div className="relative overflow-hidden rounded-lg shadow-elegant group">
              <img 
                src={climbingImage} 
                alt="Cycliste en montagne" 
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Performance Individuelle</h3>
                  <p className="text-muted-foreground">Suivez les exploits de vos coureurs</p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg shadow-elegant group">
              <img 
                src={victoryImage} 
                alt="Équipe victorieuse" 
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-6">
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Succès d'Équipe</h3>
                  <p className="text-muted-foreground">Célébrez les victoires ensemble</p>
                </div>
              </div>
            </div>
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
