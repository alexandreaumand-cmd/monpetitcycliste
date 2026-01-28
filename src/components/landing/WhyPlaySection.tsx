import { useTranslation } from "react-i18next";
import { Radio, Target, UserPlus, Award } from "lucide-react";

const WhyPlaySection = () => {
  const { t } = useTranslation("home");

  const features = [
    {
      icon: Radio,
      title: t("whyPlay.features.realRaces.title"),
      description: t("whyPlay.features.realRaces.description"),
    },
    {
      icon: Target,
      title: t("whyPlay.features.strategy.title"),
      description: t("whyPlay.features.strategy.description"),
    },
    {
      icon: UserPlus,
      title: t("whyPlay.features.friends.title"),
      description: t("whyPlay.features.friends.description"),
    },
    {
      icon: Award,
      title: t("whyPlay.features.rankings.title"),
      description: t("whyPlay.features.rankings.description"),
    },
  ];

  return (
    <section className="py-20 bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-2">
            {t("whyPlay.title")}{" "}
            <span className="text-[#FFD500]">{t("whyPlay.brandName")}</span>
            {t("whyPlay.questionMark")}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t("whyPlay.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex gap-4 p-6 rounded-xl bg-gray-900/30 border border-gray-800 hover:border-yellow-500/30 transition-all duration-300"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#FFD500]/10 flex items-center justify-center">
                <feature.icon className="w-6 h-6 text-[#FFD500]" />
              </div>
              <div>
                <h3 className="text-lg font-poppins font-semibold text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyPlaySection;
