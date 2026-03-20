import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const SocialProofSection = () => {
  const { t } = useTranslation("home");

  const stats = [
    t("socialProof.stats.courses", { returnObjects: true }) as { value: string; label: string },
    t("socialProof.stats.riders", { returnObjects: true }) as { value: string; label: string },
    t("socialProof.stats.leagues", { returnObjects: true }) as { value: string; label: string },
  ];

  const quotes = [
    {
      text: t("socialProof.quotes.quote1.text"),
      author: t("socialProof.quotes.quote1.author"),
      location: t("socialProof.quotes.quote1.location"),
    },
    {
      text: t("socialProof.quotes.quote2.text"),
      author: t("socialProof.quotes.quote2.author"),
      location: t("socialProof.quotes.quote2.location"),
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-bordure-cream">
      <div className="container mx-auto px-4">
        <motion.h2
          className="text-3xl md:text-4xl font-montserrat font-bold text-secondary text-center mb-14"
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("socialProof.title")}
        </motion.h2>

        {/* Stats */}
        <motion.div
          className="flex flex-wrap justify-center gap-8 sm:gap-16 mb-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl md:text-5xl font-montserrat font-bold text-bordure-green">
                {stat.value}
              </p>
              <p className="text-secondary/50 text-sm font-inter mt-1 uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Quotes */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {quotes.map((quote, i) => (
            <motion.div
              key={i}
              className="bg-white rounded-2xl p-6 border border-secondary/8 shadow-sm"
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            >
              <Quote className="w-5 h-5 text-bordure-gold mb-3" />
              <p className="text-secondary/80 font-inter text-sm leading-relaxed mb-4">
                "{quote.text}"
              </p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                  <span className="text-secondary font-montserrat font-bold text-xs">
                    {quote.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-secondary font-inter text-sm font-medium">{quote.author}</p>
                  <p className="text-secondary/40 text-xs font-inter">{quote.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
