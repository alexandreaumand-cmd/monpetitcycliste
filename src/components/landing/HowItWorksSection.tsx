import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Flag, Gavel, Radio, Trophy } from "lucide-react";
import { motion } from "framer-motion";

const HowItWorksSection = () => {
  const { t } = useTranslation("home");

  const steps = [
    { icon: Flag, title: t("howItWorks.steps.step1.title"), description: t("howItWorks.steps.step1.description"), number: "1" },
    { icon: Gavel, title: t("howItWorks.steps.step2.title"), description: t("howItWorks.steps.step2.description"), number: "2" },
    { icon: Radio, title: t("howItWorks.steps.step3.title"), description: t("howItWorks.steps.step3.description"), number: "3" },
    { icon: Trophy, title: t("howItWorks.steps.step4.title"), description: t("howItWorks.steps.step4.description"), number: "4" },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-bordure-cream">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-secondary mb-3" style={{ textWrap: "balance" } as React.CSSProperties}>
            {t("howItWorks.title")}
          </h2>
          <p className="text-secondary/60 max-w-md mx-auto font-inter">
            {t("howItWorks.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="relative flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative w-full p-6 rounded-2xl bg-white border border-secondary/8 shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-montserrat font-bold text-sm shadow-md">
                  {step.number}
                </div>

                <div className="mt-3 mb-4 mx-auto w-14 h-14 bg-secondary/5 rounded-xl flex items-center justify-center">
                  <step.icon className="w-7 h-7 text-secondary" />
                </div>

                <h3 className="text-base font-montserrat font-semibold text-secondary mb-1.5">
                  {step.title}
                </h3>
                <p className="text-secondary/50 text-sm font-inter leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link to="/auth">
            <Button size="lg" className="text-base px-8 py-6">
              {t("howItWorks.cta")}
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
