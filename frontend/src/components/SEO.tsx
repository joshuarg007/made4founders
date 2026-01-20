import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  structuredData?: object;
}

const DEFAULT_TITLE = 'Made4Founders - Startup Management Platform for Founders';
const DEFAULT_DESCRIPTION = 'The all-in-one command center for startup founders. Track compliance, manage documents, monitor metrics, and secure credentials with bank-level encryption. Built by founders, for founders.';
const DEFAULT_KEYWORDS = 'startup management, founder tools, startup dashboard, business compliance, startup checklist, founder productivity, startup metrics, business document management, credential vault, startup organization, business compliance software, founder dashboard, startup operations, small business management';
const DEFAULT_IMAGE = 'https://made4founders.com/og-image.png';
const SITE_NAME = 'Made4Founders';
const BASE_URL = 'https://made4founders.com';

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
  structuredData,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL;

  // Default organization structured data
  const defaultStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: DEFAULT_DESCRIPTION,
    url: BASE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: '14-day free trial',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '127',
    },
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
  };

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={fullUrl} />

      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@made4founders" />
      <meta name="twitter:creator" content="@made4founders" />

      {/* Additional SEO */}
      <meta name="author" content={SITE_NAME} />
      <meta name="publisher" content={SITE_NAME} />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData || defaultStructuredData)}
      </script>
    </Helmet>
  );
}

// Pre-configured SEO for specific pages
export const pageSEO = {
  home: {
    title: undefined, // Uses default
    description: 'The all-in-one command center for startup founders. Track compliance, manage documents, monitor metrics, and secure credentials. 14-day free trial.',
    keywords: 'startup management software, founder tools, startup dashboard, business compliance, startup organization platform',
    url: '/',
  },
  features: {
    title: 'Features',
    description: 'Explore Made4Founders features: smart compliance checklist, encrypted credential vault, business metrics dashboard, document management, and marketing tools for startups.',
    keywords: 'startup features, compliance checklist, credential vault, business metrics, document management, startup marketing tools, founder productivity',
    url: '/features',
  },
  pricing: {
    title: 'Pricing',
    description: 'Simple, transparent pricing for Made4Founders. Start with a 14-day free trial. Plans for solo founders, growing teams, and enterprises.',
    keywords: 'startup software pricing, founder tools cost, business management pricing, startup dashboard price',
    url: '/pricing',
  },
  about: {
    title: 'About Us',
    description: 'Made4Founders is built by founders who understand startup challenges. Learn about our mission to simplify startup operations.',
    keywords: 'about made4founders, startup software company, founder-built software, startup management team',
    url: '/about',
  },
  signup: {
    title: 'Start Your Free Trial',
    description: 'Create your Made4Founders account and start your 14-day free trial. No credit card required. Set up in under 2 minutes.',
    keywords: 'startup software signup, free trial, founder tools registration, create account',
    url: '/signup',
    noindex: false,
  },
  login: {
    title: 'Log In',
    description: 'Log in to your Made4Founders account to access your startup command center.',
    keywords: 'login, sign in, made4founders login',
    url: '/login',
    noindex: true,
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'Made4Founders privacy policy. Learn how we protect your data with bank-level encryption and strict privacy practices.',
    keywords: 'privacy policy, data protection, startup data security',
    url: '/privacy',
  },
  terms: {
    title: 'Terms of Service',
    description: 'Made4Founders terms of service and user agreement.',
    keywords: 'terms of service, user agreement, legal terms',
    url: '/terms',
  },
  security: {
    title: 'Security',
    description: 'Learn about Made4Founders security practices: AES-256 encryption, SOC 2 compliance, and how we protect your startup data.',
    keywords: 'startup data security, encryption, SOC 2, data protection, secure startup software',
    url: '/security',
  },
};
