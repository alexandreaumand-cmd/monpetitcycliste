import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";

const WhyPlaySection = () => {
  const { t } = useTranslation("home");
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const stats = [
    { value: 350, suffix: "+", label: t("stats.courses") },
    { value: 50, suffix: "+", label: t("stats.leagues") },
    { value: 1000, suffix: "+", label: t("stats.riders") },
    { value: 21, suffix: "", label: t("stats.stages") },
  ];

  const features = [
    t("stats.features.uci"),
    t("stats.features.auctions"),
    t("stats.features.private"),
    t("stats.features.jerseys"),
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("stats.title")}
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-16">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center p-6 rounded-xl bg-gray-900/30 border border-gray-800"
            >
              <div className="text-4xl md:text-5xl font-poppins font-bold text-[#FFD500] mb-2">
                <AnimatedCounter 
                  value={stat.value} 
                  suffix={stat.suffix} 
                  isVisible={isVisible}
                  delay={index * 100}
                />
              </div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="max-w-xl mx-auto border-t border-gray-800 mb-12" />

        {/* Features Checklist */}
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-lg bg-gray-900/30 hover:bg-gray-900/50 transition-colors"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFD500]/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-[#FFD500]" />
                </div>
                <span className="text-gray-300 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// Animated counter component
const AnimatedCounter = ({ 
  value, 
  suffix, 
  isVisible,
  delay = 0
}: { 
  value: number; 
  suffix: string; 
  isVisible: boolean;
  delay?: number;
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      const duration = 1500;
      const steps = 30;
      const increment = value / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, value, delay]);

  return <>{count}{suffix}</>;
};

export default WhyPlaySection;
