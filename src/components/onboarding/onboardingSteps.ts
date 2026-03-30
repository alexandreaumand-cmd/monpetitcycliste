import { BarChart3, Users, Calendar, ListChecks, LineChart, Trophy, Radio, Swords } from "lucide-react";

export interface OnboardingStep {
  key: string;
  icon: typeof BarChart3;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    key: "standings",
    icon: BarChart3,
    titleFr: "Classement",
    titleEn: "Rankings",
    descriptionFr: "Suis ton classement et celui de tes adversaires en temps réel. Compare les points de chaque manager tout au long de la saison.",
    descriptionEn: "Track your ranking and your opponents' in real time. Compare each manager's points throughout the season.",
  },
  {
    key: "teams",
    icon: Users,
    titleFr: "Mon équipe",
    titleEn: "My Team",
    descriptionFr: "Gère ton effectif, consulte les stats de tes coureurs et optimise ta stratégie pour chaque course.",
    descriptionEn: "Manage your roster, check your riders' stats and optimize your strategy for each race.",
  },
  {
    key: "results",
    icon: BarChart3,
    titleFr: "Résultats",
    titleEn: "Results",
    descriptionFr: "Retrouve les résultats des courses passées et les points marqués par chaque coureur.",
    descriptionEn: "Find past race results and the points scored by each rider.",
  },
  {
    key: "races",
    icon: Calendar,
    titleFr: "Courses",
    titleEn: "Races",
    descriptionFr: "Découvre les prochaines courses au calendrier et prépare tes sélections à l'avance.",
    descriptionEn: "Discover upcoming races on the calendar and prepare your selections in advance.",
  },
  {
    key: "startlist",
    icon: ListChecks,
    titleFr: "Startlist",
    titleEn: "Startlist",
    descriptionFr: "Compose ta sélection de coureurs pour chaque course. Choisis les bons riders au bon moment !",
    descriptionEn: "Pick your riders for each race. Choose the right riders at the right time!",
  },
  {
    key: "statistics",
    icon: LineChart,
    titleFr: "Statistiques",
    titleEn: "Statistics",
    descriptionFr: "Analyse tes performances avec des graphiques détaillés et identifie tes points forts.",
    descriptionEn: "Analyze your performance with detailed charts and identify your strengths.",
  },
  {
    key: "auctions",
    icon: Trophy,
    titleFr: "Enchères",
    titleEn: "Auctions",
    descriptionFr: "Recrute de nouveaux coureurs aux enchères. Place tes offres stratégiquement pour renforcer ton équipe.",
    descriptionEn: "Recruit new riders at auction. Place your bids strategically to strengthen your team.",
  },
  {
    key: "live",
    icon: Radio,
    titleFr: "Live",
    titleEn: "Live",
    descriptionFr: "Suis les courses en direct et vois les points tomber en temps réel.",
    descriptionEn: "Follow races live and watch points come in real time.",
  },
  {
    key: "arena",
    icon: Swords,
    titleFr: "Arène",
    titleEn: "Arena",
    descriptionFr: "Discute avec les autres managers, participe aux sondages et pronostics dans l'espace communautaire.",
    descriptionEn: "Chat with other managers, participate in polls and predictions in the community space.",
  },
];
