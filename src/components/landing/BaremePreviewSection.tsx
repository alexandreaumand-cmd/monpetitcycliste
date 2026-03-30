import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Flag, Shirt, Award } from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey = "gt" | "2pro" | "1.1";

interface ScoringData {
  gc: Array<{ pos: string; pts: string }>;
  stage?: Array<{ pos: string; pts: string }>;
  jerseys?: Array<{ name: string; pts: string; color: string }>;
  jerseyNote?: string;
}

const BaremePreviewSection = () => {
  const { t } = useTranslation("home");
  const [activeTab, setActiveTab] = useState<TabKey>("gt");

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "gt", label: t("bareme.tabs.gt") },
    { key: "2pro", label: t("bareme.tabs.2pro") },
    { key: "1.1", label: t("bareme.tabs.1_1") },
  ];

  const data: Record<TabKey, ScoringData> = {
    gt: {
      gc: [
        { pos: "1er", pts: "1 600" },
        { pos: "2e", pts: "1 280" },
        { pos: "3e", pts: "1 040" },
        { pos: "4e", pts: "800" },
        { pos: "5e", pts: "600" },
      ],
      stage: [
        { pos: "1er", pts: "300" },
        { pos: "2e", pts: "240" },
        { pos: "3e", pts: "195" },
        { pos: "4e", pts: "150" },
        { pos: "5e", pts: "120" },
      ],
      jerseys: [
        { name: t("bareme.jerseys.leader"), pts: "20", color: "bg-yellow-400" },
        { name: t("bareme.jerseys.green"), pts: "12", color: "bg-green-500" },
        { name: t("bareme.jerseys.gpm"), pts: "12", color: "bg-red-500" },
        { name: t("bareme.jerseys.young"), pts: "6", color: "bg-white border border-white/30" },
      ],
      jerseyNote: t("bareme.jerseys.note"),
    },
    "2pro": {
      gc: [
        { pos: "1er", pts: "250" },
        { pos: "2e", pts: "200" },
        { pos: "3e", pts: "150" },
        { pos: "4e", pts: "120" },
        { pos: "5e", pts: "100" },
      ],
      stage: [
        { pos: "1er", pts: "150" },
        { pos: "2e", pts: "125" },
        { pos: "3e", pts: "100" },
        { pos: "4e", pts: "75" },
        { pos: "5e", pts: "60" },
      ],
      jerseys: [
        { name: t("bareme.jerseys.green"), pts: "50", color: "bg-green-500" },
        { name: t("bareme.jerseys.gpm"), pts: "50", color: "bg-red-500" },
        { name: t("bareme.jerseys.young"), pts: "30", color: "bg-white border border-white/30" },
      ],
      jerseyNote: t("bareme.jerseys.noteFinal"),
    },
    "1.1": {
      gc: [
        { pos: "1er", pts: "100" },
        { pos: "2e", pts: "80" },
        { pos: "3e", pts: "65" },
        { pos: "4e", pts: "50" },
        { pos: "5e", pts: "40" },
      ],
    },
  };

  const current = data[activeTab];
  const isOneDay = activeTab === "1.1";

  return (
    <section className="py-20 bg-secondary text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-bordure-gold uppercase tracking-widest mb-3 font-montserrat">
            {t("bareme.surtitle")}
          </p>
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold mb-4">
            {t("bareme.title")}
          </h2>
          <p className="text-white/60 max-w-xl mx-auto font-inter">
            {t("bareme.subtitle")}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 text-sm font-montserrat font-semibold rounded-lg transition-all",
                  activeTab === tab.key
                    ? "bg-bordure-gold text-secondary shadow-md"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div
          className={cn(
            "grid gap-6 max-w-5xl mx-auto mb-10",
            isOneDay ? "grid-cols-1 max-w-md" : "grid-cols-1 md:grid-cols-3"
          )}
        >
          {/* Classement Général / Classement */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-bordure-gold/20 flex items-center justify-center">
                {isOneDay ? (
                  <Award className="w-5 h-5 text-bordure-gold" />
                ) : (
                  <Trophy className="w-5 h-5 text-bordure-gold" />
                )}
              </div>
              <h3 className="font-montserrat font-bold text-lg">
                {isOneDay ? t("bareme.classification.title") : t("bareme.gc.title")}
              </h3>
            </div>
            <div className="space-y-2">
              {current.gc.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm font-inter">
                  <span className="text-white/60">{row.pos}</span>
                  <div className="flex-1 mx-3 border-b border-dashed border-white/10" />
                  <span className="font-bold text-bordure-gold">{row.pts} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Étapes */}
          {current.stage && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-bordure-pink/20 flex items-center justify-center">
                  <Flag className="w-5 h-5 text-bordure-pink" />
                </div>
                <h3 className="font-montserrat font-bold text-lg">{t("bareme.stage.title")}</h3>
              </div>
              <div className="space-y-2">
                {current.stage.map((row, i) => (
                  <div key={i} className="flex items-center justify-between text-sm font-inter">
                    <span className="text-white/60">{row.pos}</span>
                    <div className="flex-1 mx-3 border-b border-dashed border-white/10" />
                    <span className="font-bold text-bordure-pink">{row.pts} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maillots */}
          {current.jerseys && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shirt className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-montserrat font-bold text-lg">{t("bareme.jerseys.title")}</h3>
              </div>
              <div className="space-y-3">
                {current.jerseys.map((jersey, i) => (
                  <div key={i} className="flex items-center justify-between text-sm font-inter">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${jersey.color}`} />
                      <span className="text-white/80">{jersey.name}</span>
                    </div>
                    <span className="font-bold text-white">{jersey.pts} pts{isOneDay ? "" : "/j"}</span>
                  </div>
                ))}
              </div>
              {current.jerseyNote && (
                <p className="text-white/40 text-xs mt-4 font-inter italic">
                  {current.jerseyNote}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link to="/rules">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 font-montserrat">
              {t("bareme.cta")} →
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BaremePreviewSection;
