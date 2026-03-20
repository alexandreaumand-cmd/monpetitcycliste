import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
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
      <div className="absolute inset-0 z-[1] flex items-end justify-end">
        <div className="mb-6 md:mb-10 mr-5 md:mr-12 max-w-xl bg-gradient-to-l from-black/75 via-black/60 to-transparent backdrop-blur-[2px] rounded-l-2xl px-6 py-5 md:px-10 md:py-6">
          <motion.p
            className="text-bordure-gold font-inter text-sm tracking-[0.2em] uppercase mb-2"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            Fantasy Cycling
          </motion.p>

          <motion.h1
            className="text-[clamp(1.75rem,4vw,4.5rem)] font-montserrat font-bold text-white leading-[0.95] mb-1 max-w-3xl"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.9)" }}
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("hero.title1")}
          </motion.h1>

          <motion.h1
            className="text-[clamp(1.75rem,4vw,4.5rem)] font-montserrat italic text-bordure-gold leading-[0.95] mb-3 max-w-3xl"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.9)" }}
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("hero.title2")}
          </motion.h1>

          <motion.p
            className="text-white/80 font-inter text-[clamp(0.8rem,1.2vw,1.125rem)] max-w-md mb-2 leading-relaxed"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            className="flex gap-1 mb-4"
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "left" }}
          >
            <span className="h-0.5 w-8 rounded-full bg-bordure-green" />
            <span className="h-0.5 w-8 rounded-full bg-bordure-gold" />
            <span className="h-0.5 w-8 rounded-full bg-bordure-pink" />
            <span className="h-0.5 w-8 rounded-full bg-white/40" />
          </motion.div>

          <motion.div
            className="flex flex-wrap gap-3"
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to="/auth">
              <Button
                size="lg"
                className="text-sm sm:text-base px-6 py-5 bg-bordure-gold hover:bg-bordure-gold/90 text-secondary font-montserrat font-bold shadow-xl shadow-bordure-gold/20 active:scale-[0.97] transition-transform"
              >
                {t("hero.cta.createLeague")}
              </Button>
            </Link>
            <Link to="/install">
              <Button
                size="lg"
                variant="outline"
                className="text-sm sm:text-base px-5 py-5 border-white/40 bg-white/10 hover:bg-white/20 text-white font-montserrat font-semibold active:scale-[0.97] transition-transform"
              >
                <Download className="w-5 h-5 mr-2" />
                {t("hero.cta.install")}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;