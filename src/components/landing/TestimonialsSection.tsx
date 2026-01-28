import { useTranslation } from "react-i18next";
import { Quote, MapPin } from "lucide-react";

const TestimonialsSection = () => {
  const { t } = useTranslation("home");

  const testimonials = [
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
    {
      text: t("testimonials.quotes.quote3.text"),
      author: t("testimonials.quotes.quote3.author"),
      location: t("testimonials.quotes.quote3.location"),
    },
  ];

  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("testimonials.title")}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t("testimonials.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative p-6 rounded-xl bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 hover:border-yellow-500/30 transition-all duration-300"
            >
              {/* Quote icon */}
              <Quote className="absolute top-4 right-4 w-8 h-8 text-[#FFD500]/20" />

              <p className="text-gray-300 text-sm mb-6 leading-relaxed italic">
                "{testimonial.text}"
              </p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD500] to-yellow-600 flex items-center justify-center text-black font-bold">
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
    </section>
  );
};

export default TestimonialsSection;
