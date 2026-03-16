import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Mountain, Trophy, Users } from "lucide-react";

const LeagueTypesSection = () => {
  const { t } = useTranslation("home");

  const gameModes = [
    {
      icon: Zap,
      type: t("leagues.sprint.type"),
      duration: t("leagues.sprint.duration"),
      description: t("leagues.sprint.description"),
      cta: t("leagues.sprint.cta"),
      gradient: "from-bordure-gold to-bordure-pink",
      bgGlow: "bg-bordure-gold/10",
    },
    {
      icon: Mountain,
      type: t("leagues.grandTour.type"),
      duration: t("leagues.grandTour.duration"),
      description: t("leagues.grandTour.description"),
      cta: t("leagues.grandTour.cta"),
      gradient: "from-bordure-green to-bordure-gold",
      bgGlow: "bg-bordure-green/10",
      featured: true,
    },
    {
      icon: Trophy,
      type: t("leagues.season.type"),
      duration: t("leagues.season.duration"),
      description: t("leagues.season.description"),
      cta: t("leagues.season.cta"),
      gradient: "from-bordure-pink to-bordure-gold",
      bgGlow: "bg-bordure-pink/10",
    },
  ];

  return (
    <section className="py-20 bg-bordure-cream">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-secondary mb-4">
            {t("leagues.title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-inter">
            {t("leagues.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
          {gameModes.map((mode, index) => (
            <div
              key={index}
              className={`group relative overflow-hidden rounded-xl bg-white border transition-all duration-300 hover:-translate-y-2 ${
                mode.featured
                  ? "border-bordure-gold/50 hover:border-bordure-gold"
                  : "border-border hover:border-bordure-gold/50"
              }`}
            >
              {mode.featured && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                  POPULAIRE
                </div>
              )}

              <div className={`h-1.5 bg-gradient-to-r ${mode.gradient}`} />

              <div className="p-6">
                <div className={`relative w-16 h-16 rounded-xl ${mode.bgGlow} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${mode.gradient} opacity-20`} />
                  <mode.icon className="w-8 h-8 text-secondary relative z-10" />
                </div>

                <h3 className="text-xl font-montserrat font-bold text-secondary mb-1">
                  {mode.type}
                </h3>
                <p className={`text-sm font-semibold mb-3 bg-gradient-to-r ${mode.gradient} bg-clip-text text-transparent`}>
                  {mode.duration}
                </p>

                <p className="text-muted-foreground text-sm mb-6 min-h-[48px] font-inter">
                  {mode.description}
                </p>

                <Link to="/auth">
                  <Button
                    variant="outline"
                    className="w-full border-border hover:border-bordure-gold hover:bg-bordure-gold/10 text-secondary"
                  >
                    {mode.cta} →
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-xl bg-secondary/5 border border-secondary/20 hover:border-secondary/40 transition-all duration-300">
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-montserrat font-bold text-secondary flex items-center gap-2">
                    {t("leagues.friends.type")}
                    <span className="text-sm font-normal text-bordure-gold font-inter">
                      — {t("leagues.friends.tagline")}
                    </span>
                  </h3>
                  <p className="text-muted-foreground text-sm font-inter">
                    {t("leagues.friends.description")}
                  </p>
                </div>
              </div>
              <Link to="/auth">
                <Button className="px-8">
                  {t("leagues.friends.cta")} →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LeagueTypesSection;
