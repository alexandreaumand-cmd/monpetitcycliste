import StaticPageLayout from "@/components/layout/StaticPageLayout";
import { motion } from "framer-motion";
import {
  Gavel,
  Database,
  Globe,
  GraduationCap,
  Palette,
  Stethoscope,
  Trophy,
  Crown,
  Code,
  Ghost,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import leCodeurAvatar from "@/assets/team/le-codeur.png";
import leSachantAvatar from "@/assets/team/le-sachant.png";
import leCriminelAvatar from "@/assets/team/le-criminel.png";
import leRappeurAvatar from "@/assets/team/le-rappeur.png";
import leFantomeAvatar from "@/assets/team/le-fantome.png";
import leBossAvatar from "@/assets/team/le-boss.png";
import lAyatollahAvatar from "@/assets/team/layatollah.png";

interface TeamMember {
  nickname: string;
  description: string;
  icon: LucideIcon;
  accentColor: "gold" | "pink";
  avatar?: string;
}

const members: TeamMember[] = [
  { nickname: "L'Ayatollah", description: "Celui qui a créé un fichier de 100Mo pour gérer le jeu et qui en a créé les règles.", icon: Gavel, accentColor: "gold", avatar: lAyatollahAvatar },
  { nickname: "Le Pape de la Data", description: "Il a compilé toutes les données du cyclisme depuis 50 ans.", icon: Database, accentColor: "pink" },
  { nickname: "Le Criminel Écologique", description: "Il arpente l'Europe pour aller repérer les coureurs en devenir.", icon: Globe, accentColor: "gold", avatar: leCriminelAvatar },
  { nickname: "Le Sachant", description: "Il connaît tout sur tout, imbattable au quizz.", icon: GraduationCap, accentColor: "pink", avatar: leSachantAvatar },
  { nickname: "Le Rappeur", description: "Le plus créatif de la bande, fan de baies vitrées.", icon: Palette, accentColor: "gold", avatar: leRappeurAvatar },
  { nickname: "Le Doc", description: "On sait toujours pas trop ce qu'il farfouille, mais il gagne 5 phases d'affilé. Louche.", icon: Stethoscope, accentColor: "pink" },
  { nickname: "La Pépite", description: "Il s'est essayé au football. Barré par Mvila, il suit maintenant le vélo.", icon: Trophy, accentColor: "gold" },
  { nickname: "Le BOSS", description: "Il a renversé la table et a pris le pouvoir.", icon: Crown, accentColor: "pink", avatar: leBossAvatar },
  { nickname: "Le Codeur", description: "Il débug, fait évoluer, c'est lui qui tient la barre.", icon: Code, accentColor: "gold", avatar: leCodeurAvatar },
  { nickname: "Le Fantôme", description: "Plus occupé à bouffer des frites à la cantine qu'à suivre le vélo.", icon: Ghost, accentColor: "pink", avatar: leFantomeAvatar },
];

const TeamPage = () => {
  return (
    <StaticPageLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl md:text-4xl font-montserrat font-bold text-bordure-green mb-3">
            L'Équipe
          </h1>
          <p className="text-bordure-green/60 font-inter text-lg">
            Les 10 passionnés derrière La Bordure
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
          {members.map((member, i) => {
            const Icon = member.icon;
            const isGold = member.accentColor === "gold";
            return (
              <motion.div
                key={member.nickname}
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, delay: 0.08 * i }}
                className="group bg-white rounded-xl border border-bordure-green/10 p-5 text-center
                  hover:border-bordure-gold/40 hover:shadow-md transition-all duration-300"
              >
                {member.avatar ? (
                  <div className="mx-auto mb-4 w-16 h-16 rounded-full overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    <img src={member.avatar} alt={member.nickname} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${
                      isGold
                        ? "bg-bordure-gold/10 text-bordure-gold"
                        : "bg-bordure-pink/10 text-bordure-pink"
                    } group-hover:scale-105 transition-transform duration-300`}
                  >
                    <Icon className="w-7 h-7" strokeWidth={1.8} />
                  </div>
                )}
                <h3 className="font-montserrat font-bold text-bordure-green text-sm md:text-base mb-2 leading-tight">
                  {member.nickname}
                </h3>
                <p className="text-bordure-green/55 font-inter text-xs md:text-sm leading-relaxed">
                  {member.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </StaticPageLayout>
  );
};

export default TeamPage;
