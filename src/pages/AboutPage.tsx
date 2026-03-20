import StaticPageLayout from "@/components/layout/StaticPageLayout";

const AboutPage = () => {
  return (
    <StaticPageLayout>
      <article className="prose prose-green max-w-none">
        <h1 className="text-bordure-green font-montserrat text-3xl md:text-4xl font-bold mb-8">
          À propos de La Bordure
        </h1>

        <section className="mb-10">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Le fantasy cycling entre amis
          </h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed mb-4">
            La Bordure est un jeu de fantasy cycling conçu par et pour des passionnés de vélo. 
            L'idée est simple : créer une ligue entre amis, recruter des coureurs professionnels 
            via un système d'enchères, puis les voir marquer des points au fil des courses UCI tout au long de la saison.
          </p>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Pas de transferts automatiques, pas d'algorithmes froids. Ici, c'est le bluff, la stratégie 
            et la connaissance du peloton qui font la différence. C'est toi contre tes potes, avec de vrais 
            coureurs et de vraies courses.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Comment c'est né ?
          </h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed mb-4">
            Tout a commencé avec un tableur partagé entre copains pendant le Tour de France. 
            Des enchères sur WhatsApp, des points comptés à la main, et beaucoup de chambrage. 
            La Bordure est née de l'envie de transformer cette expérience en quelque chose de plus 
            fluide, sans perdre l'esprit du jeu entre amis.
          </p>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Le nom ? « La Bordure », c'est ce moment dans le peloton où tout se joue. 
            Quand le vent souffle de côté et que seuls les meilleurs restent devant. 
            C'est exactement l'esprit du jeu.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Ce qu'on propose
          </h2>
          <ul className="space-y-3 text-bordure-green/80 font-inter">
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span>Un système d'enchères entre amis pour recruter les coureurs du peloton pro</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span>Le suivi en temps réel de toutes les courses UCI (WorldTour, ProSeries, .1)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span>Des classements généraux, hebdomadaires et par coureur</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span>Un espace communautaire pour chambrer et commenter les courses en direct</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">
            Rejoins-nous
          </h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            La Bordure est gratuit et ouvert à tous les passionnés de cyclisme. 
            Crée ta ligue, invite tes amis, et montre-leur qui connaît vraiment le peloton.
          </p>
        </section>
      </article>
    </StaticPageLayout>
  );
};

export default AboutPage;
