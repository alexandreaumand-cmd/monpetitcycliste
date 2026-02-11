import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import heroPeloton from "@/assets/hero-peloton-pov.jpg";

const HeroSection = () => {
  const { t } = useTranslation("home");
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);

  // Mouse tilt effect (desktop only)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-3, 3]), { stiffness: 100, damping: 30 });
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [1.5, -1.5]), { stiffness: 100, damping: 30 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isMobile || !sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [isMobile, mouseX, mouseY]
  );

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || isMobile) return;
    el.addEventListener("mousemove", handleMouseMove);
    return () => el.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove, isMobile]);

  const scrollToNextSection = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ perspective: "1000px" }}
    >
      {/* Background Layer with zoom + tilt */}
      <motion.div
        className="absolute inset-0 will-change-transform"
        initial={{ scale: 1.3, filter: "blur(8px)" }}
        animate={{ scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 2, ease: [0.25, 0.1, 0.25, 1] }}
        style={
          isMobile
            ? { transformStyle: "preserve-3d" }
            : { rotateY, rotateX, transformStyle: "preserve-3d" }
        }
      >
        <img
          src={heroPeloton}
          alt="Vue POV depuis le peloton cycliste"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black" />
      </motion.div>

      {/* Speed Lines Left */}
      <div className="absolute left-0 top-0 w-16 md:w-24 h-full z-[5] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 speed-line-left opacity-20" />
      </div>

      {/* Speed Lines Right */}
      <div className="absolute right-0 top-0 w-16 md:w-24 h-full z-[5] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 speed-line-right opacity-20" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-20 text-center">
        <motion.h1
          className="text-4xl md:text-5xl lg:text-6xl font-poppins font-bold text-white mb-2"
          initial={{ x: -60, opacity: 0, filter: "blur(10px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        >
          {t("hero.title1")}
        </motion.h1>

        <motion.h1
          className="text-4xl md:text-5xl lg:text-6xl font-poppins font-bold text-[#FFD500] mb-6"
          initial={{ x: 60, opacity: 0, filter: "blur(10px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
        >
          {t("hero.title2")}
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        >
          <Link to="/auth">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 pulse-energy">
              {t("hero.cta.createLeague")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-lg px-8 py-6 border-white text-white hover:bg-white hover:text-black"
            onClick={scrollToNextSection}
          >
            {t("hero.cta.discover")}
          </Button>
        </motion.div>
      </div>

      {/* Bottom gradient mask for seamless transition */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent z-[6] pointer-events-none" />

      {/* Scroll indicator */}
      <button
        onClick={scrollToNextSection}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-bounce z-10"
      >
        <ChevronDown size={32} />
      </button>
    </section>
  );
};

export default HeroSection;
