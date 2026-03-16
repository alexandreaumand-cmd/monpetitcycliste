import { useTranslation } from "react-i18next";
import { Flag, Gavel, Radio, Trophy } from "lucide-react";

const HowItWorksSection = () => {
  const { t } = useTranslation("home");

  const steps = [
    { icon: Flag, title: t("howItWorks.steps.step1.title"), description: t("howItWorks.steps.step1.description"), number: "1" },
    { icon: Gavel, title: t("howItWorks.steps.step2.title"), description: t("howItWorks.steps.step2.description"), number: "2" },
    { icon: Radio, title: t("howItWorks.steps.step3.title"), description: t("howItWorks.steps.step3.description"), number: "3" },
    { icon: Trophy, title: t("howItWorks.steps.step4.title"), description: t("howItWorks.steps.step4.description"), number: "4" },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-secondary overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-white mb-4">
            {t("howItWorks.title")}
          </h2>
          <p className="text-white/60 max-w-xl mx-auto font-inter">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="hidden md:flex justify-between items-center mb-4 px-8">
            <span className="text-bordure-gold font-montserrat font-bold text-sm tracking-wider">
              {t("howItWorks.start")}
            </span>
            <span className="text-bordure-gold font-montserrat font-bold text-sm tracking-wider">
              {t("howItWorks.finish")}
            </span>
          </div>

          <div className="hidden md:block absolute top-[140px] left-0 right-0 h-1 bg-white/10">
            <div className="absolute inset-0 bg-gradient-to-r from-bordure-gold via-bordure-pink to-bordure-gold opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-bordure-gold to-transparent animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
            {steps.map((step, index) => (
              <div key={index} className="relative flex flex-col items-center text-center group">
                <div className="hidden md:block absolute top-[68px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-bordure-gold shadow-lg shadow-bordure-gold/50 z-10" />

                <div className="relative w-full p-6 rounded-xl bg-white/5 border border-white/10 hover:border-bordure-gold/50 transition-all duration-300 group-hover:-translate-y-1">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-montserrat font-bold shadow-lg shadow-bordure-gold/30">
                    {step.number}
                  </div>

                  <div className="mt-4 mb-4 mx-auto w-16 h-16 bg-bordure-gold/10 rounded-full flex items-center justify-center group-hover:bg-bordure-gold/20 transition-colors">
                    <step.icon className="w-8 h-8 text-bordure-gold" />
                  </div>

                  <h3 className="text-lg font-montserrat font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-white/50 text-sm font-inter">
                    {step.description}
                  </p>
                </div>

                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-4">
                    <div className="w-0.5 h-8 bg-gradient-to-b from-bordure-gold to-bordure-pink" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
