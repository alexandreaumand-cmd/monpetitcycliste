import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bike, Trophy, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

const heroPeloton = "/hero-peloton-aerial.webp";

const HeroSection = () => {
  const { t } = useTranslation("home");

  const scrollToNextSection = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  const badges = [
    { icon: Bike, label: t("hero.badges.uci") },
    { icon: Trophy, label: t("hero.badges.auctions") },
    { icon: Smartphone, label: t("hero.badges.free") },
  ];

  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroPeloton}
          alt="Vue aérienne du peloton cycliste en montagne"
          className="w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          width={1920}
          height={1080}
        />
        {/* Dark overlay for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, hsla(147,45%,21%,0.55) 0%, hsla(147,45%,21%,0.7) 50%, hsla(147,45%,21%,0.92) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-24 pb-16 text-center flex flex-col items-center">
        <motion.h1
          className="text-4xl sm:text-5xl lg:text-6xl font-montserrat font-bold text-white mb-2 leading-[1.1]"
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          {t("hero.title1")}
        </motion.h1>

        <motion.h1
          className="text-4xl sm:text-5xl lg:text-6xl font-montserrat font-bold text-bordure-gold mb-6 leading-[1.1]"
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          {t("hero.title2")}
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg text-white/80 max-w-lg mx-auto mb-8 font-inter leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("hero.subtitle")}
        </motion.p>

        {/* Single CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to="/auth">
            <Button size="lg" className="text-lg px-10 py-7 shadow-lg shadow-bordure-gold/25">
              {t("hero.cta.createLeague")}
            </Button>
          </Link>
        </motion.div>

        {/* Badges */}
        <motion.div
          className="flex flex-wrap justify-center gap-3 sm:gap-6 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          {badges.map((badge, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-white/70 text-sm font-inter"
            >
              <badge.icon className="w-4 h-4 text-bordure-gold" />
              <span>{badge.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.button
          onClick={scrollToNextSection}
          className="mt-12 text-white/40 hover:text-white/70 transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          aria-label="Scroll down"
        >
          <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </motion.button>
      </div>
    </section>
  );
};

export default HeroSection;
