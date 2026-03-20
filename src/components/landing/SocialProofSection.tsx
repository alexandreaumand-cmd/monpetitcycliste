import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useCallback } from "react";

const SocialProofSection = () => {
  const { t } = useTranslation("home");
  const [currentSlide, setCurrentSlide] = useState(0);

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
    {
      text: t("socialProof.quotes.quote3.text"),
      author: t("socialProof.quotes.quote3.author"),
      location: t("socialProof.quotes.quote3.location"),
    },
  ];

  const goTo = useCallback((index: number) => {
    setCurrentSlide((index + quotes.length) % quotes.length);
  }, [quotes.length]);

  const QuoteCard = ({ quote, i, className = "" }: { quote: typeof quotes[0]; i: number; className?: string }) => (
    <motion.div
      className={`bg-white/8 backdrop-blur-sm rounded-2xl p-6 border border-white/10 ${className}`}
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
    >
      <Quote className="w-5 h-5 text-bordure-pink mb-3 opacity-80" />
      <p className="text-white/80 font-inter text-sm leading-relaxed mb-4">
        "{quote.text}"
      </p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <span className="text-white font-montserrat font-bold text-xs">
            {quote.author.charAt(0)}
          </span>
        </div>
        <div>
          <p className="text-white font-inter text-sm font-medium">{quote.author}</p>
          <p className="text-white/40 text-xs font-inter">{quote.location}</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <section className="relative py-24 md:py-36 overflow-hidden">
      {/* Background — peloton shot */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1534787238916-9ba6764efd4f?w=1920&q=80&auto=format&fit=crop"
          alt="Peloton cycliste"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, hsla(147,45%,21%,0.88) 0%, hsla(147,45%,21%,0.92) 100%)" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-5">
        <motion.h2
          className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-white text-center mb-16 md:mb-20 leading-[1.05]"
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("socialProof.title")}
        </motion.h2>

        {/* Stats — XXL typography */}
        <motion.div
          className="flex flex-wrap justify-center gap-12 sm:gap-20 mb-16 md:mb-24"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-5xl sm:text-6xl lg:text-7xl font-montserrat font-bold text-white/90 tabular-nums">
                {stat.value}
              </p>
              <p className="text-white/40 text-sm font-inter mt-2 uppercase tracking-[0.15em]">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Mobile carousel */}
        <div className="md:hidden relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {quotes.map((quote, i) => (
                <div key={i} className="w-full flex-shrink-0 px-1">
                  <QuoteCard quote={quote} i={0} />
                </div>
              ))}
            </div>
          </div>
          {/* Dots + arrows */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <button
              onClick={() => goTo(currentSlide - 1)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4 text-white/70" />
            </button>
            <div className="flex gap-2">
              {quotes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    i === currentSlide ? "bg-bordure-gold w-5" : "bg-white/30"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={() => goTo(currentSlide + 1)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {quotes.map((quote, i) => (
            <QuoteCard key={i} quote={quote} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
