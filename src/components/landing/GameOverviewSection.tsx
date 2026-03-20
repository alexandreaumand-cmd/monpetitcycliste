import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Gavel, Radio, TrendingUp, Crown } from "lucide-react";

const icons = [Gavel, Radio, TrendingUp, Crown];
const keys = ["bid", "follow", "score", "dominate"];
const accents = [
  "bg-bordure-gold/10 text-bordure-gold",
  "bg-bordure-pink/10 text-bordure-pink",
  "bg-bordure-gold/10 text-bordure-gold",
  "bg-bordure-pink/10 text-bordure-pink",
];

const GameOverviewSection = () => {
  const { t } = useTranslation("home");

  return (
    <section className="py-16 md:py-20 bg-cream">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 max-w-4xl mx-auto">
          {keys.map((key, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center gap-3"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${accents[i]}`}>
                  <Icon size={26} strokeWidth={1.8} />
                </div>
                <h3 className="text-bordure-green font-bold text-base uppercase tracking-wide">
                  {t(`overview.steps.${key}.title`)}
                </h3>
                <p className="text-bordure-text text-sm leading-relaxed">
                  {t(`overview.steps.${key}.desc`)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GameOverviewSection;
