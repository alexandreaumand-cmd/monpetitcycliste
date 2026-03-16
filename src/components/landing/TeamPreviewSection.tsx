import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, Wallet } from "lucide-react";

const TeamPreviewSection = () => {
  const { t } = useTranslation("home");

  const teamCategories = [
    {
      name: t("teamPreview.leaders"),
      color: "text-bordure-gold",
      bgColor: "bg-bordure-gold/10",
      borderColor: "border-bordure-gold/30",
      riders: [
        { name: "POGACAR", stars: 3 },
        { name: "VINGEGAARD", stars: 3 },
      ],
    },
    {
      name: t("teamPreview.sprinters"),
      color: "text-bordure-pink",
      bgColor: "bg-bordure-pink/10",
      borderColor: "border-bordure-pink/30",
      riders: [
        { name: "PHILIPSEN", stars: 2 },
        { name: "MERLIER", stars: 1 },
      ],
    },
    {
      name: t("teamPreview.climbers"),
      color: "text-white",
      bgColor: "bg-white/5",
      borderColor: "border-white/20",
      riders: [
        { name: "BARDET", stars: 2 },
        { name: "CICCONE", stars: 1 },
      ],
    },
  ];

  return (
    <section className="py-20 bg-bordure-cream">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-secondary mb-4">
            {t("teamPreview.title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-inter">
            {t("teamPreview.subtitle")}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-secondary border border-white/10 overflow-hidden">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teamCategories.map((category, index) => (
                  <div
                    key={index}
                    className={`rounded-xl ${category.bgColor} border ${category.borderColor} p-4`}
                  >
                    <h4 className={`text-xs font-bold ${category.color} mb-3 tracking-wider font-montserrat uppercase`}>
                      {category.name}
                    </h4>
                    <div className="space-y-2">
                      {category.riders.map((rider, riderIndex) => (
                        <div
                          key={riderIndex}
                          className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                        >
                          <span className="text-white text-sm font-medium font-inter">
                            {rider.name}
                          </span>
                          <div className="flex gap-0.5">
                            {[...Array(rider.stars)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-3 h-3 text-bordure-gold fill-bordure-gold"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-secondary border-t border-white/10 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-bordure-gold" />
                  <span className="text-white/60 text-sm font-inter">
                    {t("teamPreview.budgetRemaining")}
                  </span>
                </div>
                <span className="text-xl font-montserrat font-bold text-bordure-gold">
                  15M€
                </span>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link to="/auth">
              <Button size="lg" className="px-8">
                {t("teamPreview.cta")} →
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeamPreviewSection;
