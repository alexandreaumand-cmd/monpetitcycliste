import StaticPageLayout from "@/components/layout/StaticPageLayout";
import { PageSeo } from "@/components/seo/PageSeo";
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
  Users,
  Flag,
  Star,
  Database,
  Compass,
  Bell,
  Menu,
  Home,
  MessageCircle,
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

/** Compact grid of place → points (like PointsBaremeSection) */
const CompactBareme = ({
  label,
  rows,
}: {
  label: string;
  rows: [number, number][];
}) => (
  <div>
    <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1.5">
      {label}
    </p>
    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1">
      {rows.map(([place, pts]) => (
        <div
          key={`${place}-${pts}`}
          className="flex flex-col items-center p-1.5 rounded bg-bordure-cream/50 border border-bordure-green/5 text-center"
        >
          <span className="text-xs text-bordure-green/50">
            {place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : `${place}e`}
          </span>
          <span className="font-montserrat font-bold text-sm text-bordure-green">{pts}</span>
        </div>
      ))}
    </div>
  </div>
);

/** Single-line porteur display */
const PorteurLine = ({ items }: { items: { label: string; pts: number; unit?: string }[] }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
    {items.map((item) => (
      <div
        key={item.label}
        className="flex flex-col items-center p-2 rounded bg-bordure-cream/50 border border-bordure-green/5 text-center"
      >
        <span className="text-[10px] text-bordure-green/50 font-inter leading-tight">{item.label}</span>
        <span className="font-montserrat font-bold text-sm text-bordure-green">
          {item.pts} <span className="text-[10px] font-normal text-bordure-green/50">{item.unit || "pts/j"}</span>
        </span>
      </div>
    ))}
  </div>
);

/* ──────────── data (saison 2026) ──────────── */

// Courses d'un jour
const monumentsGC: [number, number][] = [
  [1, 1200], [2, 960], [3, 780], [4, 600], [5, 450],
  [6, 360], [7, 300], [8, 250], [9, 215], [10, 180],
  [11, 150], [12, 120], [13, 90], [14, 75], [15, 60],
];
const classiquesWTCat1: [number, number][] = [
  [1, 800], [2, 640], [3, 520], [4, 400], [5, 300],
  [6, 240], [7, 200], [8, 170], [9, 145], [10, 120],
  [11, 100], [12, 80], [13, 60], [14, 50], [15, 40],
];
const classiquesWTCat2: [number, number][] = [
  [1, 550], [2, 440], [3, 360], [4, 275], [5, 205],
  [6, 165], [7, 140], [8, 115], [9, 100], [10, 80],
  [11, 70], [12, 55], [13, 40], [14, 35], [15, 30],
];
const classiquesWTCat3: [number, number][] = [
  [1, 350], [2, 280], [3, 230], [4, 175], [5, 130],
  [6, 105], [7, 90], [8, 75], [9, 60], [10, 50],
  [11, 45], [12, 35], [13, 25], [14, 20], [15, 15],
];
const proOneDayGC: [number, number][] = [
  [1, 150], [2, 125], [3, 100], [4, 75], [5, 60],
  [6, 45], [7, 30], [8, 20], [9, 15], [10, 10],
];
const oneOneDayGC: [number, number][] = [
  [1, 100], [2, 80], [3, 65], [4, 50], [5, 40],
  [6, 30], [7, 20], [8, 15], [9, 10], [10, 5],
];

