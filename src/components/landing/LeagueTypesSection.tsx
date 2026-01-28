import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Calendar, Users, Globe } from "lucide-react";

const LeagueTypesSection = () => {
  const { t } = useTranslation("home");

  const leagueTypes = [
    {
      icon: Zap,
      type: t("leagues.quick.type"),
      description: t("leagues.quick.description"),
      cta: t("leagues.quick.cta"),
      gradient: "from-orange-500 to-red-500",
    },
    {
      icon: Calendar,
      type: t("leagues.season.type"),
      description: t("leagues.season.description"),
      cta: t("leagues.season.cta"),
      gradient: "from-blue-500 to-purple-500",
    },
    {
      icon: Users,
      type: t("leagues.friends.type"),
      description: t("leagues.friends.description"),
      cta: t("leagues.friends.cta"),
      gradient: "from-green-500 to-teal-500",
    },
    {
      icon: Globe,
      type: t("leagues.public.type"),
      description: t("leagues.public.description"),
      cta: t("leagues.public.cta"),
      gradient: "from-yellow-500 to-orange-500",
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {leagueTypes.map((league, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-xl bg-gray-900 border border-gray-800 hover:border-yellow-500/50 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Gradient top bar */}
              <div className={`h-1 bg-gradient-to-r ${league.gradient}`} />

              <div className="p-6">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${league.gradient} flex items-center justify-center mb-4`}>
                  <league.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-lg font-poppins font-semibold text-white mb-2">
                  {league.type}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {league.description}
                </p>

                <Link to="/auth">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#FFD500] hover:text-yellow-300 hover:bg-yellow-500/10 p-0"
                  >
                    {league.cta} →
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LeagueTypesSection;
