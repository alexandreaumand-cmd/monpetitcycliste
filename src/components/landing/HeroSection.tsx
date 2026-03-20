import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const HeroSection = () => {
  const { t } = useTranslation("home");

  return (
    <section className="relative min-h-[100svh] flex items-end overflow-hidden">
      {/* Background — Unsplash peloton in mountains */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=1920&q=80&auto=format&fit=crop"
          alt="Peloton de cyclistes en haute montagne"
          className="w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        {/* Subtle bottom gradient for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, hsla(0,0%,0%,0.7) 0%, hsla(0,0%,0%,0.3) 40%, transparent 70%)",
          }}
        />
      </div>

      {/* Content — aligned bottom-left, editorial style */}
      <div className="relative z-10 container mx-auto px-5 pb-16 md:pb-24 pt-32">
        <motion.p
          className="text-bordure-gold font-inter text-sm tracking-[0.2em] uppercase mb-4"
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Fantasy Cycling
        </motion.p>

        <motion.h1
          className="text-5xl sm:text-6xl lg:text-8xl font-montserrat font-bold text-white leading-[0.95] mb-2 max-w-4xl"
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("hero.title1")}
        </motion.h1>

        <motion.h1
          className="text-5xl sm:text-6xl lg:text-8xl font-montserrat italic text-bordure-gold leading-[0.95] mb-8 max-w-4xl"
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("hero.title2")}
        </motion.h1>

        <motion.p
          className="text-white/70 font-inter text-base sm:text-lg max-w-md mb-10 leading-relaxed"
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
    </section>
  );
};

export default HeroSection;