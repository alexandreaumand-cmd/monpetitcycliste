import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, Wallet } from "lucide-react";

const TeamPreviewSection = () => {
  const { t } = useTranslation("home");

  const teamCategories = [
    {
      name: t("teamPreview.leaders"),
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      riders: [
        { name: "POGACAR", stars: 3 },
        { name: "VINGEGAARD", stars: 3 },
      ],
    },
    {
      name: t("teamPreview.sprinters"),
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      riders: [
        { name: "PHILIPSEN", stars: 2 },
        { name: "MERLIER", stars: 1 },
      ],
    },
    {
      name: t("teamPreview.climbers"),
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      riders: [
        { name: "BARDET", stars: 2 },
        { name: "CICCONE", stars: 1 },
      ],
    },
  ];

  return (
    <section className="py-20 bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-white mb-4">
            {t("teamPreview.title")}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t("teamPreview.subtitle")}
          </p>
        </div>

        {/* Team Preview Card */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
            {/* Team Grid */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teamCategories.map((category, index) => (
                  <div
                    key={index}
                    className={`rounded-xl ${category.bgColor} border ${category.borderColor} p-4`}
                  >
                    <h4 className={`text-xs font-bold ${category.color} mb-3 tracking-wider`}>
                      {category.name}
                    </h4>
                    <div className="space-y-2">
                      {category.riders.map((rider, riderIndex) => (
                        <div
                          key={riderIndex}
                          className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2"
                        >
                          <span className="text-white text-sm font-medium">
                            {rider.name}
                          </span>
                          <div className="flex gap-0.5">
                            {[...Array(rider.stars)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-3 h-3 text-[#FFD500] fill-[#FFD500]"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Bar */}
            <div className="bg-gray-950 border-t border-gray-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[#FFD500]" />
                  <span className="text-gray-400 text-sm">
                    {t("teamPreview.budgetRemaining")}
                  </span>
                </div>
                <span className="text-xl font-poppins font-bold text-[#FFD500]">
                  15M€
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-8">
            <Link to="/auth">
              <Button size="lg" className="px-8">
                {t("teamPreview.cta")} →
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeamPreviewSection;
