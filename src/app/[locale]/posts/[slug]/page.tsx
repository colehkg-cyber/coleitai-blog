import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPostBySlug } from '@/lib/optimized-queries'
import LazyBlogPostAnalytics from '@/components/LazyBlogPostAnalytics'
import MarkdownContent from '@/components/MarkdownContent'
import RelatedPosts from '@/components/RelatedPosts'
import TableOfContents from '@/components/TableOfContents'
import Breadcrumb from '@/components/Breadcrumb'
import { calculateReadingTime, formatReadingTime } from '@/lib/reading-time'
import { siteConfig, brandConfig, navigationConfig, featuresConfig } from '@/config'
import { shouldUseNextImage } from '@/lib/image-utils'
import { tagsToArray } from '@/lib/utils/tags'
import { unwrapContent } from '@/lib/utils/content'
import { getOgImageUrl } from '@/lib/unsplash'
import SiteHeader from '@/components/SiteHeader'

interface PostPageProps {
  params: Promise<{ slug: string; locale: string }>
}

// ISR: revalidate every hour. Restores bfcache (no Cache-Control: no-store)
// while keeping content fresh and avoiding build-time DB quota issues.
export const revalidate = 3600
export const dynamicParams = true

// Temporarily disabled to avoid DB quota issues during build
/*
export async function generateStaticParams() {
  try {
    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          not: null
          // 🔧 HOTFIX: Remove lte condition to include all published posts
          // lte: new Date()
        }
      },
      select: {
        slug: true
      }
    })

    if (posts.length === 0) {
      console.warn('⚠️ [generateStaticParams] No posts found for static generation!')
      return []
    }

    const locales = ['ko', 'en']
    const params = posts.flatMap((post) =>
      locales.map((locale) => ({
        slug: post.slug,
        locale,
      }))
    )

    return params
  } catch (error) {
    console.error('❌ [generateStaticParams] Error:', error)
    return []
  }
}
*/

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  try {
    const { slug: rawSlug, locale } = await params
    // 🔧 HOTFIX: Decode URL parameter to handle Korean characters
    const slug = decodeURIComponent(rawSlug)
    const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      translations: {
        where: {
          locale: locale === 'en' ? 'en' : 'ko'
        }
      }
    }
  })

  if (!post || !post.publishedAt) {
    return {
      title: 'Post Not Found',
    }
  }

  const content = unwrapContent(post.content)

  const readingTime = calculateReadingTime(content)

  // Use translated content if available
  const translation = post.translations?.[0]
  const displayTitle = locale === 'en' && translation?.title ? translation.title : post.title
  const displayExcerpt = locale === 'en' && translation?.excerpt ? translation.excerpt : post.excerpt
  const displayCoverImage = translation?.coverImage || post.coverImage

  // SEO meta description fallback chain (never undefined)
  const stripMarkdown = (s: string) => s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const contentFallback = stripMarkdown(content).slice(0, 160)
  const description =
    post.seoDescription ||
    displayExcerpt ||
    contentFallback ||
    siteConfig.description[locale === 'en' ? 'en' : 'ko']

  // OG 이미지 결정 — 3단계 fallback
  // 1순위: 글 cover image (Unsplash면 1200x630으로 강제 리사이징)
  // 2순위: 동적 /api/og 라우트 (제목·작성자·날짜 텍스트 카드)
  // 3순위: brandConfig.ogImage (사이트 기본 이미지, /og-image.png)
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url
  const dynamicOgUrl = `${siteBase}/api/og?title=${encodeURIComponent(displayTitle)}&author=${encodeURIComponent(post.author || siteConfig.author.name)}&date=${encodeURIComponent(new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}&readTime=${encodeURIComponent(formatReadingTime(readingTime))}&tags=${encodeURIComponent(tagsToArray(post.tags).join(','))}`
  const defaultOgUrl = `${siteBase}${brandConfig.ogImage}`
  const ogImageUrl = displayCoverImage
    ? getOgImageUrl(displayCoverImage, dynamicOgUrl)
    : (dynamicOgUrl || defaultOgUrl)

  return {
    title: post.seoTitle || displayTitle,
    description,
    alternates: {
      canonical: `/posts/${post.slug}`,
      languages: {
        'ko': `/posts/${post.slug}`,
        'x-default': `/posts/${post.slug}`,
      }
    },
    openGraph: {
      title: post.seoTitle || displayTitle,
      description,
      type: 'article',
      publishedTime: new Date(post.publishedAt).toISOString(),
      modifiedTime: new Date(post.updatedAt).toISOString(),
      tags: post.tags,
      images: [{ url: ogImageUrl }],
      locale: locale === 'en' ? 'en_US' : 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle || displayTitle,
      description,
      images: [ogImageUrl],
    },
  }
  } catch (error) {
    console.error('Error generating metadata:', error)
    const siteBase = process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url
    return {
      title: `Post - ${siteConfig.shortName}`,
      description: 'Blog post content unavailable',
      openGraph: {
        title: `Post - ${siteConfig.shortName}`,
        description: 'Blog post content unavailable',
        type: 'article',
        images: [{ url: `${siteBase}${brandConfig.ogImage}` }],
      },
    }
  }
}