// Grands Tours (WT GT)
const gtGC: [number, number][] = [
  [1, 1600], [2, 1280], [3, 1040], [4, 800], [5, 600],
  [6, 480], [7, 400], [8, 340], [9, 290], [10, 240],
  [11, 200], [12, 160], [13, 120], [14, 95], [15, 80],
];
const gtEtape: [number, number][] = [
  [1, 300], [2, 240], [3, 195], [4, 150], [5, 120],
  [6, 90], [7, 60], [8, 45], [9, 35], [10, 30],
];
const gtMaillotsFinaux: { label: string; pts: number }[] = [
  { label: "🟢 Vert (Points)", pts: 300 },
  { label: "🔴 Montagne (GPM)", pts: 300 },
  { label: "⚪ Jeune", pts: 150 },
  { label: "🔥 Combatif", pts: 150 },
];
// Barèmes détaillés des classements finaux des maillots (Grands Tours)
const gtMaillotVert: [number, number][] = [
  [1, 300], [2, 240], [3, 195], [4, 150], [5, 120],
  [6, 90], [7, 60], [8, 45], [9, 35], [10, 30],
];
const gtMaillotGPM: [number, number][] = [
  [1, 300], [2, 240], [3, 195], [4, 150], [5, 120],
];
const gtMaillotJeune: [number, number][] = [
  [1, 150], [2, 120], [3, 95],
];
const gtMaillotCombatif: [number, number][] = [
  [1, 150],
];
const gtPorteurs: { label: string; pts: number }[] = [
  { label: "Porteur Leader", pts: 20 },
  { label: "Porteur Vert", pts: 12 },
  { label: "Porteur Montagne", pts: 12 },
  { label: "Porteur Jeune", pts: 6 },
  { label: "Porteur Combattif", pts: 12 },
];

// Tours WT Cat 1
const twc1GC: [number, number][] = [
  [1, 800], [2, 640], [3, 520], [4, 400], [5, 300],
  [6, 240], [7, 200], [8, 170], [9, 145], [10, 120],
  [11, 100], [12, 80], [13, 60], [14, 50], [15, 40],
];
const twc1Etape: [number, number][] = [
  [1, 250], [2, 200], [3, 165], [4, 125], [5, 100],
  [6, 75], [7, 50], [8, 40], [9, 30], [10, 25],
];
const twc1Maillots: { label: string; pts: number }[] = [
  { label: "🟢 Vert", pts: 150 },
  { label: "🔴 Montagne", pts: 150 },
  { label: "⚪ Jeune", pts: 100 },
];
const twc1Porteurs: { label: string; pts: number }[] = [
  { label: "Porteur Leader", pts: 10 },
  { label: "Porteur Vert", pts: 8 },
  { label: "Porteur Montagne", pts: 8 },
  { label: "Porteur Jeune", pts: 4 },
];

// Tours WT Cat 2
const twc2GC: [number, number][] = [
  [1, 550], [2, 440], [3, 360], [4, 275], [5, 205],
  [6, 165], [7, 140], [8, 115], [9, 100], [10, 80],
  [11, 70], [12, 55], [13, 40], [14, 35], [15, 30],
];
const twc2Etape: [number, number][] = [
  [1, 220], [2, 175], [3, 145], [4, 115], [5, 90],
  [6, 70], [7, 45], [8, 35], [9, 25], [10, 20],
];
const twc2Maillots: { label: string; pts: number }[] = [
  { label: "🟢 Vert", pts: 120 },
  { label: "🔴 Montagne", pts: 120 },
  { label: "⚪ Jeune", pts: 75 },
];
const twc2Porteurs: { label: string; pts: number }[] = [
  { label: "Porteur Leader", pts: 8 },
  { label: "Porteur Vert", pts: 6 },
  { label: "Porteur Montagne", pts: 6 },
  { label: "Porteur Jeune", pts: 3 },
];

// Tours WT Cat 3
const twc3GC: [number, number][] = [
  [1, 350], [2, 280], [3, 230], [4, 175], [5, 130],
  [6, 105], [7, 90], [8, 75], [9, 60], [10, 50],
  [11, 45], [12, 35], [13, 25], [14, 20], [15, 15],
];
const twc3Etape: [number, number][] = [
  [1, 180], [2, 150], [3, 120], [4, 90], [5, 75],
  [6, 60], [7, 40], [8, 30], [9, 20], [10, 15],
];
const twc3Maillots: { label: string; pts: number }[] = [
  { label: "🟢 Vert", pts: 80 },
  { label: "🔴 Montagne", pts: 80 },
  { label: "⚪ Jeune", pts: 50 },
];
const twc3Porteurs: { label: string; pts: number }[] = [
  { label: "Porteur Leader", pts: 6 },
  { label: "Porteur Vert", pts: 5 },
  { label: "Porteur Montagne", pts: 5 },
  { label: "Porteur Jeune", pts: 2 },
];

