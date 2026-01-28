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
      gradient: "from-orange-500 to-red-500",
      bgGlow: "bg-orange-500/10",
    },
    {
      icon: Mountain,
      type: t("leagues.grandTour.type"),
      duration: t("leagues.grandTour.duration"),
      description: t("leagues.grandTour.description"),
      cta: t("leagues.grandTour.cta"),
      gradient: "from-blue-500 to-purple-500",
      bgGlow: "bg-blue-500/10",
      featured: true,
    },
    {
      icon: Trophy,
      type: t("leagues.season.type"),
      duration: t("leagues.season.duration"),
      description: t("leagues.season.description"),
      cta: t("leagues.season.cta"),
      gradient: "from-purple-500 to-pink-500",
      bgGlow: "bg-purple-500/10",
    },
  ];

  return (
    <section className="py-20 bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("leagues.title")}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t("leagues.subtitle")}
          </p>
        </div>

        {/* Main game modes - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
          {gameModes.map((mode, index) => (
            <div
              key={index}
              className={`group relative overflow-hidden rounded-xl bg-gray-900 border transition-all duration-300 hover:-translate-y-2 ${
                mode.featured
                  ? "border-yellow-500/50 hover:border-yellow-500"
                  : "border-gray-800 hover:border-yellow-500/50"
              }`}
            >
              {/* Featured badge */}
              {mode.featured && (
                <div className="absolute top-3 right-3 px-2 py-1 bg-[#FFD500] rounded-full text-xs font-bold text-black">
                  POPULAIRE
                </div>
              )}

              {/* Gradient top bar */}
              <div className={`h-1.5 bg-gradient-to-r ${mode.gradient}`} />

              <div className="p-6">
                {/* Icon with glow */}
                <div className={`relative w-16 h-16 rounded-xl ${mode.bgGlow} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${mode.gradient} opacity-20`} />
                  <mode.icon className="w-8 h-8 text-white relative z-10" />
                </div>

                {/* Type & Duration */}
                <h3 className="text-xl font-poppins font-bold text-white mb-1">
                  {mode.type}
                </h3>
                <p className={`text-sm font-semibold mb-3 bg-gradient-to-r ${mode.gradient} bg-clip-text text-transparent`}>
                  {mode.duration}
                </p>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-6 min-h-[48px]">
                  {mode.description}
                </p>

                {/* CTA */}
                <Link to="/auth">
                  <Button
                    variant="outline"
                    className="w-full border-gray-700 hover:border-yellow-500 hover:bg-yellow-500/10 text-white"
                  >
                    {mode.cta} →
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Friends mode - Full width card */}
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-900/30 to-teal-900/30 border border-green-500/30 hover:border-green-500/50 transition-all duration-300">
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Users className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-poppins font-bold text-white flex items-center gap-2">
                    {t("leagues.friends.type")}
                    <span className="text-sm font-normal text-green-400">
                      — {t("leagues.friends.tagline")}
                    </span>
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {t("leagues.friends.description")}
                  </p>
                </div>
              </div>
              <Link to="/auth">
                <Button className="bg-green-600 hover:bg-green-500 text-white px-8">
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
