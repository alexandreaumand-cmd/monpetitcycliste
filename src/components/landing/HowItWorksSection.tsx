import { useTranslation } from "react-i18next";
import { Flag, Gavel, Radio, Trophy } from "lucide-react";

const HowItWorksSection = () => {
  const { t } = useTranslation("home");

  const steps = [
    {
      icon: Flag,
      title: t("howItWorks.steps.step1.title"),
      description: t("howItWorks.steps.step1.description"),
      number: "1",
    },
    {
      icon: Gavel,
      title: t("howItWorks.steps.step2.title"),
      description: t("howItWorks.steps.step2.description"),
      number: "2",
    },
    {
      icon: Radio,
      title: t("howItWorks.steps.step3.title"),
      description: t("howItWorks.steps.step3.description"),
      number: "3",
    },
    {
      icon: Trophy,
      title: t("howItWorks.steps.step4.title"),
      description: t("howItWorks.steps.step4.description"),
      number: "4",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-black overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("howItWorks.title")}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        {/* Race track visual */}
        <div className="relative max-w-5xl mx-auto">
          {/* Start/Finish labels */}
          <div className="hidden md:flex justify-between items-center mb-4 px-8">
            <span className="text-[#FFD500] font-poppins font-bold text-sm tracking-wider">
              {t("howItWorks.start")}
            </span>
            <span className="text-[#FFD500] font-poppins font-bold text-sm tracking-wider">
              {t("howItWorks.finish")}
            </span>
          </div>

          {/* Progress line - Desktop */}
          <div className="hidden md:block absolute top-[140px] left-0 right-0 h-1 bg-gray-800">
            <div className="absolute inset-0 bg-gradient-to-r from-[#FFD500] via-yellow-500 to-[#FFD500] opacity-60" />
            {/* Animated glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFD500] to-transparent animate-pulse" />
          </div>

          {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Connector dot on the line - Desktop */}
                <div className="hidden md:block absolute top-[68px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FFD500] shadow-lg shadow-yellow-500/50 z-10" />

                {/* Card */}
                <div className="relative w-full p-6 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-yellow-500/50 transition-all duration-300 group-hover:-translate-y-1">
                  {/* Step number badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#FFD500] rounded-full flex items-center justify-center font-poppins font-bold text-black shadow-lg shadow-yellow-500/30">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="mt-4 mb-4 mx-auto w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                    <step.icon className="w-8 h-8 text-[#FFD500]" />
                  </div>

                  <h3 className="text-lg font-poppins font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {step.description}
                  </p>
                </div>

                {/* Arrow connector - Mobile */}
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-4">
                    <div className="w-0.5 h-8 bg-gradient-to-b from-[#FFD500] to-yellow-600" />
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
