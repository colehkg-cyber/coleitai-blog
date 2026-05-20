import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
// import LazyNewsletterAnalytics from '@/components/LazyNewsletterAnalytics' // Disabled newsletter feature
import { Metadata } from 'next'
import { siteConfig, brandConfig, navigationConfig } from '@/config'
import { shouldUseNextImage } from '@/lib/image-utils'
import { tagsToArray } from '@/lib/utils/tags'
import SiteHeader from '@/components/SiteHeader'

// ISR: revalidate hourly. Restores bfcache while keeping homepage data fresh.
export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return {
    title: siteConfig.title.ko,
    description: siteConfig.description.ko,
    alternates: {
      canonical: siteConfig.url,
      languages: {
        ko: '/',
        'x-default': '/',
      }
    },
    ...(siteConfig.verification.naver ? {
      other: {
        'naver-site-verification': siteConfig.verification.naver
      }
    } : {})
  }
}

type Post = Awaited<ReturnType<typeof prisma.post.findMany>>[number]

function parseExcerpt(excerpt: string | null): string | null {
  if (!excerpt) return null;
  
  // Handle potentially truncated JSON content
  if (excerpt.includes('```json') || excerpt.includes('"excerpt":')) {
    // 1. Try to extract from ```json block
    const jsonMatch = excerpt.match(/```json\s*([\s\S]*?)(?:```|$)/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return parsed.excerpt || parsed.description || null;
      } catch (e) {
        // JSON might be truncated, continue to fallback methods
      }
    }
    
    // 2. Try to extract excerpt value directly from JSON string
    const excerptMatch = excerpt.match(/"excerpt"\s*:\s*"([^"]+)"/);
    if (excerptMatch) {
      return excerptMatch[1];
    }
    
    // 3. If it's clearly JSON but we can't parse it, return a default message
    if (excerpt.startsWith('```json') || excerpt.startsWith('{')) {
      // Extract title if possible as fallback
      const titleMatch = excerpt.match(/"title"\s*:\s*"([^"]+)"/);
      if (titleMatch) {
        return `Read about: ${titleMatch[1]}`;
      }
      return "Click to read more...";
    }
  }
  
  return excerpt;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  let posts: Post[] = []

  try {
    posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          not: null,
          lte: new Date()
        },
        originalLanguage: 'ko'
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    })
  } catch (error) {
    console.error('Database error:', error)
    // Return empty array if database fails
    posts = []
  }

  const featuredPost = posts[0]
  const recentPosts = posts.slice(1, 5)
  const morePosts = posts.slice(5)

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader currentPath="/" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {posts.length > 0 && (
          <>
            {/* Featured Post */}
            {featuredPost && (
              <section className="mb-16">
                <article className="bg-gray-50 rounded-2xl p-8 lg:p-12">
                  <Link href={`/posts/${featuredPost.slug}`} className="block">
                    <div className="grid lg:grid-cols-2 gap-8 items-center">
                      {featuredPost.coverImage && (
                        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-white w-full max-w-none">
                          {shouldUseNextImage(featuredPost.coverImage) ? (
                            <Image
                              src={featuredPost.coverImage}
                              alt={featuredPost.title}
                              fill
                              priority
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 90vw, 50vw"
                              placeholder="blur"
                              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxQf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                              fetchPriority="high"
                            />
                          ) : (
                            <img
                              src={featuredPost.coverImage}
                              alt={featuredPost.title}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="eager"
                            />
                          )}
                        </div>
                      )}
                      <div className="space-y-4">
                        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight hover:text-gray-700 transition-colors">
                          {featuredPost.title}
                        </h2>
                        {featuredPost.excerpt && (
                          <p className="text-lg text-gray-600 leading-relaxed">
                            {parseExcerpt(featuredPost.excerpt)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <time>
                            {new Date(featuredPost.publishedAt!).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </time>
                          <span>•</span>
                          <span>FEATURED</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </article>
              </section>
            )}

            {/* Most Popular Section */}
            {recentPosts.length > 0 && (
              <section className="mb-16">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-bold text-gray-900">Most Popular</h2>
                  <Link href="/archive" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                    VIEW ALL
                  </Link>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {recentPosts.map((post, index) => (
                    <article key={post.id} className="group" style={{ minHeight: '280px' }}>
                      <Link href={`/posts/${post.slug}`} className="block">
                        <div className="space-y-3">
                          {post.coverImage && (
                            <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-gray-100 w-full" style={{ contain: 'layout' }}>
                              {shouldUseNextImage(post.coverImage) ? (
                                <Image
                                  src={post.coverImage}
                                  alt={post.title}
                                  fill
                                  priority={index === 0}
                                  loading={index === 0 ? undefined : "lazy"}
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                  placeholder="blur"
                                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxQf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                                  fetchPriority={index === 0 ? "high" : "low"}
                                />
                              ) : (
                                <img
                                  src={post.coverImage}
                                  alt={post.title}
                                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                  decoding="async"
                                />
                              )}
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-gray-700 transition-colors">
                              {post.title}
                            </h3>
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                              <time>
                                {new Date(post.publishedAt!).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </time>
                              <span>•</span>
                              <span>{tagsToArray(post.tags)[0] || 'ARTICLE'}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Latest Section */}
            {morePosts.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-8">Latest</h2>
                <div className="space-y-8">
                  {morePosts.map((post) => (
                    <article key={post.id} className="group" style={{ minHeight: '180px' }}>
                      <Link href={`/posts/${post.slug}`} className="block">
                        <div className="grid md:grid-cols-3 gap-6 items-start">
                          {post.coverImage && (
                            <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-gray-100" style={{ contain: 'layout' }}>
                              {shouldUseNextImage(post.coverImage) ? (
                                <Image
                                  src={post.coverImage}
                                  alt={post.title}
                                  fill
                                  loading="lazy"
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                  sizes="(max-width: 768px) 100vw, 33vw"
                                  placeholder="blur"
                                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxQf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                                  fetchPriority="low"
                                />
                              ) : (
                                <img
                                  src={post.coverImage}
                                  alt={post.title}
                                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                  decoding="async"
                                />
                              )}
                            </div>
                          )}
                          <div className="md:col-span-2 space-y-2">
                            <h3 className="text-xl font-semibold text-gray-900 leading-tight group-hover:text-gray-700 transition-colors">
                              {post.title}
                            </h3>
                            {post.excerpt && (
                              <p className="text-gray-600 line-clamp-2">
                                {parseExcerpt(post.excerpt)}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <time>
                                {new Date(post.publishedAt!).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </time>
                              <span>•</span>
                              <span>{tagsToArray(post.tags)[0] || 'ARTICLE'}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
                <div className="mt-12 text-center">
                  <Link href="/archive" className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700">
                    See all
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </section>
            )}
          </>
        )}

        {/* Empty State */}
        {posts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500">No posts published yet.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white py-12" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full overflow-x-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                {brandConfig.logo.image ? (
                  <img src={brandConfig.logo.image} alt={brandConfig.logo.text} className="h-5 w-auto" />
                ) : brandConfig.logo.text}
              </h3>
            </div>
            <div>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-gray-600 hover:text-gray-900">About</Link></li>
                <li><Link href="/archive" className="text-gray-600 hover:text-gray-900">Archive</Link></li>
              </ul>
            </div>
            <div>
              <ul className="space-y-2">
                <li><Link href="/sitemap" className="text-gray-600 hover:text-gray-900">Sitemap</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} {brandConfig.copyright.holder}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
