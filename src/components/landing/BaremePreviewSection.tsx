import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Flag, Shirt } from "lucide-react";

const BaremePreviewSection = () => {
  const { t } = useTranslation("home");

  const gcPoints = [
    { pos: "1er", pts: "1 600" },
    { pos: "2e", pts: "1 280" },
    { pos: "3e", pts: "1 040" },
    { pos: "4e", pts: "800" },
    { pos: "5e", pts: "600" },
  ];

  const stagePoints = [
    { pos: "1er", pts: "300" },
    { pos: "2e", pts: "240" },
    { pos: "3e", pts: "195" },
    { pos: "4e", pts: "150" },
    { pos: "5e", pts: "120" },
  ];

  const jerseys = [
    { name: t("bareme.jerseys.leader"), pts: "20", color: "bg-yellow-400" },
    { name: t("bareme.jerseys.green"), pts: "12", color: "bg-green-500" },
    { name: t("bareme.jerseys.gpm"), pts: "12", color: "bg-red-500" },
    { name: t("bareme.jerseys.young"), pts: "6", color: "bg-white border border-white/30" },
  ];

  return (
    <section className="py-20 bg-secondary text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {/* Classement Général */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-bordure-gold/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-bordure-gold" />
              </div>
              <h3 className="font-montserrat font-bold text-lg">{t("bareme.gc.title")}</h3>
            </div>
            <div className="space-y-2">
              {gcPoints.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm font-inter">
                  <span className="text-white/60">{row.pos}</span>
                  <div className="flex-1 mx-3 border-b border-dashed border-white/10" />
                  <span className="font-bold text-bordure-gold">{row.pts} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Étapes */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-bordure-pink/20 flex items-center justify-center">
                <Flag className="w-5 h-5 text-bordure-pink" />
              </div>
              <h3 className="font-montserrat font-bold text-lg">{t("bareme.stage.title")}</h3>
            </div>
            <div className="space-y-2">
              {stagePoints.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm font-inter">
                  <span className="text-white/60">{row.pos}</span>
                  <div className="flex-1 mx-3 border-b border-dashed border-white/10" />
                  <span className="font-bold text-bordure-pink">{row.pts} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Maillots */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Shirt className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-montserrat font-bold text-lg">{t("bareme.jerseys.title")}</h3>
            </div>
            <div className="space-y-3">
              {jerseys.map((jersey, i) => (
                <div key={i} className="flex items-center justify-between text-sm font-inter">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${jersey.color}`} />
                    <span className="text-white/80">{jersey.name}</span>
                  </div>
                  <span className="font-bold text-white">{jersey.pts} pts/j</span>
                </div>
              ))}
            </div>
            <p className="text-white/40 text-xs mt-4 font-inter italic">
              {t("bareme.jerseys.note")}
            </p>
          </div>
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
