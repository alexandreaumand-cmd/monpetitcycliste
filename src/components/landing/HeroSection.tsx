import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import heroPeloton from "@/assets/hero-peloton-aerial.webp";
import heroHandlebar from "@/assets/hero-handlebar.webp";

const HeroSection = () => {
  const { t } = useTranslation("home");
  const isMobile = useIsMobile();
  const sectionRef = useRef<HTMLElement>(null);

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
      style={{ perspective: "1200px" }}
    >
      <motion.div
        className="absolute inset-0 will-change-transform"
        initial={{ scale: 0.6, filter: "blur(4px)" }}
        animate={{ scale: 1.15, filter: "blur(0px)" }}
        transition={{ duration: 3.5, ease: [0.25, 0.1, 0.25, 1] }}
        style={
          isMobile
            ? { transformStyle: "preserve-3d" }
            : { rotateY, rotateX, transformStyle: "preserve-3d" }
        }
      >
        <motion.div
          className="w-full h-full"
          initial={{ scale: 1 }}
          animate={{ scale: 1.05 }}
          transition={{ duration: 20, ease: "linear", repeat: Infinity, repeatType: "reverse", delay: 3.5 }}
        >
          <img
            src={heroPeloton}
            alt="Vue aérienne du peloton cycliste en montagne"
            className="w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            width={1920}
            height={1080}
          />
        </motion.div>

        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 60% 50% at center, transparent 0%, hsla(147,45%,21%,0.4) 50%, hsla(147,45%,21%,0.85) 100%)",
          }}
        />

        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, hsla(147,45%,21%,0.3), transparent, hsla(147,45%,21%,0.9))" }} />
      </motion.div>

      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          backdropFilter: "blur(0px)",
          WebkitBackdropFilter: "blur(0px)",
          maskImage: "radial-gradient(ellipse 55% 45% at center, transparent 0%, black 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 55% 45% at center, transparent 0%, black 100%)",
        }}
      >
        <div className="w-full h-full" style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
      </div>

      {!isMobile && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none flex justify-center"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 2.5, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ height: "28%" }}
        >
          <img
            src={heroHandlebar}
            alt="Guidon drop bar vue POV"
            className="w-full h-full object-cover object-top"
            loading="eager"
            width={1920}
            height={540}
            style={{ mixBlendMode: "screen" }}
          />
        </motion.div>
      )}

      <div className="absolute left-0 top-0 w-16 md:w-24 h-full z-[15] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 speed-line-left opacity-20" />
      </div>

      <div className="absolute right-0 top-0 w-16 md:w-24 h-full z-[15] pointer-events-none overflow-hidden">
        <div className="absolute inset-0 speed-line-right opacity-20" />
      </div>

      <div className="relative z-30 container mx-auto px-4 pt-20 text-center">
        <motion.h1
          className="text-4xl md:text-5xl lg:text-6xl font-montserrat font-bold text-white mb-2"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 3.5, ease: "easeOut" }}
        >
          {t("hero.title1")}
        </motion.h1>

        <motion.h1
          className="text-4xl md:text-5xl lg:text-6xl font-montserrat font-bold text-bordure-gold mb-6"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 3.8, ease: "easeOut" }}
        >
          {t("hero.title2")}
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 font-inter"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 4.1 }}
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 4.4 }}
        >
          <Link to="/auth">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 pulse-energy">
              {t("hero.cta.createLeague")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto text-lg px-8 py-6 border-white text-white hover:bg-white hover:text-secondary"
            onClick={scrollToNextSection}
          >
            {t("hero.cta.discover")}
          </Button>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 z-[25] pointer-events-none" style={{ background: "linear-gradient(to top, hsl(147 45% 21%), transparent)" }} />

      <motion.button
        onClick={scrollToNextSection}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-bounce z-30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 5 }}
      >
        <ChevronDown size={32} />
      </motion.button>
    </section>
  );
};

export default HeroSection;
