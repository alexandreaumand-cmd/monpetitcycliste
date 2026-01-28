import { useTranslation } from "react-i18next";
import { Users, Trophy, Timer } from "lucide-react";

const HowItWorksSection = () => {
  const { t } = useTranslation("home");

  const steps = [
    {
      icon: Users,
      title: t("howItWorks.steps.step1.title"),
      description: t("howItWorks.steps.step1.description"),
      number: "1",
    },
    {
      icon: Trophy,
      title: t("howItWorks.steps.step2.title"),
      description: t("howItWorks.steps.step2.description"),
      number: "2",
    },
    {
      icon: Timer,
      title: t("howItWorks.steps.step3.title"),
      description: t("howItWorks.steps.step3.description"),
      number: "3",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("howItWorks.title")}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative text-center p-6 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-yellow-500/50 transition-all duration-300"
            >
              {/* Step number badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#FFD500] rounded-full flex items-center justify-center font-poppins font-bold text-black">
                {step.number}
              </div>

              <div className="mt-4 mb-4 mx-auto w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <step.icon className="w-8 h-8 text-[#FFD500]" />
              </div>

              <h3 className="text-xl font-poppins font-semibold text-white mb-2">
                {step.title}
              </h3>
              <p className="text-gray-400 text-sm">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
