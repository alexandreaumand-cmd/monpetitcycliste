import StaticPageLayout from "@/components/layout/StaticPageLayout";
import BordureStripes from "@/components/landing/BordureStripes";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Trophy,
  Gavel,
  Target,
  Gift,
  BarChart3,
  Calendar,
  Shirt,
  Medal,
} from "lucide-react";

/* ──────────── helpers ──────────── */

const SectionCard = ({
  icon: Icon,
  num,
  title,
  children,
}: {
  icon: React.ElementType;
  num: string;
  title: string;
  children: React.ReactNode;
}) => {
  const numInt = parseInt(num);
  const accentColor = numInt % 2 === 0 ? "text-bordure-pink" : "text-bordure-gold";

  return (
    <div className="bg-white rounded-xl p-6 md:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-black/[0.04]">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-bordure-green/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-bordure-green" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-montserrat font-bold text-xl ${accentColor}`}>
            {num}.
          </span>
          <h2 className="text-bordure-green font-montserrat font-bold text-xl">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </div>
  );
};

const PointsTable = ({
  rows,
  headers = ["Place", "Points"],
}: {
  rows: [string, string | number][];
  headers?: [string, string];
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-bordure-green/10">
          <th className="text-left py-2 px-3 font-montserrat font-semibold text-bordure-green text-xs uppercase tracking-wider">
            {headers[0]}
          </th>
          <th className="text-right py-2 px-3 font-montserrat font-semibold text-bordure-green text-xs uppercase tracking-wider">
            {headers[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([place, pts], i) => (
          <tr
            key={place}
            className={i % 2 === 0 ? "bg-bordure-cream/50" : "bg-white"}
          >
            <td className="py-1.5 px-3 font-inter text-bordure-green/80">
              {place}
            </td>
            <td className="py-1.5 px-3 text-right font-montserrat font-semibold text-bordure-green">
              {pts}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ──────────── data ──────────── */

const monumentsGC: [string, number][] = [
  ["1er", 1200], ["2e", 960], ["3e", 780], ["4e", 600], ["5e", 450],
  ["6e", 360], ["7e", 300], ["8e", 250], ["9e", 215], ["10e", 180],
  ["11e", 150], ["12e", 120], ["13e", 90], ["14e", 75], ["15e", 60],
];

const classiquesWTCat1: [string, number][] = [
  ["1er", 800], ["2e", 640], ["3e", 520], ["4e", 400], ["5e", 300],
  ["6e", 240], ["7e", 200], ["8e", 170], ["9e", 145], ["10e", 120],
  ["11e", 100], ["12e", 80], ["13e", 60], ["14e", 50], ["15e", 40],
];

const classiquesWTCat2: [string, number][] = [
  ["1er", 550], ["2e", 440], ["3e", 360], ["4e", 275], ["5e", 205],
  ["6e", 165], ["7e", 140], ["8e", 115], ["9e", 100], ["10e", 80],
  ["11e", 70], ["12e", 55], ["13e", 40], ["14e", 35], ["15e", 30],
];

const classiquesWTCat3: [string, number][] = [
  ["1er", 350], ["2e", 280], ["3e", 230], ["4e", 175], ["5e", 130],
  ["6e", 105], ["7e", 90], ["8e", 75], ["9e", 60], ["10e", 50],
  ["11e", 45], ["12e", 35], ["13e", 25], ["14e", 20], ["15e", 15],
];

const gtGC: [string, number][] = [
  ["1er", 1600], ["2e", 1280], ["3e", 1040], ["4e", 800], ["5e", 600],
  ["6e", 480], ["7e", 400], ["8e", 340], ["9e", 290], ["10e", 240],
  ["11e", 200], ["12e", 160], ["13e", 120], ["14e", 95], ["15e", 80],
];

const gtEtape: [string, number][] = [
  ["1er", 300], ["2e", 240], ["3e", 195], ["4e", 150], ["5e", 120],
  ["6e", 90], ["7e", 60], ["8e", 45], ["9e", 35], ["10e", 30],
];

const toursWTCat1GC: [string, number][] = [
  ["1er", 800], ["2e", 640], ["3e", 520], ["4e", 400], ["5e", 300],
  ["6e", 240], ["7e", 200], ["8e", 170], ["9e", 145], ["10e", 120],
  ["11e", 100], ["12e", 80], ["13e", 60], ["14e", 50], ["15e", 40],
];

const toursWTCat1Etape: [string, number][] = [
  ["1er", 250], ["2e", 200], ["3e", 165], ["4e", 125], ["5e", 100],
  ["6e", 75], ["7e", 50], ["8e", 40], ["9e", 30], ["10e", 25],
];

const wcRR: [string, number][] = [
  ["1er", 1200], ["2e", 960], ["3e", 780], ["4e", 600], ["5e", 450],
  ["6e", 360], ["7e", 300], ["8e", 250], ["9e", 215], ["10e", 180],
  ["11e", 150], ["12e", 120], ["13e", 90], ["14e", 75], ["15e", 60],
];

const wcITT: [string, number][] = [
  ["1er", 400], ["2e", 320], ["3e", 260], ["4e", 200], ["5e", 150],
  ["6e", 120], ["7e", 100], ["8e", 85], ["9e", 70], ["10e", 60],
  ["11e", 50], ["12e", 40], ["13e", 30], ["14e", 25], ["15e", 20],
];

const proOneDayGC: [string, number][] = [
  ["1er", 150], ["2e", 125], ["3e", 100], ["4e", 75], ["5e", 60],
  ["6e", 45], ["7e", 30], ["8e", 20], ["9e", 15], ["10e", 10],
];

/* ──────────── page ──────────── */

const RulesPage = () => {
  return (
    <StaticPageLayout>
      <article className="max-w-none">
        <h1 className="text-bordure-green font-montserrat text-3xl md:text-4xl font-bold mb-3">
          Règles du jeu
        </h1>
        <p className="text-bordure-green/60 font-inter text-base mb-8">
          Tout ce qu'il faut savoir pour dominer ta ligue.
        </p>

        <div className="space-y-6">
          {/* ── 1. Principe général ── */}
          <SectionCard icon={Trophy} num="1" title="Principe général">
            <p className="text-bordure-green/80 font-inter leading-relaxed">
              Chaque manager dispose d'un budget fictif identique pour recruter des coureurs
              professionnels via un système d'enchères. Les coureurs recrutés marquent des points
              en fonction de leurs résultats dans les courses UCI réelles tout au long de la saison.
              Le manager qui cumule le plus de points remporte la ligue.
            </p>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 2. Les enchères ── */}
          <SectionCard icon={Gavel} num="2" title="Les enchères">
            <ul className="space-y-4 text-bordure-green/80 font-inter">
              <li className="flex items-start gap-3">
                <span className="text-bordure-gold font-bold font-montserrat shrink-0 mt-0.5">A.</span>
                <span>
                  <strong className="text-bordure-green">Budget fixe</strong> — Chaque manager
                  reçoit un budget identique en début de saison. Impossible de le dépasser : chaque
                  mise est définitivement déduite.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-bordure-gold font-bold font-montserrat shrink-0 mt-0.5">B.</span>
                <span>
                  <strong className="text-bordure-green">Tours successifs</strong> — Les enchères se
                  déroulent en plusieurs tours, chacun avec une deadline. À chaque tour, tu peux miser
                  sur les coureurs disponibles.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-bordure-gold font-bold font-montserrat shrink-0 mt-0.5">C.</span>
                <span>
                  <strong className="text-bordure-green">Départage au tirage au sort</strong> — À la
                  clôture du tour, le manager ayant misé le plus remporte le coureur. En cas d'égalité,
                  un tirage au sort désigne le vainqueur.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-bordure-gold font-bold font-montserrat shrink-0 mt-0.5">D.</span>
                <span>
                  <strong className="text-bordure-green">Stratégie budgétaire</strong> — Ton budget
                  est limité. À toi de choisir entre miser gros sur les favoris ou répartir ton budget
                  sur des outsiders à fort potentiel.
                </span>
              </li>
            </ul>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 3. Le scoring ── */}
          <SectionCard icon={Target} num="3" title="Le scoring">
            <p className="text-bordure-green/80 font-inter leading-relaxed mb-5">
              Les coureurs marquent des points sur chaque course en fonction de leur classement
              d'arrivée et de la catégorie de la course. Plus la course est prestigieuse, plus
              les points sont élevés.
            </p>

            {/* Courses d'un jour */}
            <div className="mb-4">
              <h3 className="font-montserrat font-semibold text-bordure-green flex items-center gap-2 mb-3">
                <Medal className="w-4 h-4 text-bordure-gold" />
                Courses d'un jour (Classiques)
              </h3>
              <p className="text-bordure-green/70 font-inter text-sm mb-3">
                Points attribués au classement d'arrivée uniquement (top 15).
              </p>
              <Accordion type="multiple" className="space-y-2">
                <AccordionItem value="monuments" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🏔️ Monuments (1er : 1 200 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <p className="text-xs text-bordure-green/60 font-inter mb-2">
                      Milan-San Remo, Tour des Flandres, Paris-Roubaix, Liège-Bastogne-Liège, Tour de Lombardie
                    </p>
                    <PointsTable rows={monumentsGC} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="classiques-cat1" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    ⭐ Classiques WT Cat. 1 (1er : 800 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <PointsTable rows={classiquesWTCat1} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="classiques-cat2" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Classiques WT Cat. 2 (1er : 550 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <PointsTable rows={classiquesWTCat2} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="classiques-cat3" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Classiques WT Cat. 3 (1er : 350 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <PointsTable rows={classiquesWTCat3} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="pro-1day" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Courses .Pro &amp; .1 (1er : 150 / 100 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <p className="text-xs text-bordure-green/60 font-inter mb-2">Barème .Pro (top 10) :</p>
                    <PointsTable rows={proOneDayGC} />
                    <p className="text-xs text-bordure-green/60 font-inter mt-3 mb-2">
                      Barème .1 : 100, 80, 65, 50, 40, 30, 20, 15, 10, 5
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Courses par étapes */}
            <div className="mb-4 mt-6">
              <h3 className="font-montserrat font-semibold text-bordure-green flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-bordure-pink" />
                Courses par étapes (Tours)
              </h3>
              <p className="text-bordure-green/70 font-inter text-sm mb-3">
                Points cumulés : classement général final (top 15) + classement d'étape (top 10) + maillots distinctifs.
              </p>
              <Accordion type="multiple" className="space-y-2">
                <AccordionItem value="gt" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🟡 Grands Tours — Tour de France, Giro, Vuelta
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 space-y-4">
                    <div>
                      <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1">Classement général final (top 15)</p>
                      <PointsTable rows={gtGC} />
                    </div>
                    <div>
                      <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1">Classement d'étape (top 10)</p>
                      <PointsTable rows={gtEtape} />
                    </div>
                    <div>
                      <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1">Maillots distinctifs</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-bordure-green/10">
                              <th className="text-left py-2 px-3 font-montserrat font-semibold text-bordure-green text-xs uppercase tracking-wider">Maillot</th>
                              <th className="text-right py-2 px-3 font-montserrat font-semibold text-bordure-green text-xs uppercase tracking-wider">Points (top 5 à 10)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["🟢 Vert (Points)", "300 → 40 pts (top 10)"],
                              ["🔴 Montagne (GPM)", "300 → 125 pts (top 5)"],
                              ["⚪ Jeune", "150 → 50 pts (top 3)"],
                              ["🔥 Super Combatif", "150 pts (1er uniquement)"],
                            ].map(([m, pts], i) => (
                              <tr key={m} className={i % 2 === 0 ? "bg-bordure-cream/50" : "bg-white"}>
                                <td className="py-1.5 px-3 font-inter text-bordure-green/80">{m}</td>
                                <td className="py-1.5 px-3 text-right font-montserrat font-semibold text-bordure-green text-xs">{pts}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-cat1" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours WT Cat. 1 (GC 1er : 800 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 space-y-4">
                    <div>
                      <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1">Classement général (top 15)</p>
                      <PointsTable rows={toursWTCat1GC} />
                    </div>
                    <div>
                      <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1">Classement d'étape (top 10)</p>
                      <PointsTable rows={toursWTCat1Etape} />
                    </div>
                    <p className="text-xs text-bordure-green/60 font-inter">
                      + Maillots : Vert 150 pts, Montagne 150 pts, Jeune 100 pts (1er uniquement).
                    </p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-cat2" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours WT Cat. 2 (GC 1er : 550 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <p className="text-xs text-bordure-green/60 font-inter mb-2">
                      GC top 15 : 550, 440, 360, 275, 205, 165, 140, 115, 100, 80, 70, 55, 40, 35, 30
                    </p>
                    <p className="text-xs text-bordure-green/60 font-inter">
                      Étape top 10 : 220, 175, 145, 115, 90, 70, 45, 35, 25, 20 — Maillots : Vert 120, Montagne 120, Jeune 75 pts.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-cat3" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours WT Cat. 3 (GC 1er : 350 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <p className="text-xs text-bordure-green/60 font-inter mb-2">
                      GC top 15 : 350, 280, 230, 175, 130, 105, 90, 75, 60, 50, 45, 35, 25, 20, 15
                    </p>
                    <p className="text-xs text-bordure-green/60 font-inter">
                      Étape top 10 : 180, 150, 120, 90, 75, 60, 40, 30, 20, 15 — Maillots : Vert 80, Montagne 80, Jeune 50 pts.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-pro" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours .Pro &amp; .1
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <p className="text-xs text-bordure-green/60 font-inter mb-2">
                      <strong>.Pro</strong> — GC top 10 : 250, 200, 150, 120, 100, 85, 70, 60, 50, 40 | Étape top 10 : 150 → 10 | Maillots : Vert 50, Montagne 50, Jeune 30
                    </p>
                    <p className="text-xs text-bordure-green/60 font-inter">
                      <strong>.1</strong> — GC top 10 : 200, 150, 100, 90, 80, 70, 60, 50, 40, 30 | Étape top 10 : 100 → 5 | Maillots : Vert 25, Montagne 25, Jeune 15
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Championnats */}
            <div className="mt-6">
              <h3 className="font-montserrat font-semibold text-bordure-green flex items-center gap-2 mb-3">
                <Shirt className="w-4 h-4 text-bordure-green" />
                Championnats du Monde &amp; d'Europe
              </h3>
              <Accordion type="multiple" className="space-y-2">
                <AccordionItem value="wc-rr" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🌈 Championnat du Monde — Route (1er : 1 200 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <PointsTable rows={wcRR} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="wc-itt" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🌈 Championnat du Monde — CLM (1er : 400 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <PointsTable rows={wcITT} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="ec" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🇪🇺 Championnat d'Europe — Route &amp; CLM
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <p className="text-xs text-bordure-green/60 font-inter mb-2">
                      <strong>Route</strong> — top 15 : 400, 320, 260, 200, 150, 120, 100, 85, 70, 60, 50, 40, 30, 25, 20
                    </p>
                    <p className="text-xs text-bordure-green/60 font-inter">
                      <strong>CLM</strong> — top 15 : 200, 160, 130, 100, 75, 60, 50, 45, 35, 30, 25, 20, 15, 12.5, 10
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 4. Les bonus ── */}
          <SectionCard icon={Gift} num="4" title="Les bonus">
            <div className="space-y-5">
              <div>
                <h3 className="font-montserrat font-semibold text-bordure-green text-sm mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bordure-gold/20 text-bordure-gold text-xs font-bold">C</span>
                  Bonus Coureur — Première victoire (+25%)
                </h3>
                <p className="text-bordure-green/80 font-inter text-sm leading-relaxed">
                  Lorsqu'un coureur de ton effectif remporte sa <strong>première victoire de la saison</strong> (classement
                  d'arrivée ou CLM individuel), il reçoit un bonus de <strong>+25%</strong> des points de cette victoire.
                  Ce bonus ne s'applique qu'une seule fois par coureur et par saison.
                </p>
              </div>
              <div>
                <h3 className="font-montserrat font-semibold text-bordure-green text-sm mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bordure-pink/20 text-bordure-pink text-xs font-bold">M</span>
                  Bonus Manager
                </h3>
                <ul className="space-y-2 text-bordure-green/80 font-inter text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-bordure-pink font-bold">•</span>
                    <span>
                      <strong>CLM par équipe (TTT)</strong> — Si l'équipe professionnelle d'un de tes coureurs
                      remporte un CLM par équipe, des points bonus sont attribués à ton manager.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-bordure-pink font-bold">•</span>
                    <span>
                      <strong>Nombre de scoreurs</strong> — Bonus basé sur le nombre de coureurs de ton effectif
                      ayant marqué au moins 1 point (hors TTT) sur la saison. Plus ton équipe est diversifiée,
                      plus tu es récompensé.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 5. Le classement ── */}
          <SectionCard icon={BarChart3} num="5" title="Le classement">
            <p className="text-bordure-green/80 font-inter leading-relaxed">
              Un seul classement fait foi : le <strong>classement général</strong>. Il cumule l'ensemble
              des points marqués par tous tes coureurs sur la saison entière. Pas de reset hebdomadaire,
              pas de phases — la constance et la profondeur d'effectif sont récompensées du premier
              jour au dernier.
            </p>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 6. Courses prises en compte ── */}
          <SectionCard icon={Calendar} num="6" title="Courses prises en compte">
            <p className="text-bordure-green/80 font-inter leading-relaxed mb-4">
              Toutes les courses du calendrier UCI professionnel sont intégrées :
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                "Grands Tours",
                "Monuments",
                "Classiques WT",
                "Tours WT",
                "ProSeries (.Pro)",
                "Courses .1",
                "Championnats du Monde",
                "Championnats d'Europe",
              ].map((cat) => (
                <div
                  key={cat}
                  className="bg-bordure-cream/70 rounded-lg px-3 py-2 text-center font-inter text-sm text-bordure-green/80 border border-bordure-green/5"
                >
                  {cat}
                </div>
              ))}
            </div>
            <p className="text-bordure-green/60 font-inter text-sm mt-4 italic">
              De Paris-Roubaix au Tour de France, en passant par le Tour de Turquie — chaque course compte.
            </p>
          </SectionCard>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Link to="/auth">
            <Button className="bg-bordure-gold hover:bg-bordure-gold/90 text-bordure-green font-montserrat font-bold px-8 py-3">
              Rejoindre La Bordure
            </Button>
          </Link>
        </div>
      </article>
    </StaticPageLayout>
  );
};

export default RulesPage;
