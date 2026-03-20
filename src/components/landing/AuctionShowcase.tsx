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
    <section className="py-20 md:py-28 bg-secondary overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-white mb-4" style={{ textWrap: "balance" } as React.CSSProperties}>
              {t("auction.title")}
            </h2>
            <p className="text-white/60 font-inter leading-relaxed mb-8 max-w-md">
              {t("auction.subtitle")}
            </p>
            <Link to="/auth">
              <Button size="lg" className="text-base px-8 py-6">
                {t("auction.cta")}
              </Button>
            </Link>
          </motion.div>

          {/* Auction card simulation */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
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
                    className={`flex items-center justify-between p-3.5 rounded-xl transition-colors ${
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
                      <span className={`font-montserrat font-bold text-lg ${manager.isHighest ? "text-bordure-pink" : "text-white/70"}`}>
                        {manager.bid}
                      </span>
                      <span className="text-white/40 text-xs font-inter">
                        {t("auction.currency")}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Highest bid label */}
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-white/40 text-sm font-inter">{t("auction.highestBid")}</span>
                <span className="text-bordure-pink font-montserrat font-bold text-xl">
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
