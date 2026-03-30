import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layers, Zap, Users, Trophy, Calendar, Target } from "lucide-react";

const LeagueTypesSection = () => {
  const { t } = useTranslation("home");

  const modes = [
    {
      icon: Layers,
      title: t("gameModes.phases.title"),
      subtitle: t("gameModes.phases.subtitle"),
      description: t("gameModes.phases.description"),
      specs: [
        { icon: Users, label: t("gameModes.phases.specs.roster") },
        { icon: Trophy, label: t("gameModes.phases.specs.budget") },
        { icon: Calendar, label: t("gameModes.phases.specs.auctions") },
      ],
      gradient: "from-bordure-green to-bordure-gold",
      accent: "border-bordure-green/30 hover:border-bordure-green/60",
      featured: true,
    },
    {
      icon: Zap,
      title: t("gameModes.alaCourse.title"),
      subtitle: t("gameModes.alaCourse.subtitle"),
      description: t("gameModes.alaCourse.description"),
      specs: [
        { icon: Target, label: t("gameModes.alaCourse.specs.roster") },
        { icon: Trophy, label: t("gameModes.alaCourse.specs.budget") },
        { icon: Calendar, label: t("gameModes.alaCourse.specs.auctions") },
      ],
      gradient: "from-bordure-gold to-bordure-pink",
      accent: "border-bordure-gold/30 hover:border-bordure-gold/60",
      featured: false,
    },
  ];

  return (
    <section className="py-20 bg-bordure-cream">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-bordure-gold uppercase tracking-widest mb-3 font-montserrat">
            {t("gameModes.surtitle")}
          </p>
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-secondary mb-4">
            {t("gameModes.title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-inter">
            {t("gameModes.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
          {modes.map((mode, index) => (
            <div
              key={index}
              className={`group relative overflow-hidden rounded-2xl bg-white border-[0.5px] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${mode.accent}`}
            >
              {mode.featured && (
                <div className="absolute top-4 right-4 px-2.5 py-1 bg-bordure-green text-white rounded-full text-xs font-bold font-montserrat">
                  POPULAIRE
                </div>
              )}

              <div className={`h-1.5 bg-gradient-to-r ${mode.gradient}`} />

              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center`}>
                    <mode.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-montserrat font-bold text-secondary">
                      {mode.title}
                    </h3>
                    <p className={`text-xs font-semibold bg-gradient-to-r ${mode.gradient} bg-clip-text text-transparent`}>
                      {mode.subtitle}
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground text-sm mb-6 font-inter leading-relaxed">
                  {mode.description}
                </p>

                <div className="space-y-3 mb-6">
                  {mode.specs.map((spec, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-bordure-cream flex items-center justify-center">
                        <spec.icon className="w-4 h-4 text-secondary" />
                      </div>
                      <span className="text-secondary font-inter font-medium">{spec.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/rules">
            <Button variant="outline" className="border-secondary/20 hover:border-bordure-gold hover:bg-bordure-gold/10 text-secondary font-montserrat">
              {t("gameModes.cta")} →
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default LeagueTypesSection;
