'use client'

import { useEffect } from 'react'
import { siteConfig } from '@/config'

type Post = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  tags?: string | null
  publishedAt?: string | null
  status: string
}

type WrappedResponse<T> = { success?: boolean; data?: T }

type RegisterOptions = { signal?: AbortSignal; exposedTo?: string[] }

type ModelContextTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<string> | string
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
}

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: ModelContextTool, options?: RegisterOptions) => void
    }
  }
}

async function fetchAllPosts(signal?: AbortSignal): Promise<Post[]> {
  const res = await fetch('/api/posts', { credentials: 'same-origin', signal })
  if (!res.ok) throw new Error(`/api/posts failed: ${res.status}`)
  const json = (await res.json()) as Post[] | WrappedResponse<Post[]>
  const list = Array.isArray(json) ? json : json.data
  return Array.isArray(list) ? list : []
}

function publishedOnly(posts: Post[]): Post[] {
  return posts.filter((p) => p.status === 'PUBLISHED' && p.publishedAt)
}

function postUrl(slug: string): string {
  return `${siteConfig.url}/posts/${slug}`
}

function parseTags(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function clampLimit(n: number | undefined, fallback: number, max: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(Math.max(Math.floor(v), 1), max)
}

export default function WebMCPRegistrar() {
  useEffect(() => {
    if (!document.modelContext?.registerTool) return

    const controller = new AbortController()
    const { signal } = controller

    document.modelContext.registerTool(
      {
        name: 'searchPosts',
        description: '블로그에 발행된 글을 제목·요약·태그에서 검색해 상위 결과를 반환합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '검색어. 공백으로 구분된 모든 토큰이 포함된 글을 매칭.' },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: '반환할 최대 개수(1~50).' },
          },
          required: ['query'],
        },
        execute: async (args) => {
          const query = String(args.query ?? '').trim()
          const limit = clampLimit(args.limit as number | undefined, 10, 50)
          if (!query) return JSON.stringify({ results: [] })

          const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
          const posts = publishedOnly(await fetchAllPosts(signal))
          const matched = posts
            .filter((p) => {
              const hay = `${p.title} ${p.excerpt ?? ''} ${p.tags ?? ''}`.toLowerCase()
              return tokens.every((t) => hay.includes(t))
            })
            .slice(0, limit)

          return JSON.stringify(
            matched.map((p) => ({
              title: p.title,
              url: postUrl(p.slug),
              excerpt: p.excerpt ?? '',
              tags: parseTags(p.tags),
              publishedAt: p.publishedAt,
            })),
            null,
            2,
          )
        },
        annotations: { readOnlyHint: true },
      },
      { signal },
    )

    document.modelContext.registerTool(
      {
        name: 'getRecentPosts',
        description: '발행된 최근 글 목록을 publishedAt 내림차순으로 반환합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: '반환할 최대 개수(1~50).' },
          },
        },
        execute: async (args) => {
          const limit = clampLimit(args.limit as number | undefined, 10, 50)
          const posts = publishedOnly(await fetchAllPosts(signal))
            .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
            .slice(0, limit)

          return JSON.stringify(
            posts.map((p) => ({
              title: p.title,
              url: postUrl(p.slug),
              excerpt: p.excerpt ?? '',
              publishedAt: p.publishedAt,
            })),
            null,
            2,
          )
        },
        annotations: { readOnlyHint: true },
      },
      { signal },
    )

    document.modelContext.registerTool(
      {
        name: 'getCategories',
        description: '발행된 글에서 사용된 태그를 사용 빈도와 함께 반환합니다. 이 블로그의 사실상 카테고리 목록입니다.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          const posts = publishedOnly(await fetchAllPosts(signal))
          const counts = new Map<string, number>()
          for (const p of posts) {
            for (const tag of parseTags(p.tags)) {
              counts.set(tag, (counts.get(tag) ?? 0) + 1)
            }
          }
          const sorted = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }))
          return JSON.stringify(sorted, null, 2)
        },
        annotations: { readOnlyHint: true },
      },
      { signal },
    )

    document.modelContext.registerTool(
      {
        name: 'subscribeNewsletter',
        description: '이메일을 뉴스레터 구독으로 접수합니다. 현재 백엔드 endpoint가 미구현 상태라 클라이언트 analytics 이벤트로만 기록됩니다.',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email', description: '구독자 이메일 주소.' },
          },
          required: ['email'],
        },
        execute: async (args) => {
          const email = String(args.email ?? '').trim()
          if (!email) return JSON.stringify({ ok: false, error: 'email required' })
          try {
            const mod = await import('./GoogleAnalytics')
            mod.trackNewsletterSignup(email)
          } catch {
            // analytics 실패는 무시 — 사용자 동작 방해 금지
          }
          return JSON.stringify({
            ok: true,
            note: 'subscription tracked via analytics; backend endpoint not yet wired',
          })
        },
        annotations: { readOnlyHint: false },
      },
      { signal },
    )

    return () => controller.abort()
  }, [])

  return null
}
