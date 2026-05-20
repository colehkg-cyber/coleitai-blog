export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Hobby 함수 최대 실행 시간 (초)

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { logger } from '@/lib/error-handler'
import {
  getSystemInstruction,
  getRelevantKnowledgeContext,
  generateContentPrompt,
} from '@/lib/ai-prompts'
import { generateSlug, generateUniqueSlug } from '@/lib/utils/slug'
import {
  searchUnsplashImage,
  extractImageKeywords,
  getOptimizedImageUrl,
} from '@/lib/unsplash'
import { autoGenerateThumbnailUrl } from '@/lib/utils/thumbnail'
import { tagsToString } from '@/lib/utils/tags'
import { unwrapContent, parseAIResponse } from '@/lib/utils/content'
import { getDefaultPostAuthor } from '@/lib/settings'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '')

/**
 * Vercel Cron + 수동 호출 모두 허용:
 *  - Vercel cron: `x-vercel-cron` 헤더 자동 부여
 *  - 수동 호출: `Authorization: Bearer ${CRON_SECRET}` 헤더 필요
 */
function isAuthorized(request: NextRequest): boolean {
  // Vercel cron이 자동으로 붙이는 헤더
  if (request.headers.get('x-vercel-cron')) return true

  const cronSecret = env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!env.GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY 미설정 — cron 글 생성 불가')
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  try {
    return await generatePost(request)
  } catch (err) {
    // 빈 body의 500을 막기 위해 에러 메시지를 응답에 포함 (workflow 로그에서 즉시 원인 파악 가능)
    const message = err instanceof Error ? err.message : String(err)
    const stage = (err as Error & { stage?: string })?.stage
    logger.error('Cron: 글 생성 중 예외 발생', { message, stage })
    return NextResponse.json(
      { error: 'Post generation failed', message, stage: stage ?? 'unknown' },
      { status: 500 }
    )
  }
}

async function generatePost(request: NextRequest) {

  // 1. 가장 적게 사용된 키워드 1개 선택 (round-robin 비슷)
  const keyword = await prisma.keyword.findFirst({
    orderBy: [{ usageCount: 'asc' }, { createdAt: 'asc' }],
  })

  if (!keyword) {
    logger.warn('Cron: 등록된 키워드 없음 — /admin/keywords 에서 추가 필요')
    return NextResponse.json({
      message: 'No keywords registered. Add keywords at /admin/keywords first.',
      skipped: true,
    })
  }

  logger.info('Cron: 글 생성 시작', { keyword: keyword.text, usageCount: keyword.usageCount })

  // 2. Gemini로 글 생성
  const systemInstruction = await getSystemInstruction()
  const knowledgeContext = await getRelevantKnowledgeContext(keyword.text)
  const userPrompt = generateContentPrompt(keyword.text, [keyword.text])
  const fullPrompt = `${systemInstruction}\n\n------\n\n${knowledgeContext}**EXECUTE TASK:**\n\n${userPrompt}`

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
  })

  const responseText = result.response.text()

  // 3. JSON 파싱 (코드블록 wrapper 제거)
  let parsed: {
    title?: string
    slug?: string
    content?: string
    excerpt?: string
    tags?: string[]
    seoTitle?: string
    seoDescription?: string
  }
  parsed = parseAIResponse(responseText)
  if (!parsed.title) parsed.title = keyword.text
  if (!parsed.content) parsed.content = responseText
  if (!parsed.excerpt) parsed.excerpt = (parsed.content || '').substring(0, 160)
  if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) parsed.tags = [keyword.text]

  const postTitle = parsed.title || keyword.text

  // 4. 영문 슬러그 (AI가 준 것 우선, 없으면 키워드/제목에서 생성)
  const aiSlug = typeof parsed.slug === 'string' ? parsed.slug : ''
  const baseSlug = generateSlug(aiSlug || postTitle)
  const slug = await generateUniqueSlug(baseSlug, async (candidate) => {
    const existing = await prisma.post.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    return !!existing
  })

  // 5. 썸네일: Unsplash → OG fallback
  let coverImageUrl = ''
  try {
    const query = extractImageKeywords(postTitle)
    const image = await searchUnsplashImage(query)
    if (image) {
      coverImageUrl = getOptimizedImageUrl(image, 1080, 75)
      logger.info('Cron: Unsplash 썸네일 할당', { query })
    }
  } catch (err) {
    logger.warn('Cron: Unsplash 검색 실패, OG 폴백', {
      err: err instanceof Error ? err.message : String(err),
    })
  }
  if (!coverImageUrl) {
    coverImageUrl = autoGenerateThumbnailUrl(postTitle, request)
  }

  // 6. 즉시 PUBLISHED 상태로 저장
  const now = new Date()
  const defaultAuthor = await getDefaultPostAuthor()
  const post = await prisma.post.create({
    data: {
      title: postTitle,
      slug,
      content: unwrapContent(parsed.content || responseText),
      excerpt: parsed.excerpt || responseText.substring(0, 160),
      tags: tagsToString(parsed.tags || [keyword.text]),
      seoTitle: parsed.seoTitle || postTitle,
      seoDescription: parsed.seoDescription || parsed.excerpt || '',
      coverImage: coverImageUrl,
      status: 'PUBLISHED',
      publishedAt: now,
      author: defaultAuthor,
      originalLanguage: 'ko',
    },
  })

  // 7. 키워드 usage 카운터 증가 (다음 cron은 다른 키워드 선택)
  await prisma.keyword.update({
    where: { id: keyword.id },
    data: { usageCount: { increment: 1 } },
  })

  // 8. ISR 캐시 무효화 — 홈/목록에 즉시 반영
  revalidatePath('/', 'layout')

  // 9. 사이트맵 갱신 (best effort)
  try {
    if (env.NEXT_PUBLIC_SITE_URL) {
      await fetch(`${env.NEXT_PUBLIC_SITE_URL}/api/sitemap/update`, { method: 'POST' })
    }
  } catch (err) {
    logger.warn('Cron: sitemap 갱신 실패', {
      err: err instanceof Error ? err.message : String(err),
    })
  }

  logger.info('Cron: 글 발행 완료', {
    postId: post.id,
    slug: post.slug,
    keyword: keyword.text,
  })

  return NextResponse.json({
    success: true,
    keyword: keyword.text,
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      publishedAt: post.publishedAt,
    },
  })
}

// Vercel Cron은 GET으로 호출
export async function GET(request: NextRequest) {
  return handler(request)
}

// 테스트용 수동 호출도 허용
export async function POST(request: NextRequest) {
  return handler(request)
}
