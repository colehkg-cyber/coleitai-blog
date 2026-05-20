import { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { siteConfig, brandConfig } from '@/config'
import SiteHeader from '@/components/SiteHeader'

export const metadata: Metadata = {
  title: `Archive - ${siteConfig.name}`,
  description: 'Browse all posts organized by date',
}

// ISR: hourly revalidation. Restores bfcache vs. force-dynamic.
export const revalidate = 3600

type ArchivePost = {
  id: string
  title: string
  slug: string
  publishedAt: Date | null
  excerpt: string | null
}

export default async function ArchivePage() {
  // ISR로 빌드 타임에 prerender되므로, 첫 배포(빈 DB)에서 Post 테이블이 없으면
  // findMany가 throw한다. try-catch로 감싸 빈 배열로 폴백 → 빌드 실패 방지.
  let posts: ArchivePost[] = []
  try {
    posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          not: null,
          lte: new Date()
        }
      },
      orderBy: {
        publishedAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true,
        excerpt: true,
      }
    })
  } catch (error) {
    console.error('[Archive] DB 조회 실패 (빈 DB 가능):', error)
    posts = []
  }

  // Group posts by year and month
  const groupedPosts = posts.reduce((acc, post) => {
    const date = new Date(post.publishedAt!)
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!acc[yearMonth]) {
      acc[yearMonth] = []
    }
    acc[yearMonth].push(post)
    
    return acc
  }, {} as Record<string, typeof posts>)

  const sortedYearMonths = Object.keys(groupedPosts).sort().reverse()

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader currentPath="/archive" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-12">Archive</h1>
        
        <div className="space-y-12">
          {sortedYearMonths.map((yearMonth) => {
            const [year, month] = yearMonth.split('-')
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' })
            
            return (
              <div key={yearMonth}>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  {monthName} {year}
                </h2>
                <div className="space-y-4">
                  {groupedPosts[yearMonth].map((post) => (
                    <article key={post.id} className="border-b border-gray-200 pb-4">
                      <time className="text-sm text-gray-500">
                        {new Date(post.publishedAt!).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </time>
                      <h3 className="text-xl font-semibold mt-1">
                        <Link href={`/posts/${post.slug}`} className="text-gray-900 hover:text-blue-600">
                          {post.title}
                        </Link>
                      </h3>
                      {post.excerpt && (
                        <p className="text-gray-600 mt-2">{post.excerpt}</p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="bg-gray-50 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} {brandConfig.copyright.holder}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}