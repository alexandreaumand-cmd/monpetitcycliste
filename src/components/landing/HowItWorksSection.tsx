import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

/**
 * "Découvre le jeu" — 3 blocks with CSS device mockups showing app UI
 * Asymmetric editorial layout, alternating text/visual sides
 */
const HowItWorksSection = () => {
  const { t } = useTranslation("home");

  const blocks = [
    {
      title: t("discover.blocks.auction.title"),
      text: t("discover.blocks.auction.text"),
      mockup: <AuctionMockup />,
    },
    {
      title: t("discover.blocks.team.title"),
      text: t("discover.blocks.team.text"),
      mockup: <TeamMockup />,
    },
    {
      title: t("discover.blocks.ranking.title"),
      text: t("discover.blocks.ranking.text"),
      mockup: <RankingMockup />,
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-bordure-cream">
      <div className="container mx-auto px-5">
        <motion.p
          className="text-bordure-gold font-inter text-sm tracking-[0.2em] uppercase mb-16 md:mb-24"
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {t("discover.surtitle")}
        </motion.p>

        <div className="space-y-24 md:space-y-40">
          {blocks.map((block, i) => {
            const isReversed = i % 2 === 1;
            return (
              <div
                key={i}
                className={`flex flex-col ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-10 lg:gap-20 items-center`}
              >
                {/* Text */}
                <motion.div
                  className="flex-1 max-w-lg"
                  initial={{ opacity: 0, x: isReversed ? 20 : -20, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-secondary leading-[1.05] mb-4">
                    {block.title}
                  </h2>
                  <p className="text-secondary/60 font-inter text-base sm:text-lg leading-relaxed">
                    {block.text}
                  </p>
                </motion.div>

                {/* Device mockup */}
                <motion.div
                  className="flex-1 flex justify-center"
                  initial={{ opacity: 0, x: isReversed ? -20 : 20, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="w-[260px] sm:w-[280px]">
                    <PhoneMockup>{block.mockup}</PhoneMockup>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/** iPhone-style device frame */
const PhoneMockup = ({ children }: { children: React.ReactNode }) => (
  <div className="relative">
    {/* Phone frame */}
    <div className="bg-secondary rounded-[2.5rem] p-2.5 shadow-2xl shadow-secondary/30">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-secondary rounded-b-2xl z-10" />
      {/* Screen */}
      <div className="bg-bordure-cream rounded-[2rem] overflow-hidden aspect-[9/19.5]">
        {children}
      </div>
    </div>
  </div>
);

/** Stylized auction page mockup */
const AuctionMockup = () => (
  <div className="h-full p-4 pt-8 flex flex-col gap-3">
    <div className="text-center mb-2">
      <p className="text-[10px] text-secondary/40 font-inter uppercase tracking-wider">Round 3</p>
      <p className="text-xs font-montserrat font-bold text-secondary">Enchères en direct</p>
    </div>
    {/* Rider card */}
    <div className="bg-white rounded-xl p-3 border border-secondary/8 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-bordure-gold/20 flex items-center justify-center text-[10px]">🚴</div>
        <div>
          <p className="text-[10px] font-montserrat font-bold text-secondary leading-tight">T. POGAČAR</p>
          <p className="text-[8px] text-secondary/40 font-inter">UAE Emirates</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {[
          { name: "Guillaume", bid: "45", active: false },
          { name: "Marie", bid: "52", active: true },
          { name: "Thomas", bid: "38", active: false },
        ].map((m, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-[9px] ${
              m.active ? "bg-bordure-pink/10 border border-bordure-pink/20" : "bg-secondary/3"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold ${
                  m.active ? "bg-bordure-pink" : "bg-secondary/30"
                }`}
              >
                {m.name[0]}
              </div>
              <span className="text-secondary/80 font-inter">{m.name}</span>
            </div>
            <span className={`font-montserrat font-bold ${m.active ? "text-bordure-pink" : "text-secondary/50"}`}>
              {m.bid}M€
            </span>
          </div>
        ))}
      </div>
    </div>
    {/* Timer */}
    <div className="bg-bordure-gold/10 rounded-lg p-2 text-center">
      <p className="text-[8px] text-secondary/40 font-inter">Temps restant</p>
      <p className="text-sm font-montserrat font-bold text-bordure-gold">02:34</p>
    </div>
  </div>
);

/** Stylized team composition mockup */
const TeamMockup = () => {
  const riders = [
    { name: "T. Pogačar", team: "UAE", pts: "847", flag: "🇸🇮" },
    { name: "J. Vingegaard", team: "Visma", pts: "723", flag: "🇩🇰" },
    { name: "R. Evenepoel", team: "Soudal", pts: "691", flag: "🇧🇪" },
    { name: "W. van Aert", team: "Visma", pts: "654", flag: "🇧🇪" },
    { name: "M. van der Poel", team: "Alpecin", pts: "612", flag: "🇳🇱" },
  ];
  return (
    <div className="h-full p-4 pt-8 flex flex-col gap-2">
      <div className="text-center mb-2">
        <p className="text-[10px] text-secondary/40 font-inter uppercase tracking-wider">Mon équipe</p>
        <p className="text-xs font-montserrat font-bold text-secondary">5 coureurs</p>
      </div>
      {riders.map((r, i) => (
        <div key={i} className="bg-white rounded-xl px-3 py-2.5 border border-secondary/8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm">{r.flag}</span>
            <div>
              <p className="text-[10px] font-montserrat font-bold text-secondary leading-tight">{r.name}</p>
              <p className="text-[8px] text-secondary/40 font-inter">{r.team}</p>
            </div>
          </div>
          <p className="text-[10px] font-montserrat font-bold text-bordure-green">{r.pts} pts</p>
        </div>
      ))}
    </div>
  );
};

/** Stylized ranking mockup */
const RankingMockup = () => {
  const managers = [
    { name: "Marie", pts: "2 847", pos: 1, you: false },
    { name: "Toi", pts: "2 691", pos: 2, you: true },
    { name: "Guillaume", pts: "2 534", pos: 3, you: false },
    { name: "Thomas", pts: "2 212", pos: 4, you: false },
    { name: "Lucas", pts: "1 987", pos: 5, you: false },
  ];
  return (
    <div className="h-full p-4 pt-8 flex flex-col gap-2">
      <div className="text-center mb-2">
        <p className="text-[10px] text-secondary/40 font-inter uppercase tracking-wider">Classement</p>
        <p className="text-xs font-montserrat font-bold text-secondary">Ligue des Champions</p>
      </div>
      {managers.map((m, i) => (
        <div
          key={i}
          className={`rounded-xl px-3 py-2.5 flex items-center justify-between border shadow-sm ${
            m.you ? "bg-bordure-gold/10 border-bordure-gold/20" : "bg-white border-secondary/8"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                m.pos === 1 ? "bg-bordure-gold text-white" : "bg-secondary/10 text-secondary/60"
              }`}
            >
              {m.pos}
            </span>
            <p className={`text-[10px] font-montserrat font-bold ${m.you ? "text-bordure-gold" : "text-secondary"}`}>
              {m.name}
            </p>
          </div>
          <p className="text-[10px] font-montserrat font-bold text-secondary/70">{m.pts}</p>
        </div>
      ))}
    </div>
  );
};

export default HowItWorksSection;