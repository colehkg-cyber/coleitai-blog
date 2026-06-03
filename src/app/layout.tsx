// PERF-CRITICAL: Do NOT add preconnect links (use dns-prefetch only).
// Do NOT wrap GA/SW/AdBlocker in dynamic() - causes TBT spike from chunk loading.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import AdBlockerNotice from '@/components/AdBlockerNotice';
import WebMCPRegistrar from '@/components/WebMCPRegistrar';
import { siteConfig, brandConfig, featuresConfig } from '@/config';
import { getSettingValue } from '@/lib/settings';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
});

export async function generateMetadata(): Promise<Metadata> {
  let faviconUrl: string | undefined
  let metaDescription: string | undefined

  try {
    faviconUrl = await getSettingValue('SITE_FAVICON_URL')
    metaDescription = await getSettingValue('SITE_META_DESCRIPTION')
  } catch {
    // DB unavailable — use config defaults
  }

  const description = metaDescription || siteConfig.description[siteConfig.defaultLocale]

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.title[siteConfig.defaultLocale],
      template: `%s | ${siteConfig.shortName}`
    },
    description,
    keywords: [...siteConfig.keywords],
    authors: [{ name: siteConfig.author.name }],
    creator: siteConfig.author.name,
    publisher: siteConfig.author.name,
    ...(faviconUrl ? {
      icons: {
        icon: faviconUrl,
        apple: faviconUrl,
      },
    } : {}),
    openGraph: {
      type: "website",
      locale: siteConfig.defaultLocale === 'ko' ? 'ko_KR' : 'en_US',
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: siteConfig.title[siteConfig.defaultLocale],
      description,
      images: [
        {
          url: brandConfig.ogImage,
          width: 1200,
          height: 630,
          alt: siteConfig.name
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.name,
      description,
      ...(siteConfig.social.twitter ? { creator: siteConfig.social.twitter } : {}),
      images: [brandConfig.ogImage]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: siteConfig.url,
      languages: {
        ko: '/',
        'x-default': '/',
      },
    },
    verification: {
      google: siteConfig.verification.google || undefined,
      // 네이버는 Next.js metadata 표준 키가 아니므로 other로 렌더링
      other: siteConfig.verification.naver
        ? { 'naver-site-verification': siteConfig.verification.naver }
        : undefined,
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description[siteConfig.defaultLocale],
    publisher: {
      '@type': siteConfig.author.type,
      name: siteConfig.author.name,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }

  return (
    <html lang="ko">
      <head>
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {siteConfig.analytics.gaId && <GoogleAnalytics />}
        {featuresConfig.serviceWorker && <ServiceWorkerRegistration />}
        {children}
        {featuresConfig.adBlockerNotice && <AdBlockerNotice />}
        <WebMCPRegistrar />
      </body>
    </html>
  );
}