// Tours .Pro (2.pro)
const proTourGC: [number, number][] = [
  [1, 250], [2, 200], [3, 150], [4, 120], [5, 100],
  [6, 85], [7, 70], [8, 60], [9, 50], [10, 40],
];
const proTourEtape: [number, number][] = [
  [1, 150], [2, 125], [3, 100], [4, 75], [5, 60],
  [6, 45], [7, 30], [8, 20], [9, 15], [10, 10],
];
const proTourMaillots: { label: string; pts: number }[] = [
  { label: "🟢 Vert", pts: 50 },
  { label: "🔴 Montagne", pts: 50 },
  { label: "⚪ Jeune", pts: 30 },
];
const proTourPorteurs: { label: string; pts: number }[] = [
  { label: "Porteur Leader", pts: 6 },
  { label: "Porteur Vert", pts: 4 },
  { label: "Porteur Montagne", pts: 4 },
  { label: "Porteur Jeune", pts: 2 },
];

// Tours .1 (2.1)
const oneTourGC: [number, number][] = [
  [1, 200], [2, 150], [3, 100], [4, 90], [5, 80],
  [6, 70], [7, 60], [8, 50], [9, 40], [10, 30],
];
const oneTourEtape: [number, number][] = [
  [1, 100], [2, 80], [3, 65], [4, 50], [5, 40],
  [6, 30], [7, 20], [8, 15], [9, 10], [10, 5],
];
const oneTourMaillots: { label: string; pts: number }[] = [
  { label: "🟢 Vert", pts: 25 },
  { label: "🔴 Montagne", pts: 25 },
  { label: "⚪ Jeune", pts: 15 },
];
const oneTourPorteurs: { label: string; pts: number }[] = [
  { label: "Porteur Leader", pts: 5 },
  { label: "Porteur Vert", pts: 3 },
  { label: "Porteur Montagne", pts: 3 },
  { label: "Porteur Jeune", pts: 1 },
];

// Championnats du Monde
const wcRR: [number, number][] = [
  [1, 1200], [2, 960], [3, 780], [4, 600], [5, 450],
  [6, 360], [7, 300], [8, 250], [9, 215], [10, 180],
  [11, 150], [12, 120], [13, 90], [14, 75], [15, 60],
];
const wcITT: [number, number][] = [
  [1, 400], [2, 320], [3, 260], [4, 200], [5, 150],
  [6, 120], [7, 100], [8, 85], [9, 70], [10, 60],
  [11, 50], [12, 40], [13, 30], [14, 25], [15, 20],
];
const ecRR: [number, number][] = [
  [1, 400], [2, 320], [3, 260], [4, 200], [5, 150],
  [6, 120], [7, 100], [8, 85], [9, 70], [10, 60],
  [11, 50], [12, 40], [13, 30], [14, 25], [15, 20],
];
const ecITT: [number, number][] = [
  [1, 200], [2, 160], [3, 130], [4, 100], [5, 75],
  [6, 60], [7, 50], [8, 45], [9, 35], [10, 30],
  [11, 25], [12, 20], [13, 15], [14, 12], [15, 10],
];

// Championnats Nationaux Route
const cnRRCat1: [number, number][] = [
  [1, 180], [2, 150], [3, 120], [4, 90], [5, 75],
  [6, 60], [7, 40], [8, 30], [9, 20], [10, 15],
];
const cnRRCat2: [number, number][] = [[1, 150], [2, 125], [3, 100], [4, 75], [5, 60]];
const cnRRCat3: [number, number][] = [[1, 120], [2, 90], [3, 70]];
const cnRRCat4: [number, number][] = [[1, 50]];

// Championnats Nationaux CLM
const cnITTCat1: [number, number][] = [[1, 150], [2, 125], [3, 100]];
const cnITTCat2: [number, number][] = [[1, 120], [2, 90], [3, 70]];
const cnITTCat3: [number, number][] = [[1, 80], [2, 60], [3, 40]];
const cnITTCat4: [number, number][] = [[1, 30]];

