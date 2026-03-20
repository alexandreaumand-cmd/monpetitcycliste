import StaticPageLayout from "@/components/layout/StaticPageLayout";

const TermsPage = () => {
  return (
    <StaticPageLayout>
      <article className="prose prose-green max-w-none">
        <h1 className="text-bordure-green font-montserrat text-3xl md:text-4xl font-bold mb-8">
          Conditions Générales d'Utilisation
        </h1>

        <p className="text-bordure-green/60 font-inter text-sm mb-8">
          Dernière mise à jour : mars 2026
        </p>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">1. Objet</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Les présentes Conditions Générales d'Utilisation (CGU) définissent les règles d'accès et 
            d'utilisation du site et du service La Bordure, jeu gratuit de fantasy cycling en ligne.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">2. Inscription</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            L'inscription est gratuite et ouverte à toute personne physique majeure ou mineure de plus de 13 ans. 
            L'utilisateur s'engage à fournir des informations exactes lors de son inscription et à maintenir 
            la confidentialité de ses identifiants de connexion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">3. Utilisation du service</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            L'utilisateur s'engage à utiliser La Bordure de manière loyale et dans le respect des autres joueurs. 
            Sont notamment interdits : la création de comptes multiples au sein d'une même ligue, le harcèlement 
            d'autres utilisateurs, et toute tentative de manipulation du système de scoring.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">4. Gratuité</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            La Bordure est un service gratuit. Aucune transaction financière réelle n'est impliquée dans le jeu. 
            Les budgets et montants d'enchères sont entièrement fictifs.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">5. Propriété intellectuelle</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Le contenu du site (textes, images, logos, code) est protégé par le droit de la propriété intellectuelle. 
            Toute reproduction non autorisée est interdite. Les données de courses et de coureurs sont utilisées 
            à des fins ludiques et informatives.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">6. Responsabilité</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            L'éditeur s'efforce d'assurer la disponibilité du service mais ne garantit pas un accès ininterrompu. 
            La Bordure ne saurait être tenu responsable des dommages directs ou indirects liés à l'utilisation du service, 
            notamment en cas d'interruption, de bug ou de perte de données.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">7. Modification des CGU</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront 
            informés de toute modification substantielle. L'utilisation continue du service vaut acceptation des CGU modifiées.
          </p>
        </section>

        <section>
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">8. Contact</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Pour toute question relative aux présentes CGU, contactez-nous à : contact@labordure.fr
          </p>
        </section>
      </article>
    </StaticPageLayout>
  );
};

export default TermsPage;
