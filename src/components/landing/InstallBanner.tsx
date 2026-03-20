import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

const InstallBanner = () => {
  const { t } = useTranslation("home");

  return (
    <section className="bg-bordure-green py-14 md:py-20">
      <div className="container mx-auto px-5">
        <motion.div
          className="flex flex-col md:flex-row items-center justify-between gap-8 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-bordure-gold/15 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-7 h-7 text-bordure-gold" />
            </div>
            <div>
              <h3 className="text-white font-montserrat font-bold text-xl md:text-2xl mb-1">
                {t("installBanner.title")}
              </h3>
              <p className="text-white/60 font-inter text-sm md:text-base">
                {t("installBanner.subtitle")}
              </p>
            </div>
          </div>

          <Link to="/install" className="flex-shrink-0">
            <Button
              size="lg"
              className="px-8 py-6 bg-bordure-gold hover:bg-bordure-gold/90 text-secondary font-montserrat font-bold active:scale-[0.97] transition-transform"
            >
              <Download className="w-5 h-5 mr-2" />
              {t("installBanner.cta")}
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default InstallBanner;
