import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  keywords?: string[];
}

export function SEO({
  title = 'StackCast - Bitcoin Prediction Markets',
  description = 'Trade prediction markets on Bitcoin with StackCast. Decentralized, transparent, and secure prediction markets powered by Stacks blockchain.',
  image = 'https://stackcast.xyz/og-image.png',
  url = 'https://stackcast.xyz/',
  type = 'website',
  keywords = ['prediction markets', 'bitcoin', 'stacks', 'blockchain', 'decentralized', 'trading', 'forecasting'],
}: SEOProps) {
  const fullTitle = title.includes('StackCast') ? title : `${title} | StackCast`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="StackCast" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* WhatsApp uses Open Graph tags */}
    </Helmet>
  );
}
