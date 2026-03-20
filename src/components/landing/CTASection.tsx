import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const CTASection = () => {
  const { t } = useTranslation("home");

  const handleShare = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: "La Bordure", text: t("cta.subtitle"), url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié !");
    }
  };

  return (
    <section className="relative py-28 md:py-40 overflow-hidden">
      {/* Background — mountain col */}
      <div className="absolute inset-0">
        <img
          src="/images/ganna-tt.jpeg"
          alt="Filippo Ganna en position contre-la-montre"
          className="w-full h-full object-cover object-[center_30%]"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, hsla(0,0%,0%,0.9) 0%, hsla(0,0%,0%,0.7) 40%, hsla(0,0%,0%,0.55) 100%)" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-5 text-center">
        <motion.h2
          className="text-4xl sm:text-5xl lg:text-7xl font-montserrat font-bold text-white leading-[0.95] mb-2"
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("cta.title")}
        </motion.h2>
        <motion.h2
          className="text-4xl sm:text-5xl lg:text-7xl font-montserrat italic text-bordure-gold leading-[0.95] mb-8"
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("cta.titleAccent")}
        </motion.h2>
        <motion.p
          className="text-white/60 mb-10 max-w-md mx-auto font-inter text-base sm:text-lg"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {t("cta.subtitle")}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link to="/auth">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base sm:text-lg px-10 py-7 bg-bordure-gold hover:bg-bordure-gold/90 text-secondary font-montserrat font-bold shadow-xl shadow-bordure-gold/20 active:scale-[0.97] transition-transform"
            >
              {t("cta.createLeague")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-base sm:text-lg px-8 py-7 border-white text-white bg-white/15 hover:bg-white/25 font-inter active:scale-[0.97] transition-transform"
            onClick={handleShare}
          >
            <Share2 className="w-5 h-5 mr-2" />
            {t("cta.share")}
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;