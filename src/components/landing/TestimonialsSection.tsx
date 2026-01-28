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
    <section className="py-20 bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("testimonials.title")}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t("testimonials.subtitle")}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Featured Testimonial */}
          <div className="relative rounded-2xl bg-gradient-to-br from-yellow-500/10 via-gray-900 to-gray-900 border border-yellow-500/30 p-8 overflow-hidden">
            {/* Decorative glow */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />
            
            <div className="relative">
              {/* Badge */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFD500] rounded-full">
                  <Trophy className="w-4 h-4 text-black" />
                  <span className="text-black font-bold text-sm">
                    {t("testimonials.featured.rank")}
                  </span>
                </div>
                <span className="text-gray-400 text-sm font-medium">
                  {t("testimonials.featured.league")}
                </span>
              </div>

              {/* Quote */}
              <p className="text-xl text-white leading-relaxed mb-6 italic">
                "{t("testimonials.featured.text")}"
              </p>

              {/* Author */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD500] to-yellow-600 flex items-center justify-center text-black font-bold text-lg">
                    G
                  </div>
                  <div>
                    <p className="text-white font-semibold">
                      {t("testimonials.featured.author")}
                    </p>
                    <p className="text-[#FFD500] text-sm font-medium">
                      {t("testimonials.featured.stats")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {secondaryTestimonials.map((testimonial, index) => (
              <div
                key={index}
                className="relative p-6 rounded-xl bg-gray-900 border border-gray-800 hover:border-yellow-500/30 transition-all duration-300"
              >
                <p className="text-gray-300 text-sm mb-6 leading-relaxed italic">
                  "{testimonial.text}"
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-bold">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {testimonial.author}
                    </p>
                    <p className="text-gray-500 text-xs flex items-center gap-1">
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
