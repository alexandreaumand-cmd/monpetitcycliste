import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import showcaseResults from "@/assets/showcase-results.png";

const AuctionShowcase = () => {
  const { t } = useTranslation("home");

  return (
    <section className="relative py-16 md:py-36 overflow-hidden">
      {/* Background — cyclist close-up */}
      <div className="absolute inset-0">
        <img
          src="/images/peloton-finish.jpg"
          alt="Cycliste en effort"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, hsla(0,0%,0%,0.85) 0%, hsla(0,0%,0%,0.6) 100%)" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-5">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-6xl mx-auto">
          {/* Text — editorial style */}
          <motion.div
            initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-montserrat font-bold text-white leading-[0.95] mb-2">
              {t("auction.title")}
            </h2>
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-montserrat italic text-bordure-gold leading-[0.95] mb-6">
              {t("auction.titleAccent")}
            </h2>
            <p className="text-white/60 font-inter text-base sm:text-lg leading-relaxed mb-10 max-w-md">
              {t("auction.subtitle")}
            </p>
            <Link to="/auth">
              <Button
                size="lg"
                className="text-base px-8 py-6 bg-bordure-gold hover:bg-bordure-gold/90 text-secondary font-montserrat font-bold shadow-lg shadow-bordure-gold/20 active:scale-[0.97] transition-transform"
              >
                {t("auction.cta")}
              </Button>
            </Link>
          </motion.div>

          {/* Screenshot des résultats */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={showcaseResults}
              alt="Aperçu des résultats de courses"
              className="w-full rounded-2xl shadow-2xl shadow-black/40"
              loading="lazy"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AuctionShowcase;