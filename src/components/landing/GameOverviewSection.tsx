import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bike, Trophy, Target, Swords } from "lucide-react";

const steps = [
  { key: "bid", Icon: Target, accent: "gold" as const },
  { key: "follow", Icon: Bike, accent: "pink" as const },
  { key: "score", Icon: Trophy, accent: "gold" as const },
  { key: "dominate", Icon: Swords, accent: "pink" as const },
];

const accentStyles = {
  gold: {
    circle: "bg-bordure-gold/15 border border-bordure-gold/30",
    icon: "text-bordure-gold",
    number: "text-bordure-gold/60",
  },
  pink: {
    circle: "bg-bordure-pink/15 border border-bordure-pink/30",
    icon: "text-bordure-pink",
    number: "text-bordure-pink/60",
  },
};

const GameOverviewSection = () => {
  const { t } = useTranslation("home");

  return (
    <section className="pt-14 pb-6 md:pt-20 md:pb-8 bg-bordure-cream">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8 max-w-5xl mx-auto">
          {steps.map(({ key, Icon, accent }, i) => {
            const style = accentStyles[accent];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative bg-card rounded-2xl p-6 md:p-8 flex flex-col items-center text-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border"
              >
                {/* Step number */}
                <span className={`absolute top-3 right-4 font-montserrat font-bold text-lg ${style.number}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${style.circle}`}>
                  <Icon size={30} strokeWidth={1.6} className={style.icon} />
                </div>

                {/* Title */}
                <h3 className="text-bordure-green font-montserrat font-bold text-sm md:text-base uppercase tracking-widest">
                  {t(`overview.steps.${key}.title`)}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground text-sm leading-relaxed">
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