/* ──────────── Tour barème reusable block ──────────── */

const TourBaremeBlock = ({
  gc,
  etape,
  maillots,
  porteurs,
  detailedMaillots,
}: {
  gc: [number, number][];
  etape: [number, number][];
  maillots: { label: string; pts: number }[];
  porteurs: { label: string; pts: number }[];
  detailedMaillots?: { label: string; rows: [number, number][] }[];
}) => (
  <div className="space-y-4">
    <CompactBareme label={`Classement général final (top ${gc.length})`} rows={gc} />
    <CompactBareme label={`Classement d'étape (top ${etape.length})`} rows={etape} />
    {detailedMaillots ? (
      <div>
        <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-2">
          Maillots distinctifs (classement final)
        </p>
        <div className="space-y-3">
          {detailedMaillots.map((m) => (
            <CompactBareme key={m.label} label={`${m.label} (top ${m.rows.length})`} rows={m.rows} />
          ))}
        </div>
      </div>
    ) : (
      <div>
        <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1.5">
          Maillots distinctifs (classement final)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {maillots.map((m) => (
            <div
              key={m.label}
              className="flex flex-col items-center p-2 rounded bg-bordure-cream/50 border border-bordure-green/5 text-center"
            >
              <span className="text-[11px] text-bordure-green/60 font-inter">{m.label}</span>
              <span className="font-montserrat font-bold text-sm text-bordure-green">{m.pts} pts</span>
            </div>
          ))}
        </div>
      </div>
    )}
    <div>
      <p className="text-xs font-montserrat font-semibold text-bordure-green/70 uppercase tracking-wider mb-1.5">
        Points porteur (par jour de course)
      </p>
      <PorteurLine items={porteurs} />
    </div>
  </div>
);

/* ──────────── page ──────────── */

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Comment fonctionne une ligue La Bordure ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Chaque manager dispose d'un budget fictif identique pour recruter des coureurs via un système d'enchères, puis marque des points selon leurs résultats sur les courses UCI.",
      },
    },
    {
      "@type": "Question",
      name: "Comment recrute-t-on les coureurs ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Les coureurs sont attribués via des enchères. À chaque tour, le manager le plus offrant remporte le coureur mis aux enchères, dans la limite de son budget.",
      },
    },
    {
      "@type": "Question",
      name: "Comment marque-t-on des points ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Les coureurs marquent des points selon un barème basé sur les classements d'étape et général des courses UCI, avec des bonus pour les maillots distinctifs.",
      },
    },
    {
      "@type": "Question",
      name: "Combien de managers faut-il pour lancer une ligue ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Il faut au minimum 2 managers pour lancer une ligue, mais l'expérience est optimale à 6, 8 ou 10 participants.",
      },
    },
  ],
};

