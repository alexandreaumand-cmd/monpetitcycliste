import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

/**
 * "Découvre le jeu" — 3 blocks with real app screenshots in iPhone frames
 * Asymmetric editorial layout, alternating text/visual sides
 */
const HowItWorksSection = () => {
  const { t } = useTranslation("home");

  const blocks = [
    {
      title: t("discover.blocks.auction.title"),
      text: t("discover.blocks.auction.text"),
      screenshot: "/screenshots/ranking.png",
    },
    {
      title: t("discover.blocks.team.title"),
      text: t("discover.blocks.team.text"),
      screenshot: "/screenshots/team.png",
    },
    {
      title: t("discover.blocks.ranking.title"),
      text: t("discover.blocks.ranking.text"),
      screenshot: "/screenshots/startlist.png",
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
                    <PhoneMockup>
                      <img
                        src={block.screenshot}
                        alt={block.title}
                        className="w-full h-full object-cover object-top"
                        loading="lazy"
                      />
                    </PhoneMockup>
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

export default HowItWorksSection;
