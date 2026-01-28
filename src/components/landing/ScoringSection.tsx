import { useTranslation } from "react-i18next";
import { Bike } from "lucide-react";

const ScoringSection = () => {
  const { t } = useTranslation("home");

  const stageResults = [
    { position: 1, rider: t("scoring.riders.pogacar"), points: 100, highlight: true },
    { position: 2, rider: t("scoring.riders.vingegaard"), points: 70 },
    { position: 3, rider: t("scoring.riders.evenepoel"), points: 50 },
    { position: 10, rider: t("scoring.riders.vanAert"), points: 20 },
  ];

  const jerseys = [
    { color: "bg-[#FFD500]", name: t("scoring.jerseys.yellow"), points: 50, rider: t("scoring.riders.pogacar") },
    { color: "bg-green-500", name: t("scoring.jerseys.green"), points: 30, rider: "PHILIPSEN" },
    { color: "bg-red-500", name: t("scoring.jerseys.polkaDot"), points: 30, rider: "CICCONE" },
  ];

  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("scoring.title")}
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t("scoring.subtitle")}
          </p>
        </div>

        {/* Live Race Interface */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden shadow-2xl shadow-yellow-500/5">
            {/* Header with LIVE badge */}
            <div className="bg-gray-950 px-6 py-4 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-3">
                {/* Animated LIVE badge */}
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-red-500 font-bold text-sm">{t("scoring.live")}</span>
                </div>
                <span className="text-white font-poppins font-semibold">
                  {t("scoring.stageName")}
                </span>
              </div>
              <Bike className="w-5 h-5 text-gray-500" />
            </div>

            <div className="p-6 space-y-6">
              {/* Stage Results */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  {t("scoring.stageResults")}
                </h3>
                <div className="space-y-3">
                  {stageResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                        result.highlight
                          ? "bg-yellow-500/10 border border-yellow-500/30"
                          : "bg-gray-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          result.position === 1 ? "bg-[#FFD500] text-black" :
                          result.position === 2 ? "bg-gray-400 text-black" :
                          result.position === 3 ? "bg-amber-600 text-white" :
                          "bg-gray-700 text-gray-300"
                        }`}>
                          {result.position}
                        </span>
                        <div className="flex items-center gap-2">
                          <Bike className="w-4 h-4 text-gray-500" />
                          <span className="text-white font-medium">{result.rider}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${result.highlight ? "text-[#FFD500]" : "text-gray-300"}`}>
                          +{result.points}
                        </span>
                        <span className="text-gray-500 text-sm">{t("scoring.points")}</span>
                        {result.highlight && (
                          <span className="text-yellow-400 animate-pulse">✨</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-800" />

              {/* Jersey Bonuses */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  {t("scoring.jerseyBonus")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {jerseys.map((jersey, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50"
                    >
                      <div className={`w-8 h-8 rounded-full ${jersey.color} flex items-center justify-center shadow-lg`}>
                        {jersey.color.includes("red") && (
                          <span className="text-white text-xs">●</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{jersey.name}</p>
                        <p className="text-gray-500 text-xs truncate">{jersey.rider}</p>
                      </div>
                      <span className="text-[#FFD500] font-bold text-sm whitespace-nowrap">
                        +{jersey.points}{t("scoring.jerseys.perDay")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-medium">
                    📊 {t("scoring.yourTotal")}
                  </span>
                  <span className="text-2xl font-poppins font-bold text-[#FFD500]">
                    +180 {t("scoring.points")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScoringSection;
