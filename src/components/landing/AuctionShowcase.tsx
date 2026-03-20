import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

const AuctionShowcase = () => {
  const { t } = useTranslation("home");

  const managers = [
    { name: t("auction.managers.manager1.name"), bid: t("auction.managers.manager1.bid"), color: "hsl(var(--bordure-gold))", isHighest: false },
    { name: t("auction.managers.manager2.name"), bid: t("auction.managers.manager2.bid"), color: "hsl(var(--bordure-pink))", isHighest: true },
    { name: t("auction.managers.manager3.name"), bid: t("auction.managers.manager3.bid"), color: "hsl(147 45% 60%)", isHighest: false },
  ];

  return (
    <section className="relative py-24 md:py-36 overflow-hidden">
      {/* Background — cyclist close-up from Unsplash */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&q=80&auto=format&fit=crop"
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

          {/* Auction card — glass morphism */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl">
              {/* Rider header */}
              <div className="flex items-center gap-4 mb-6 pb-5 border-b border-white/10">
                <div className="w-12 h-12 rounded-full bg-bordure-gold/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🚴</span>
                </div>
                <div>
                  <p className="text-white font-montserrat font-bold text-lg leading-tight">
                    {t("auction.rider")}
                  </p>
                  <p className="text-white/40 text-sm font-inter">
                    {t("auction.riderTeam")}
                  </p>
                </div>
              </div>

              {/* Bids */}
              <div className="space-y-3">
                {managers.map((manager, i) => (
                  <motion.div
                    key={i}
                    className={`flex items-center justify-between p-3.5 rounded-xl ${
                      manager.isHighest
                        ? "bg-bordure-pink/15 border border-bordure-pink/30"
                        : "bg-white/5 border border-transparent"
                    }`}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-montserrat font-bold text-xs"
                        style={{ backgroundColor: manager.color }}
                      >
                        {manager.name.charAt(0)}
                      </div>
                      <span className="text-white font-inter text-sm font-medium">
                        {manager.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {manager.isHighest && (
                        <TrendingUp className="w-4 h-4 text-bordure-pink" />
                      )}
                      <span className={`font-montserrat font-bold text-lg tabular-nums ${manager.isHighest ? "text-bordure-pink" : "text-white/70"}`}>
                        {manager.bid}
                      </span>
                      <span className="text-white/40 text-xs font-inter">
                        {t("auction.currency")}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Highest bid */}
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-white/40 text-sm font-inter">{t("auction.highestBid")}</span>
                <span className="text-bordure-pink font-montserrat font-bold text-xl tabular-nums">
                  52 {t("auction.currency")}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AuctionShowcase;