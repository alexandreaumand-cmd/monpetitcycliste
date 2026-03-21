import { useState } from "react";
import { useTranslation } from "react-i18next";
import StaticPageLayout from "@/components/layout/StaticPageLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

const ContactPage = () => {
  const { t } = useTranslation("home");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: form.name,
          email: form.email,
          subject: form.subject ? t(`contact.subjects.${form.subject}`) : undefined,
          message: form.message,
        },
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: t("contact.successTitle"),
        description: t("contact.successMessage"),
      });
    } catch (err) {
      console.error("Contact form error:", err);
      toast({
        title: t("contact.errorTitle"),
        description: t("contact.errorMessage"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <StaticPageLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-16 w-16 text-bordure-green mb-6" />
          <h1 className="text-3xl font-montserrat font-bold text-bordure-green mb-4">
            {t("contact.thankYouTitle")}
          </h1>
          <p className="text-bordure-green/70 font-inter max-w-md">
            {t("contact.thankYouMessage")}
          </p>
        </div>
      </StaticPageLayout>
    );
  }

  return (
    <StaticPageLayout>
      <h1 className="text-3xl md:text-4xl font-montserrat font-bold text-bordure-green mb-2">
        {t("contact.title")}
      </h1>
      <p className="text-bordure-green/70 font-inter mb-8">
        {t("contact.subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-bordure-green font-inter">
            {t("contact.nameLabel")} *
          </Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={100}
            value={form.name}
            onChange={handleChange}
            placeholder={t("contact.namePlaceholder")}
            className="border-bordure-green/20 focus:border-bordure-green"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-bordure-green font-inter">
            {t("contact.emailLabel")} *
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={255}
            value={form.email}
            onChange={handleChange}
            placeholder={t("contact.emailPlaceholder")}
            className="border-bordure-green/20 focus:border-bordure-green"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject" className="text-bordure-green font-inter">
            {t("contact.subjectLabel")}
          </Label>
          <Select value={form.subject} onValueChange={(value) => setForm(prev => ({ ...prev, subject: value }))}>
            <SelectTrigger className="border-bordure-green/20 focus:border-bordure-green">
              <SelectValue placeholder={t("contact.subjectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="question">{t("contact.subjects.question")}</SelectItem>
              <SelectItem value="bug">{t("contact.subjects.bug")}</SelectItem>
              <SelectItem value="suggestion">{t("contact.subjects.suggestion")}</SelectItem>
              <SelectItem value="partnership">{t("contact.subjects.partnership")}</SelectItem>
              <SelectItem value="other">{t("contact.subjects.other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-bordure-green font-inter">
            {t("contact.messageLabel")} *
          </Label>
          <Textarea
            id="message"
            name="message"
            required
            maxLength={5000}
            rows={6}
            value={form.message}
            onChange={handleChange}
            placeholder={t("contact.messagePlaceholder")}
            className="border-bordure-green/20 focus:border-bordure-green resize-none"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-bordure-green hover:bg-bordure-green/90 text-white font-montserrat w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("contact.sending")}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {t("contact.submit")}
            </>
          )}
        </Button>
      </form>
    </StaticPageLayout>
  );
};

export default ContactPage;
