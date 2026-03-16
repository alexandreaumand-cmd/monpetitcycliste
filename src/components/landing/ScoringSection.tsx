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
    { color: "bg-bordure-gold", name: t("scoring.jerseys.yellow"), points: 50, rider: t("scoring.riders.pogacar") },
    { color: "bg-green-600", name: t("scoring.jerseys.green"), points: 30, rider: "PHILIPSEN" },
    { color: "bg-red-500", name: t("scoring.jerseys.polkaDot"), points: 30, rider: "CICCONE" },
  ];

  return (
    <section className="py-20 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-white mb-4">
            {t("scoring.title")}
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto font-inter">
            {t("scoring.subtitle")}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl shadow-bordure-gold/5">
            <div className="bg-secondary px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-red-400 font-bold text-sm">{t("scoring.live")}</span>
                </div>
                <span className="text-white font-montserrat font-semibold">
                  {t("scoring.stageName")}
                </span>
              </div>
              <Bike className="w-5 h-5 text-white/30" />
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 font-montserrat">
                  {t("scoring.stageResults")}
                </h3>
                <div className="space-y-3">
                  {stageResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                        result.highlight
                          ? "bg-bordure-gold/10 border border-bordure-gold/30"
                          : "bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          result.position === 1 ? "bg-primary text-primary-foreground" :
                          result.position === 2 ? "bg-gray-400 text-white" :
                          result.position === 3 ? "bg-amber-700 text-white" :
                          "bg-white/10 text-white/60"
                        }`}>
                          {result.position}
                        </span>
                        <div className="flex items-center gap-2">
                          <Bike className="w-4 h-4 text-white/30" />
                          <span className="text-white font-medium font-inter">{result.rider}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${result.highlight ? "text-bordure-gold" : "text-white/70"}`}>
                          +{result.points}
                        </span>
                        <span className="text-white/40 text-sm font-inter">{t("scoring.points")}</span>
                        {result.highlight && (
                          <span className="text-bordure-gold animate-pulse">✨</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10" />

              <div>
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 font-montserrat">
                  {t("scoring.jerseyBonus")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {jerseys.map((jersey, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <div className={`w-8 h-8 rounded-full ${jersey.color} flex items-center justify-center shadow-lg`}>
                        {jersey.color.includes("red") && (
                          <span className="text-white text-xs">●</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate font-inter">{jersey.name}</p>
                        <p className="text-white/40 text-xs truncate font-inter">{jersey.rider}</p>
                      </div>
                      <span className="text-bordure-gold font-bold text-sm whitespace-nowrap">
                        +{jersey.points}{t("scoring.jerseys.perDay")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-bordure-gold/10 to-bordure-pink/10 border border-bordure-gold/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 font-medium font-inter">
                    📊 {t("scoring.yourTotal")}
                  </span>
                  <span className="text-2xl font-montserrat font-bold text-bordure-gold">
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
