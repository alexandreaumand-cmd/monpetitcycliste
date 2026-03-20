import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import cyclistClimbing from "@/assets/cyclist-climbing.jpg";

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
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={cyclistClimbing}
          alt="Cyclist climbing"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, hsla(147,45%,21%,0.92), hsla(147,45%,21%,0.85), hsla(147,45%,21%,0.75))" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.h2
          className="text-3xl md:text-4xl font-montserrat font-bold text-white mb-3"
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          {t("cta.title")}
        </motion.h2>
        <motion.p
          className="text-white/60 mb-8 max-w-md mx-auto font-inter"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("cta.subtitle")}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link to="/auth">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 shadow-lg shadow-bordure-gold/20">
              {t("cta.createLeague")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-lg px-8 py-6 border-white/30 text-white hover:bg-white/10"
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
