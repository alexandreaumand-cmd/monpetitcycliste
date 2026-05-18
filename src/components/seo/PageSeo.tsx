import { Helmet } from "react-helmet-async";

interface PageSeoProps {
  title: string;
  description: string;
  path: string;
}

/**
 * Per-route SEO/social meta. Sets <title>, description, canonical and og:* tags
 * for the current route. Note: client-side only — social crawlers that don't
 * execute JS will see the static defaults in index.html.
 */
export const PageSeo = ({ title, description, path }: PageSeoProps) => {
  const url = `https://labordure.app${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
    </Helmet>
  );
};

export default PageSeo;