const RulesPage = () => {
  return (
    <StaticPageLayout>
      <PageSeo title="Règles du jeu – La Bordure" description="Le règlement complet de La Bordure : enchères, composition d'équipe, barème de points et classements." path="/rules" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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

          {/* ── 2. Les types de ligues ── */}
          <SectionCard icon={Users} num="2" title="Les types de ligues">
            <div className="grid gap-4 md:grid-cols-2">
              {/* 5 Phases */}
              <div className="rounded-lg border border-bordure-gold/30 bg-bordure-cream/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🏆</span>
                  <h3 className="font-montserrat font-bold text-bordure-green">Mode 5 Phases</h3>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed mb-3">
                  Saison complète divisée en 5 phases d'enchères. Recrutez progressivement
                  votre effectif tout au long de l'année.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <span className="text-bordure-gold font-bold">💰</span>
                    <span className="text-bordure-green/80">Budget : <strong className="text-bordure-green">2 200</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <span className="text-bordure-gold font-bold">👥</span>
                    <span className="text-bordure-green/80">Effectif max : <strong className="text-bordure-green">30 coureurs</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <span className="text-bordure-gold font-bold">📅</span>
                    <span className="text-bordure-green/80">Enchères : <strong className="text-bordure-green">1 par phase</strong></span>
                  </div>
                </div>
                <p className="text-bordure-green/50 font-inter text-xs mt-3 italic">
                  Variante "World Tour only" disponible (uniquement les courses WT).
                </p>
              </div>

              {/* À la course */}
              <div className="rounded-lg border border-bordure-pink/30 bg-bordure-cream/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🎯</span>
                  <h3 className="font-montserrat font-bold text-bordure-green">Mode À la course</h3>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed mb-3">
                  Choisissez librement vos courses parmi le calendrier. Budget et effectif
                  s'adaptent automatiquement à votre sélection.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <span className="text-bordure-pink font-bold">🚴</span>
                    <span className="text-bordure-green/80">1 classique : <strong className="text-bordure-green">650 / 8 coureurs</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <span className="text-bordure-pink font-bold">🚴‍♂️</span>
                    <span className="text-bordure-green/80">Plusieurs classiques : <strong className="text-bordure-green">800 / 10 coureurs</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-inter">
                    <span className="text-bordure-pink font-bold">🏔️</span>
                    <span className="text-bordure-green/80">Course par étapes : <strong className="text-bordure-green">1 100 / 15 coureurs</strong></span>
                  </div>
                </div>
                <p className="text-bordure-green/50 font-inter text-xs mt-3 italic">
                  Enchère unique avant le début des courses sélectionnées.
                </p>
              </div>
            </div>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 3. Les enchères ── */}
          <SectionCard icon={Gavel} num="3" title="Les enchères">
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
                  <strong className="text-bordure-green">En cas d'égalité</strong> — À la clôture du
                  tour, le manager ayant misé le plus remporte le coureur. Si plusieurs managers
                  misent le même montant maximal, <strong>aucun ne remporte le coureur</strong> :
                  il est remis en jeu et redevient disponible au tour suivant.
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

          {/* ── 4. Le scoring ── */}
          <SectionCard icon={Target} num="4" title="Le scoring">
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
                Points attribués au classement d'arrivée uniquement.
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
                    <CompactBareme label="Classement (top 15)" rows={monumentsGC} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="classiques-cat1" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    ⭐ Classiques WT Cat. 1 (1er : 800 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <CompactBareme label="Classement (top 15)" rows={classiquesWTCat1} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="classiques-cat2" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Classiques WT Cat. 2 (1er : 550 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <CompactBareme label="Classement (top 15)" rows={classiquesWTCat2} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="classiques-cat3" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Classiques WT Cat. 3 (1er : 350 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <CompactBareme label="Classement (top 15)" rows={classiquesWTCat3} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="pro-1day" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Courses .Pro (1er : 150 pts) &amp; .1 (1er : 100 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 space-y-4">
                    <CompactBareme label=".Pro — Classement (top 10)" rows={proOneDayGC} />
                    <CompactBareme label=".1 — Classement (top 10)" rows={oneOneDayGC} />
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
                Points cumulés : classement général final + classement d'étape + maillots distinctifs + points porteur quotidiens.
              </p>
              <Accordion type="multiple" className="space-y-2">
                <AccordionItem value="gt" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🟡 Grands Tours — Tour de France, Giro, Vuelta
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <TourBaremeBlock
                      gc={gtGC}
                      etape={gtEtape}
                      maillots={gtMaillotsFinaux}
                      porteurs={gtPorteurs}
                      detailedMaillots={[
                        { label: "🟢 Vert (Points)", rows: gtMaillotVert },
                        { label: "🔴 Montagne (GPM)", rows: gtMaillotGPM },
                        { label: "⚪ Jeune", rows: gtMaillotJeune },
                        { label: "🔥 Combatif", rows: gtMaillotCombatif },
                      ]}
                    />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-cat1" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours WT Cat. 1 (GC 1er : 800 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <TourBaremeBlock gc={twc1GC} etape={twc1Etape} maillots={twc1Maillots} porteurs={twc1Porteurs} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-cat2" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours WT Cat. 2 (GC 1er : 550 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <TourBaremeBlock gc={twc2GC} etape={twc2Etape} maillots={twc2Maillots} porteurs={twc2Porteurs} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-cat3" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours WT Cat. 3 (GC 1er : 350 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <TourBaremeBlock gc={twc3GC} etape={twc3Etape} maillots={twc3Maillots} porteurs={twc3Porteurs} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-pro" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours .Pro (GC 1er : 250 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <TourBaremeBlock gc={proTourGC} etape={proTourEtape} maillots={proTourMaillots} porteurs={proTourPorteurs} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="tours-1" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    Tours .1 (GC 1er : 200 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <TourBaremeBlock gc={oneTourGC} etape={oneTourEtape} maillots={oneTourMaillots} porteurs={oneTourPorteurs} />
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
                    <CompactBareme label="Classement (top 15)" rows={wcRR} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="wc-itt" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🌈 Championnat du Monde — CLM (1er : 400 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <CompactBareme label="Classement (top 15)" rows={wcITT} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="ec-rr" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🇪🇺 Championnat d'Europe — Route (1er : 400 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <CompactBareme label="Classement (top 15)" rows={ecRR} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="ec-itt" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🇪🇺 Championnat d'Europe — CLM (1er : 200 pts)
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <CompactBareme label="Classement (top 15)" rows={ecITT} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Championnats Nationaux */}
            <div className="mt-6">
              <h3 className="font-montserrat font-semibold text-bordure-green flex items-center gap-2 mb-3">
                <Flag className="w-4 h-4 text-bordure-gold" />
                Championnats Nationaux
              </h3>
              <p className="text-bordure-green/70 font-inter text-sm mb-3">
                Les coureurs marquent des points en fonction de la catégorie de leur nation (Cat 1 = grandes nations cyclistes).
              </p>
              <Accordion type="multiple" className="space-y-2">
                <AccordionItem value="cn-rr" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    🏁 CN Route — Par catégorie
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 space-y-3">
                    <CompactBareme label="Cat 1 (top 10)" rows={cnRRCat1} />
                    <CompactBareme label="Cat 2 (top 5)" rows={cnRRCat2} />
                    <CompactBareme label="Cat 3 (top 3)" rows={cnRRCat3} />
                    <CompactBareme label="Cat 4 (1er uniquement)" rows={cnRRCat4} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cn-itt" className="border border-black/[0.04] rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline">
                    ⏱️ CN CLM — Par catégorie
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 space-y-3">
                    <CompactBareme label="Cat 1 (top 3)" rows={cnITTCat1} />
                    <CompactBareme label="Cat 2 (top 3)" rows={cnITTCat2} />
                    <CompactBareme label="Cat 3 (top 3)" rows={cnITTCat3} />
                    <CompactBareme label="Cat 4 (1er uniquement)" rows={cnITTCat4} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 5. Les bonus ── */}
          <SectionCard icon={Gift} num="5" title="Les bonus">
            <div className="space-y-5">
              <div>
                <h3 className="font-montserrat font-semibold text-bordure-green text-sm mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-bordure-gold/20 text-bordure-gold text-xs font-bold">C</span>
                  Bonus Coureur
                </h3>
                <ul className="space-y-2 text-bordure-green/80 font-inter text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-bordure-gold font-bold">•</span>
                    <span>
                      <strong>Première victoire (+25%)</strong> — Lorsqu'un coureur remporte sa première victoire professionnelle en carrière,
                      il reçoit un bonus de +25% des points. Une seule fois par coureur.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-bordure-gold font-bold">•</span>
                    <span>
                      <strong>Coureur bonusé — Cote 10/20 (+25%)</strong> — Les coureurs ayant une cote initiale de 10 ou 20
                      bénéficient d'un bonus de +25% sur tous leurs points marqués.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-bordure-gold font-bold">•</span>
                    <span>
                      <strong>5+ Victoires CLM</strong> — Bonus attribué après 5 victoires individuelles en contre-la-montre dans la saison.
                    </span>
                  </li>
                </ul>
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

          {/* ── 6. Le classement ── */}
          <SectionCard icon={BarChart3} num="6" title="Le classement">
            <p className="text-bordure-green/80 font-inter leading-relaxed">
              Un seul classement fait foi : le <strong>classement général</strong>. Il cumule l'ensemble
              des points marqués par tous tes coureurs sur la saison entière. Pas de reset hebdomadaire,
              pas de phases — la constance et la profondeur d'effectif sont récompensées du premier
              jour au dernier.
            </p>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 7. Courses prises en compte ── */}
          <SectionCard icon={Calendar} num="7" title="Courses prises en compte">
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
                "Championnats Nationaux",
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

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 8. La page Calendrier ── */}
          <SectionCard icon={Calendar} num="8" title="La page Calendrier">
            <p className="text-bordure-green/80 font-inter leading-relaxed mb-5">
              Le <strong>Calendrier</strong> recense toutes les courses UCI de la saison. Filtre, trie et
              clique sur une course pour ouvrir son détail (startlist, mouvements, équipes engagées).
            </p>

            <div className="rounded-lg overflow-hidden border border-bordure-green/10 mb-5 bg-secondary">
              <img
                src="/screenshots/calendar.webp"
                alt="Aperçu de la page Calendrier"
                loading="lazy"
                className="w-full h-auto"
              />
            </div>

            <Accordion type="multiple" className="space-y-2">
              <AccordionItem value="cal-startlist" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  Comment voir la startlist d'une course ?
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Clique sur n'importe quelle ligne du calendrier pour ouvrir la fenêtre de détail.
                  Tu y verras les équipes engagées, le nombre de coureurs déclarés, les images du parcours
                  ainsi que la liste complète des coureurs au départ.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cal-movements" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  À quoi servent les « Mouvements startlist » ?
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Le bloc <strong>Mouvements startlist</strong> liste les derniers ajouts et retraits
                  détectés automatiquement (Ajout / Retrait, coureur, équipe, date de détection).
                  Idéal pour anticiper les forfaits ou repérer un favori glissé sur la liste à la dernière minute.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cal-favorites" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-bordure-gold" />
                    Comment ajouter un coureur en favori ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Une étoile est affichée à côté de chaque coureur de la startlist. Un simple clic suffit
                  pour le marquer comme favori — il sera ensuite mis en avant dans la page
                  <em> Données coureurs</em> et filtrable rapidement.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cal-filters" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  Quels filtres sont disponibles ?
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Recherche par nom, filtre par catégorie (WT, Pro, .1, championnats…), par phase, et
                  option « Masquer les courses passées ». Les colonnes <em>Countdown</em>, <em>Points</em>
                  et <em>Startlist</em> permettent un tri instantané pour préparer ta stratégie.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cal-export" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  Vue mobile et export
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Sur mobile, le calendrier passe en vue compacte avec accordéons par mois, et les mouvements
                  startlist sont accessibles en bas du détail course. Un export Excel reprend l'ensemble
                  du calendrier filtré pour analyse hors-ligne.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 9. La page Données coureurs ── */}
          <SectionCard icon={Database} num="9" title="La page Données coureurs">
            <p className="text-bordure-green/80 font-inter leading-relaxed mb-5">
              <strong>Données coureurs</strong> est ta base de données complète : plus de 3 000 coureurs
              UCI avec leurs cotes, points marqués, équipe et programme de courses prévu.
            </p>

            <div className="rounded-lg overflow-hidden border border-bordure-green/10 mb-5 bg-secondary">
              <img
                src="/screenshots/data.webp"
                alt="Aperçu de la page Données coureurs"
                loading="lazy"
                className="w-full h-auto"
              />
            </div>

            <Accordion type="multiple" className="space-y-2">
              <AccordionItem value="data-filters" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  Quels filtres puis-je utiliser ?
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Recherche par nom, équipe, catégorie (WT / Pro / Continental), courses prévues,
                  cotes, programme (avec / sans) et l'option <strong>Favoris uniquement</strong>.
                  Les filtres se combinent et un compteur affiche en temps réel le nombre de coureurs filtrés.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="data-favorites" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  <span className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-bordure-gold" />
                    Comment fonctionnent les coureurs favoris ?
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Clique sur l'étoile à gauche de chaque ligne pour marquer un coureur comme favori.
                  Tes favoris sont synchronisés avec ton compte et apparaissent partout dans l'app
                  (Calendrier, Startlists, Enchères). Active <em>Favoris uniquement</em> pour ne voir
                  que ta short-list.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="data-panel" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  Le panneau latéral résultats
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Clique sur le nom d'un coureur pour ouvrir un panneau latéral détaillant tous ses
                  résultats de la saison (course, classement, points marqués). Pratique pour évaluer la
                  forme d'un coureur avant de miser.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="data-cote" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  Comprendre la cote et le programme
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  La <strong>cote</strong> représente la valeur initiale d'un coureur (mise plancher
                  estimée). La colonne <strong>Programme</strong> liste les courses sur lesquelles il
                  est attendu — clé pour cibler les coureurs alignés sur les épreuves de ta ligue
                  « À la course ».
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="data-export" className="border border-black/[0.04] rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 text-sm font-montserrat font-semibold text-bordure-green hover:no-underline text-left">
                  Export Excel
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3 text-sm text-bordure-green/70 font-inter leading-relaxed">
                  Le bouton <strong>Excel</strong> exporte la sélection courante (filtres appliqués)
                  avec nom, équipe, catégorie, cote, points et favori — pratique pour préparer ta
                  stratégie d'enchères au calme.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>

          <BordureStripes orientation="horizontal" className="mx-auto max-w-xs" />

          {/* ── 10. Tips de navigation ── */}
          <SectionCard icon={Compass} num="10" title="Tips de navigation">
            <p className="text-bordure-green/80 font-inter leading-relaxed mb-5">
              Quelques raccourcis pour te repérer rapidement dans l'application.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-4 h-4 text-bordure-gold" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Tableau de bord</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  Toutes tes ligues actives sont affichées sur la page d'accueil. Clique sur une carte pour
                  accéder directement à ses enchères ou à son classement selon le contexte.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-bordure-pink" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Changer de ligue</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  Le sélecteur de ligue (en haut sur mobile, dans la barre latérale sur desktop) permet de
                  basculer instantanément entre tes différentes ligues sans perdre la page courante.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-bordure-gold" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Calendrier & Data</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  Accessibles depuis le header, ces deux pages sont tes outils d'analyse principaux pour
                  préparer enchères et stratégies. Voir les sections 8 et 9 pour le détail.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-bordure-gold" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Coureurs favoris</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  L'étoile est disponible partout (Calendrier, Data, Startlists, Enchères). Tes favoris
                  sont synchronisés en temps réel sur tous tes appareils.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-bordure-pink" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Notifications</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  La cloche dans le header te prévient des ouvertures et clôtures d'enchères, des résultats
                  de courses et des messages dans l'Arène. Active les notifications push depuis ton compte
                  pour ne rien manquer.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gavel className="w-4 h-4 text-bordure-gold" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Enchères</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  Pense à <strong>valider</strong> tes mises avant la deadline. Tant que tous les managers
                  n'ont pas validé, les annonces de résultats restent figées. Une fois la dernière validation
                  reçue, le tour se clôt automatiquement.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-bordure-gold" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Mon Équipe & Classement</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  Suis les performances de tes coureurs jour par jour, consulte le détail des points par
                  course et compare ton effectif avec celui des autres managers de la ligue.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-bordure-pink" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">L'Arène</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  L'espace social de ta ligue : trash-talk, sondages, pronostics et suivi live des courses.
                  Récapitulatifs automatiques après chaque épreuve majeure.
                </p>
              </div>

              <div className="rounded-lg border border-bordure-green/10 bg-bordure-cream/40 p-4 sm:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <Menu className="w-4 h-4 text-bordure-gold" />
                  <h4 className="font-montserrat font-semibold text-bordure-green text-sm">Mobile</h4>
                </div>
                <p className="text-bordure-green/70 font-inter text-sm leading-relaxed">
                  Sur mobile, la barre du bas donne accès aux principales sections (Équipe, Enchères,
                  Classement, Arène). Le menu burger en haut à gauche déroule les fonctions secondaires
                  (compte, ligues, paramètres). L'app est installable comme PWA depuis ton navigateur.
                </p>
              </div>
            </div>
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
