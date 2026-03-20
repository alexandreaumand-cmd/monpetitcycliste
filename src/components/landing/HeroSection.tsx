import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const HeroSection = () => {
  const { t } = useTranslation("home");

  return (
    <section className="relative min-h-[100svh] flex items-end overflow-hidden">
      {/* Background — Van der Poel Paris-Roubaix */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-roubaix.jpg"
          alt="Mathieu van der Poel célèbre sa victoire sur le vélodrome de Roubaix"
          className="w-full h-full object-cover object-[center_20%]"
          loading="eager"
          fetchPriority="high"
        />
      </div>

      {/* Localized gradient behind text only */}
      <div className="absolute inset-0 z-[1] flex items-end">
        <div className="mb-8 md:mb-12 ml-5 md:ml-12 max-w-xl bg-gradient-to-r from-black/75 via-black/60 to-transparent backdrop-blur-[2px] rounded-r-2xl px-8 py-8 md:px-10 md:py-10">
          <motion.p
            className="text-bordure-gold font-inter text-sm tracking-[0.2em] uppercase mb-3"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            Fantasy Cycling
          </motion.p>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-7xl font-montserrat font-bold text-white leading-[0.95] mb-2 max-w-3xl"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.9)" }}
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("hero.title1")}
          </motion.h1>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-7xl font-montserrat italic text-bordure-gold leading-[0.95] mb-6 max-w-3xl"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.9)" }}
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("hero.title2")}
          </motion.h1>

          <motion.p
            className="text-white/80 font-inter text-base sm:text-lg max-w-md mb-8 leading-relaxed"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to="/auth">
              <Button
                size="lg"
                className="text-base sm:text-lg px-10 py-7 bg-bordure-gold hover:bg-bordure-gold/90 text-secondary font-montserrat font-bold shadow-xl shadow-bordure-gold/20 active:scale-[0.97] transition-transform"
              >
                {t("hero.cta.createLeague")}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;