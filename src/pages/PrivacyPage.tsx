import StaticPageLayout from "@/components/layout/StaticPageLayout";

const PrivacyPage = () => {
  return (
    <StaticPageLayout>
      <article className="prose prose-green max-w-none">
        <h1 className="text-bordure-green font-montserrat text-3xl md:text-4xl font-bold mb-8">
          Politique de confidentialité
        </h1>

        <p className="text-bordure-green/60 font-inter text-sm mb-8">
          Dernière mise à jour : mars 2026
        </p>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">1. Données collectées</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed mb-4">
            Dans le cadre de l'utilisation de La Bordure, nous collectons les données suivantes :
          </p>
          <ul className="space-y-2 text-bordure-green/80 font-inter">
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span><strong>Données d'inscription</strong> : adresse e-mail, nom d'utilisateur (pseudo)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span><strong>Données de jeu</strong> : enchères, équipes, scores, classements</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-gold font-bold">•</span>
              <span><strong>Données techniques</strong> : adresse IP, type de navigateur, données de connexion</span>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">2. Finalités du traitement</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Les données sont utilisées pour : le fonctionnement du jeu et la gestion des comptes utilisateurs, 
            l'amélioration du service, et la communication avec les utilisateurs (notifications de jeu, mises à jour).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">3. Base légale</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Le traitement des données repose sur le consentement de l'utilisateur lors de son inscription 
            et sur l'intérêt légitime de l'éditeur pour le bon fonctionnement du service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">4. Durée de conservation</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Les données personnelles sont conservées pendant la durée d'utilisation du service. 
            En cas de suppression de compte, les données sont supprimées dans un délai de 30 jours, 
            à l'exception des données nécessaires au respect d'obligations légales.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">5. Partage des données</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées avec nos 
            sous-traitants techniques (hébergement, authentification) dans le strict cadre du fonctionnement du service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">6. Cookies</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            La Bordure utilise des cookies strictement nécessaires au fonctionnement du service 
            (authentification, préférences de langue). Aucun cookie publicitaire ou de tracking n'est utilisé.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">7. Vos droits (RGPD)</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed mb-4">
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
          </p>
          <ul className="space-y-2 text-bordure-green/80 font-inter">
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span>Droit d'accès à vos données personnelles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span>Droit de rectification des données inexactes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span>Droit à l'effacement (« droit à l'oubli »)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span>Droit à la portabilité de vos données</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-bordure-pink font-bold">•</span>
              <span>Droit d'opposition au traitement</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">8. Contact</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Pour exercer vos droits ou pour toute question relative à la protection de vos données, 
            contactez-nous à : contact@labordure.fr
          </p>
        </section>
      </article>
    </StaticPageLayout>
  );
};

export default PrivacyPage;
