import StaticPageLayout from "@/components/layout/StaticPageLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const HowToPlayPage = () => {
  const steps = [
    {
      num: "01",
      title: "Crée ta ligue",
      desc: "Inscris-toi et crée une ligue privée. Choisis un nom, configure le budget de départ et le nombre de coureurs par équipe.",
    },
    {
      num: "02",
      title: "Invite tes amis",
      desc: "Partage le lien d'invitation à tes amis. Il faut au minimum 2 managers pour lancer une ligue, mais c'est encore mieux à 6, 8 ou 10.",
    },
    {
      num: "03",
      title: "Enchéris sur les coureurs",
      desc: "Quand les enchères ouvrent, parcours le peloton et place tes mises. Chaque tour, le plus offrant remporte le coureur. Gère bien ton budget !",
    },
    {
      num: "04",
      title: "Suis les courses et marque des points",
      desc: "Tes coureurs marquent des points à chaque course UCI. Suis les résultats, grimpe au classement et chambre tes potes en direct.",
    },
  ];

  return (
    <StaticPageLayout>
      <article className="prose prose-green max-w-none">
        <h1 className="text-bordure-green font-montserrat text-3xl md:text-4xl font-bold mb-8">
          Comment jouer
        </h1>

        <p className="text-bordure-green/80 font-inter leading-relaxed mb-10 text-lg">
          Rejoindre La Bordure, c'est simple. En 4 étapes, tu es prêt à défier tes amis 
          sur tout le calendrier cycliste.
        </p>

        <div className="space-y-8 mb-12">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="flex gap-5 items-start bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-black/[0.04]"
            >
              <span className={`font-montserrat font-bold text-2xl shrink-0 ${i % 2 === 0 ? "text-bordure-gold" : "text-bordure-pink"}`}>
                {step.num}
              </span>
              <div>
                <h3 className="text-bordure-green font-montserrat font-semibold text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-bordure-green/70 font-inter leading-relaxed text-sm">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/auth">
            <Button className="bg-bordure-gold hover:bg-bordure-gold/90 text-bordure-green font-montserrat font-bold px-8 py-3">
              Créer ma ligue
            </Button>
          </Link>
        </div>
      </article>
    </StaticPageLayout>
  );
};

export default HowToPlayPage;