export default async function PostPage({
  params
}: PostPageProps) {
  try {
    const { slug: rawSlug, locale } = await params
    const lang = locale === 'en' ? 'en' : 'ko'

    // 🔧 HOTFIX: Decode URL parameter to handle Korean characters
    const slug = decodeURIComponent(rawSlug)

    const post = await getPostBySlug(slug)

  if (!post || !post.publishedAt || post.status !== 'PUBLISHED') {
    console.warn('⚠️ [PostPage] Post not found or not published, returning 404')
    notFound()
  }
  
  // Check if post is scheduled for future
  if (post.publishedAt > new Date()) {
    notFound()
  }

  // View count is now tracked client-side via ViewCounter component

  const displayTitle = post.title
  const displayExcerpt = post.excerpt

  // Unwrap JSON-wrapped content
  let content = unwrapContent(post.content)
  
  // Calculate reading time
  const readingTime = calculateReadingTime(content)
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage || `${process.env.NEXT_PUBLIC_SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&author=${encodeURIComponent(post.author || siteConfig.author.name)}&date=${encodeURIComponent(new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}&readTime=${encodeURIComponent(formatReadingTime(readingTime))}&tags=${encodeURIComponent(tagsToArray(post.tags).join(','))}`,
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: {
      '@type': siteConfig.author.type,
      name: post.author || siteConfig.author.name,
      url: `${siteConfig.url}${siteConfig.author.aboutPath}`,
    },
    publisher: {
      '@type': siteConfig.author.type,
      name: siteConfig.name,
      logo: {
        '@type': 'ImageObject',
        url: `${siteConfig.url}/logo.png`,
      },
      url: siteConfig.url,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteConfig.url}/posts/${post.slug}`,
    },
    keywords: tagsToArray(post.tags).join(', '),
    articleSection: tagsToArray(post.tags)[0] || 'Blog',
    wordCount: content.split(/\s+/).length,
    timeRequired: `PT${readingTime}M`,
    inLanguage: lang === 'en' ? 'en-US' : 'ko-KR',
  }
  
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteConfig.url,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Posts',
        item: `${siteConfig.url}/posts`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `${siteConfig.url}/posts/${post.slug}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      
      <div className="min-h-screen bg-white">
        <SiteHeader locale={lang as keyof typeof navigationConfig} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full overflow-x-hidden">
          <div className="xl:flex xl:gap-8">
            <article className="xl:flex-1 max-w-4xl mx-auto xl:mx-0">
              <Breadcrumb postTitle={displayTitle} postSlug={post.slug} />
              <header className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{displayTitle}</h1>
                <div className="flex items-center text-gray-600 space-x-4">
                  <time dateTime={new Date(post.publishedAt).toISOString()}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <span>•</span>
                  <span>{formatReadingTime(readingTime)}</span>
                  {post.author && (
                    <>
                      <span>•</span>
                      <span>By {post.author}</span>
                    </>
                  )}
                </div>
            {tagsToArray(post.tags).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tagsToArray(post.tags).map((tag: string) => (
                  <span key={tag} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {post.coverImage && (
            <div className="relative w-full max-w-4xl mb-6 rounded-lg overflow-hidden bg-gray-100">
              <div className="relative aspect-[16/9] w-full">
                {shouldUseNextImage(post.coverImage) ? (
                  <Image
                    src={post.coverImage}
                    alt={displayTitle}
                    fill
                    className="object-cover bg-gray-100"
                    priority
                    fetchPriority="high"
                    loading="eager"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                  />
                ) : (
                  <img
                    src={post.coverImage}
                    alt={displayTitle}
                    className="absolute inset-0 w-full h-full object-cover bg-gray-100"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                )}
              </div>
            </div>
          )}

              <MarkdownContent content={content} />

              <Suspense fallback={<div className="h-32 animate-pulse bg-gray-100 rounded mt-8" />}>
                <RelatedPosts postId={post.id} />
              </Suspense>

              <Suspense fallback={null}>
                <LazyBlogPostAnalytics 
                  title={post.title} 
                  slug={post.slug} 
                  author={post.author || undefined}
                  tags={tagsToArray(post.tags)}
                />
              </Suspense>
            </article>

            <aside className="hidden xl:block">
              <TableOfContents content={content} />
            </aside>
          </div>
        </main>

        <footer className="bg-gray-50 mt-20" role="contentinfo">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <p className="text-center text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} {brandConfig.copyright.holder}. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  )
  } catch (error) {
    console.error('Error loading post page:', error)

    // Emergency fallback during DB quota or connection issues
    if (error instanceof Error && (
      error.message.includes('quota') ||
      error.message.includes('connection') ||
      error.message.includes('database') ||
      error.name === 'PrismaClientInitializationError'
    )) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Service Temporarily Unavailable</h1>
            <p className="text-gray-600 mb-4">We're experiencing high traffic. Please try again in a few minutes.</p>
            <a href="/" className="text-blue-600 hover:text-blue-800">← Return to Home</a>
          </div>
        </div>
      )
    }

    // For other errors, show 404
    notFound()
  }
}