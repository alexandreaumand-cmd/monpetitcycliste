import StaticPageLayout from "@/components/layout/StaticPageLayout";

const RulesPage = () => {
  return (
    <StaticPageLayout>
      <article className="prose prose-green max-w-none">
        <h1 className="text-bordure-green font-montserrat text-3xl md:text-4xl font-bold mb-8">
          Règles du jeu
        </h1>

        <section className="mb-10">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Principe général
          </h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Chaque manager dispose d'un budget fictif pour recruter des coureurs professionnels 
            via un système d'enchères. Les coureurs recrutés marquent des points en fonction de 
            leurs résultats dans les courses UCI réelles tout au long de la saison. Le manager 
            qui cumule le plus de points remporte la ligue.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Les enchères
          </h2>
          <ul className="space-y-3 text-bordure-green/80 font-inter">
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">1.</span>
              <span><strong>Budget initial</strong> — Chaque manager reçoit un budget identique en début de saison (ex. : 1 000 M€).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">2.</span>
              <span><strong>Tours d'enchères</strong> — Les enchères se déroulent en plusieurs tours successifs. À chaque tour, tu peux miser sur les coureurs disponibles.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">3.</span>
              <span><strong>Le plus offrant gagne</strong> — À la clôture du tour, le manager ayant misé le plus sur un coureur le remporte. En cas d'égalité, le premier à avoir enchéri l'emporte.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">4.</span>
              <span><strong>Stratégie budgétaire</strong> — Ton budget est limité. À toi de choisir entre miser gros sur les favoris ou répartir ton budget sur des outsiders.</span>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Le scoring
          </h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed mb-4">
            Les coureurs marquent des points sur chaque course en fonction de :
          </p>
          <ul className="space-y-3 text-bordure-green/80 font-inter">
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span><strong>Classement d'arrivée</strong> — Points attribués en fonction de la place d'arrivée sur chaque étape ou course d'un jour.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span><strong>Classements annexes</strong> — Général, points, montagne, jeunes : chaque maillot rapporte des points bonus.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span><strong>Catégorie de la course</strong> — Les courses de catégorie supérieure (WorldTour, Monuments) rapportent davantage de points.</span>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Les classements
          </h2>
          <ul className="space-y-3 text-bordure-green/80 font-inter">
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span><strong>Classement général</strong> — Cumul de tous les points de tes coureurs sur la saison entière.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span><strong>Classement hebdomadaire</strong> — Chaque semaine, un nouveau duel. Même en retard au général, tu peux briller sur 7 jours.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Courses prises en compte
          </h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Toutes les courses du calendrier UCI sont intégrées : WorldTour, ProSeries et courses .1. 
            De Paris-Roubaix au Tour de France, en passant par le Tour de Turquie — chaque course compte.
          </p>
        </section>
      </article>
    </StaticPageLayout>
  );
};

export default RulesPage;
