import { useTranslation } from "react-i18next";
import { Trophy, MapPin } from "lucide-react";

const TestimonialsSection = () => {
  const { t } = useTranslation("home");

  const secondaryTestimonials = [
    {
      text: t("testimonials.quotes.quote1.text"),
      author: t("testimonials.quotes.quote1.author"),
      location: t("testimonials.quotes.quote1.location"),
    },
    {
      text: t("testimonials.quotes.quote2.text"),
      author: t("testimonials.quotes.quote2.author"),
      location: t("testimonials.quotes.quote2.location"),
    },
  ];

  return (
    <section className="py-20 bg-bordure-cream">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-montserrat font-bold text-secondary mb-4">
            {t("testimonials.title")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto font-inter">
            {t("testimonials.subtitle")}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          <div className="relative rounded-2xl bg-gradient-to-br from-bordure-gold/10 via-white to-white border border-bordure-gold/30 p-8 overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-bordure-gold/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-full">
                  <Trophy className="w-4 h-4" />
                  <span className="font-bold text-sm">
                    {t("testimonials.featured.rank")}
                  </span>
                </div>
                <span className="text-muted-foreground text-sm font-medium font-inter">
                  {t("testimonials.featured.league")}
                </span>
              </div>

              <p className="text-xl text-secondary leading-relaxed mb-6 italic font-inter">
                "{t("testimonials.featured.text")}"
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-bordure-gold to-bordure-pink flex items-center justify-center text-white font-bold text-lg">
                    G
                  </div>
                  <div>
                    <p className="text-secondary font-semibold font-montserrat">
                      {t("testimonials.featured.author")}
                    </p>
                    <p className="text-bordure-gold text-sm font-medium font-inter">
                      {t("testimonials.featured.stats")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {secondaryTestimonials.map((testimonial, index) => (
              <div
                key={index}
                className="relative p-6 rounded-xl bg-white border border-border hover:border-bordure-gold/30 transition-all duration-300"
              >
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed italic font-inter">
                  "{testimonial.text}"
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-bordure-green flex items-center justify-center text-white font-bold">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-secondary font-semibold text-sm font-montserrat">
                      {testimonial.author}
                    </p>
                    <p className="text-muted-foreground text-xs flex items-center gap-1 font-inter">
                      <MapPin className="w-3 h-3" />
                      {testimonial.location}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
