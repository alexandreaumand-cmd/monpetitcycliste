import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Gavel, Trophy, Target, LayoutGrid, ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Condensed FAQ section linking to the full /rules page.
 * Keeps the brand palette (cream / forest green / gold / pink).
 */
const RulesHighlightsSection = () => {
  const items = [
    {
      icon: Gavel,
      accent: "gold" as const,
      q: "Comment fonctionnent les enchères ?",
      a: "Chaque manager dispose d'un budget identique. Les enchères se déroulent en plusieurs tours : à la clôture, le plus offrant remporte le coureur. En cas d'égalité, tirage au sort. À toi de doser entre favoris et outsiders.",
    },
    {
      icon: LayoutGrid,
      accent: "pink" as const,
      q: "Quels modes de ligue existent ?",
      a: "Deux modes : « 5 Phases » (saison complète, 30 coureurs / 2 200 budget, enchères par phase, variante World Tour uniquement) et « À la course » (sélection libre, budget et effectif s'adaptent automatiquement de 8/650 à 15/1100).",
    },
    {
      icon: Trophy,
      accent: "gold" as const,
      q: "Comment marque-t-on des points ?",
      a: "Tes coureurs marquent à chaque course UCI selon leur classement et la catégorie : 1 600 pts pour la victoire d'un Grand Tour, 1 200 pts pour un Monument, jusqu'à 50 pts sur une .1. Bonus maillots, porteurs, première victoire et scoreurs s'ajoutent.",
    },
    {
      icon: Target,
      accent: "pink" as const,
      q: "À quoi servent les pages Calendrier et Données coureurs ?",
      a: "Le Calendrier liste toutes les courses avec startlists, mouvements détectés et favoris en un clic. Données coureurs te donne accès aux 3 000+ coureurs UCI avec cotes, points, programme et un panneau résultats détaillé. Indispensable avant chaque enchère.",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-bordure-cream">
      <div className="container mx-auto px-5 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 md:mb-14"
        >
          <p className="text-bordure-gold font-inter text-sm tracking-[0.2em] uppercase mb-4 flex items-center gap-3">
            Règles du jeu
            <span className="inline-block w-6 h-0.5 bg-bordure-pink rounded-full" />
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-secondary leading-[1.05] mb-4">
            Tout comprendre en 4 questions.
          </h2>
          <p className="text-secondary/60 font-inter text-base sm:text-lg leading-relaxed max-w-2xl">
            L'essentiel des règles de La Bordure — enchères, modes de ligue, scoring et outils
            d'analyse. Pour le détail complet (barèmes, bonus, FAQ…), rends-toi sur la page règles.
          </p>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {items.map((item, i) => {
            const isPink = item.accent === "pink";
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
              >
                <AccordionItem
                  value={`item-${i}`}
                  className="bg-white rounded-xl border border-black/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline text-left">
                    <span className="flex items-center gap-3 flex-1">
                      <span
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isPink ? "bg-bordure-pink/10" : "bg-bordure-gold/10"
                        }`}
                      >
                        <item.icon
                          className={`w-4 h-4 ${isPink ? "text-bordure-pink" : "text-bordure-gold"}`}
                        />
                      </span>
                      <span className="font-montserrat font-bold text-secondary text-sm sm:text-base">
                        {item.q}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4 pl-[68px] text-secondary/70 font-inter text-sm leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            );
          })}
        </Accordion>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-center"
        >
          <Link
            to="/rules"
            className="inline-flex items-center gap-2 text-secondary font-montserrat font-semibold text-sm hover:text-bordure-gold transition-colors group"
          >
            Voir toutes les règles
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default RulesHighlightsSection;
