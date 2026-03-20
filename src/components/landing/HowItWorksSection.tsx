import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Gavel, Trophy, RotateCcw, Users, MapPin, Award, SlidersHorizontal, Activity, Globe, ListChecks, Target, CalendarDays } from "lucide-react";

/**
 * "Découvre le jeu" — auction block, team block, ranking block, then classement phone block
 */
const HowItWorksSection = () => {
  const { t } = useTranslation("home");

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
          <AuctionBlock />
          <TeamBlock />
          <RankingBlock />

          {/* Classement block — simple phone mockup */}
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-center">
            <motion.div
              className="flex-1 max-w-lg"
              initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-secondary leading-[1.05] mb-4">
                {t("discover.blocks.classement.title")}
              </h2>
              <p className="text-secondary/60 font-inter text-base sm:text-lg leading-relaxed">
                {t("discover.blocks.classement.text")}
              </p>
            </motion.div>

            <motion.div
              className="flex-1 flex justify-center"
              initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-[260px] sm:w-[280px]">
                <PhoneMockup>
                  <img
                    src="/screenshots/ranking.png"
                    alt={t("discover.blocks.classement.title")}
                    className="w-full h-[110%] object-cover object-top"
                    loading="lazy"
                  />
                </PhoneMockup>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

/** Shared step list component */
const StepList = ({ steps, className = "" }: { steps: { icon: any; title: string; desc: string }[]; className?: string }) => (
  <div className={`space-y-5 ${className}`}>
    {steps.map((step, i) => (
      <motion.div
        key={i}
        className="flex items-start gap-4"
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, delay: 0.1 * i, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-10 h-10 rounded-xl bg-bordure-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <step.icon className="w-5 h-5 text-bordure-gold" />
        </div>
        <div>
          <p className="font-montserrat font-bold text-secondary text-sm mb-0.5">
            {step.title}
          </p>
          <p className="text-secondary/50 font-inter text-sm leading-relaxed">
            {step.desc}
          </p>
        </div>
      </motion.div>
    ))}
  </div>
);

/** Auction block: steps on the left, browser mockup on the right */
const AuctionBlock = () => {
  const { t } = useTranslation("home");

  const steps = [
    { icon: Gavel, title: t("discover.blocks.auction.steps.bid.title"), desc: t("discover.blocks.auction.steps.bid.desc") },
    { icon: Trophy, title: t("discover.blocks.auction.steps.win.title"), desc: t("discover.blocks.auction.steps.win.desc") },
    { icon: RotateCcw, title: t("discover.blocks.auction.steps.rounds.title"), desc: t("discover.blocks.auction.steps.rounds.desc") },
    { icon: Users, title: t("discover.blocks.auction.steps.team.title"), desc: t("discover.blocks.auction.steps.team.desc") },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">
      <motion.div
        className="lg:flex-shrink-0 lg:w-[400px]"
        initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-secondary leading-[1.05] mb-8">
          {t("discover.blocks.auction.title")}
        </h2>
        <StepList steps={steps} />
      </motion.div>

      <motion.div
        className="flex-1 w-full flex justify-center"
        initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-full max-w-[680px]">
          <BrowserMockup>
            <img
              src="/screenshots/encheres.png"
              alt={t("discover.blocks.auction.title")}
              className="w-full h-full object-cover object-top"
              loading="lazy"
            />
          </BrowserMockup>
        </div>
      </motion.div>
    </div>
  );
};

/** Team block: phone mockup on the left, steps on the right */
const TeamBlock = () => {
  const { t } = useTranslation("home");

  const steps = [
    { icon: MapPin, title: t("discover.blocks.team.steps.stages.title"), desc: t("discover.blocks.team.steps.stages.desc") },
    { icon: Award, title: t("discover.blocks.team.steps.jerseys.title"), desc: t("discover.blocks.team.steps.jerseys.desc") },
    { icon: SlidersHorizontal, title: t("discover.blocks.team.steps.optimize.title"), desc: t("discover.blocks.team.steps.optimize.desc") },
    { icon: Activity, title: t("discover.blocks.team.steps.realtime.title"), desc: t("discover.blocks.team.steps.realtime.desc") },
  ];

  return (
    <div className="flex flex-col lg:flex-row-reverse gap-10 lg:gap-20 items-center">
      <motion.div
        className="flex-1"
        initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-secondary leading-[1.05] mb-4">
          {t("discover.blocks.team.title")}
        </h2>
        <p className="text-secondary/60 font-inter text-base sm:text-lg leading-relaxed mb-8">
          {t("discover.blocks.team.text")}
        </p>
        <StepList steps={steps} />
      </motion.div>

      <motion.div
        className="lg:w-[280px] lg:flex-shrink-0 flex justify-center"
        initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-[260px] sm:w-[280px]">
          <PhoneMockup>
            <img
              src="/screenshots/team.png"
              alt={t("discover.blocks.team.title")}
              className="w-full h-[110%] object-cover object-top"
              loading="lazy"
            />
          </PhoneMockup>
        </div>
      </motion.div>
    </div>
  );
};

/** Ranking/Calendar block: text+steps on the left, phone mockup on the right */
const RankingBlock = () => {
  const { t } = useTranslation("home");

  const steps = [
    { icon: Globe, title: t("discover.blocks.ranking.steps.allRaces.title"), desc: t("discover.blocks.ranking.steps.allRaces.desc") },
    { icon: ListChecks, title: t("discover.blocks.ranking.steps.startlists.title"), desc: t("discover.blocks.ranking.steps.startlists.desc") },
    { icon: Target, title: t("discover.blocks.ranking.steps.strategy.title"), desc: t("discover.blocks.ranking.steps.strategy.desc") },
    { icon: CalendarDays, title: t("discover.blocks.ranking.steps.calendar.title"), desc: t("discover.blocks.ranking.steps.calendar.desc") },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-center">
      <motion.div
        className="flex-1"
        initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-secondary leading-[1.05] mb-4">
          {t("discover.blocks.ranking.title")}
        </h2>
        <p className="text-secondary/60 font-inter text-base sm:text-lg leading-relaxed mb-8">
          {t("discover.blocks.ranking.text")}
        </p>
        <StepList steps={steps} />
      </motion.div>

      <motion.div
        className="lg:w-[280px] lg:flex-shrink-0 flex justify-center"
        initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="w-[260px] sm:w-[280px]">
          <PhoneMockup>
            <img
              src="/screenshots/startlist.png"
              alt={t("discover.blocks.ranking.title")}
              className="w-full h-[110%] object-cover object-top"
              loading="lazy"
            />
          </PhoneMockup>
        </div>
      </motion.div>
    </div>
  );
};


const PhoneMockup = ({ children }: { children: React.ReactNode }) => (
  <div className="relative">
    <div className="bg-secondary rounded-[2.5rem] p-2.5 shadow-2xl shadow-secondary/30">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-secondary rounded-b-2xl z-10" />
      <div className="bg-bordure-cream rounded-[2rem] overflow-hidden aspect-[9/19.5] relative">
        {children}
      </div>
    </div>
  </div>
);

/** macOS-style browser frame */
const BrowserMockup = ({ children }: { children: React.ReactNode }) => (
  <div className="relative">
    <div className="bg-secondary rounded-xl shadow-2xl shadow-secondary/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 mx-8">
          <div className="bg-white/10 rounded-md px-3 py-1 text-[10px] text-white/40 font-inter text-center truncate">
            labordure.app
          </div>
        </div>
      </div>
      <div className="overflow-hidden aspect-[16/10] relative">
        {children}
      </div>
    </div>
  </div>
);

export default HowItWorksSection;