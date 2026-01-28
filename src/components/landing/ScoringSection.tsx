import { useTranslation } from "react-i18next";
import { Medal, Award, Trophy } from "lucide-react";

const ScoringSection = () => {
  const { t } = useTranslation("home");

  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("scoring.title")}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t("scoring.subtitle")}
          </p>
        </div>

        {/* Podium Visual */}
        <div className="flex items-end justify-center gap-4 mb-12 max-w-md mx-auto">
          {/* Silver - 2nd place */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center mb-2 shadow-lg">
              <Medal className="w-8 h-8 text-white" />
            </div>
            <div className="w-20 h-24 bg-gradient-to-t from-gray-600 to-gray-400 rounded-t-lg flex flex-col items-center justify-center">
              <span className="text-white font-bold text-lg">70</span>
              <span className="text-white/80 text-xs">{t("scoring.points")}</span>
            </div>
            <span className="text-gray-400 text-sm mt-2">{t("scoring.podium.silver")}</span>
          </div>

          {/* Gold - 1st place */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD500] to-yellow-600 flex items-center justify-center mb-2 shadow-lg shadow-yellow-500/30">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div className="w-24 h-32 bg-gradient-to-t from-yellow-600 to-[#FFD500] rounded-t-lg flex flex-col items-center justify-center">
              <span className="text-black font-bold text-2xl">100</span>
              <span className="text-black/80 text-xs">{t("scoring.points")}</span>
            </div>
            <span className="text-[#FFD500] text-sm mt-2 font-semibold">{t("scoring.podium.gold")}</span>
          </div>

          {/* Bronze - 3rd place */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center mb-2 shadow-lg">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div className="w-20 h-20 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t-lg flex flex-col items-center justify-center">
              <span className="text-white font-bold text-lg">50</span>
              <span className="text-white/80 text-xs">{t("scoring.points")}</span>
            </div>
            <span className="text-amber-500 text-sm mt-2">{t("scoring.podium.bronze")}</span>
          </div>
        </div>

        {/* Scoring Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Stage Rankings */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-poppins font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFD500]" />
              {t("scoring.categories.stage")}
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.first")}</span>
                <span className="text-[#FFD500] font-semibold">100 {t("scoring.points")}</span>
              </li>
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.second")}</span>
                <span className="text-gray-400 font-semibold">70 {t("scoring.points")}</span>
              </li>
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.third")}</span>
                <span className="text-amber-500 font-semibold">50 {t("scoring.points")}</span>
              </li>
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.top10")}</span>
                <span className="text-gray-500 font-semibold">20 {t("scoring.points")}</span>
              </li>
            </ul>
          </div>

          {/* Jerseys */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-poppins font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {t("scoring.categories.jerseys")}
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.yellowJersey")}</span>
                <span className="text-[#FFD500] font-semibold">50 {t("scoring.points")}</span>
              </li>
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.greenJersey")}</span>
                <span className="text-green-500 font-semibold">30 {t("scoring.points")}</span>
              </li>
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.polkaDotJersey")}</span>
                <span className="text-red-500 font-semibold">30 {t("scoring.points")}</span>
              </li>
            </ul>
          </div>

          {/* General Classification */}
          <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-poppins font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              {t("scoring.categories.gc")}
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.gcTop3")}</span>
                <span className="text-purple-400 font-semibold">500 {t("scoring.points")}</span>
              </li>
              <li className="flex justify-between text-gray-300">
                <span>{t("scoring.positions.gcTop10")}</span>
                <span className="text-purple-500 font-semibold">200 {t("scoring.points")}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScoringSection;
