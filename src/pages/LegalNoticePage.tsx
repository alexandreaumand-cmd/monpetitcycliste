import StaticPageLayout from "@/components/layout/StaticPageLayout";

const LegalNoticePage = () => {
  return (
    <StaticPageLayout>
      <article className="prose prose-green max-w-none">
        <h1 className="text-bordure-green font-montserrat text-3xl md:text-4xl font-bold mb-8">
          Mentions légales
        </h1>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">Éditeur du site</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Le site La Bordure est édité par La Bordure, projet personnel non enregistré en tant que société commerciale.<br />
            Contact : contact@labordure.fr
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">Hébergement</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Le site est hébergé par Lovable (lovable.dev).<br />
            Infrastructure technique fournie par Supabase, Inc. et Cloudflare, Inc.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">Propriété intellectuelle</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            L'ensemble des contenus présents sur le site La Bordure (textes, graphismes, logos, icônes, images) 
            est la propriété exclusive de l'éditeur, sauf mention contraire. Toute reproduction, représentation, 
            modification ou adaptation, totale ou partielle, est interdite sans l'accord préalable écrit de l'éditeur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">Données personnelles</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Pour toute question relative à la collecte et au traitement de vos données personnelles, 
            veuillez consulter notre <a href="/privacy" className="text-bordure-gold hover:underline">Politique de confidentialité</a>.
          </p>
        </section>

        <section>
          <h2 className="text-bordure-green font-montserrat text-xl font-semibold mb-4">Crédits photos</h2>
          <p className="text-bordure-green/80 font-inter leading-relaxed">
            Les photographies de coureurs utilisées sur le site sont issues de sources libres de droits 
            ou utilisées à des fins illustratives dans le cadre d'un usage éditorial non commercial.
          </p>
        </section>
      </article>
    </StaticPageLayout>
  );
};

export default LegalNoticePage;
