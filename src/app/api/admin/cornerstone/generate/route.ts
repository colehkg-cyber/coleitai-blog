export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
import {
  getSystemInstruction,
  getRelevantKnowledgeContext,
  buildCornerstonePrompt,
  type CornerstoneSourcePost,
} from '@/lib/ai-prompts'
import { env } from '@/lib/env'
import { withErrorHandler, logger, createSuccessResponse } from '@/lib/error-handler'
import { generateUniqueSlugWithTimestamp } from '@/lib/utils/slug'
import { autoGenerateThumbnailUrl } from '@/lib/utils/thumbnail'
import { searchUnsplashImage, extractImageKeywords, getOptimizedImageUrl } from '@/lib/unsplash'
import { tagsToString } from '@/lib/utils/tags'
import { unwrapContent, parseAIResponse } from '@/lib/utils/content'
import { checkGeminiRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { verifyAdminAuth } from '@/lib/auth'
import { getDefaultPostAuthor } from '@/lib/settings'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '')

interface GenerateBody {
  sourcePostIds: string[]
  mainKeyword: string
  targetTitle?: string
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as GenerateBody

  if (!Array.isArray(body.sourcePostIds) || body.sourcePostIds.length < 3) {
    return NextResponse.json(
      { error: '3개 이상 20개 이하의 source 글을 선택해야 합니다.' },
      { status: 400 }
    )
  }
  if (body.sourcePostIds.length > 20) {
    return NextResponse.json({ error: '최대 20개의 source 글만 묶을 수 있습니다.' }, { status: 400 })
  }
  if (!body.mainKeyword || body.mainKeyword.trim().length < 2) {
    return NextResponse.json({ error: '메인 키워드는 필수입니다.' }, { status: 400 })
  }

  const sourcePosts = await prisma.post.findMany({
    where: {
      id: { in: body.sourcePostIds },
      status: 'PUBLISHED',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
    },
  })

  if (sourcePosts.length !== body.sourcePostIds.length) {
    return NextResponse.json(
      {
        error: `선택한 글 중 일부를 찾을 수 없거나 발행되지 않았습니다. (요청 ${body.sourcePostIds.length}개, 발견 ${sourcePosts.length}개)`,
      },
      { status: 400 }
    )
  }

  logger.info('Cornerstone generation start', {
    sourceCount: sourcePosts.length,
    mainKeyword: body.mainKeyword,
  })

  // Step 1: 시스템 지침 + 지식 컨텍스트
  const systemInstruction = await getSystemInstruction()
  const knowledgeContext = await getRelevantKnowledgeContext(body.mainKeyword)

  // Step 2: 코너스톤 전용 프롬프트
  const cornerstonePrompt = buildCornerstonePrompt(
    sourcePosts as CornerstoneSourcePost[],
    body.mainKeyword,
    body.targetTitle
  )

  const fullPrompt = `${systemInstruction}\n\n------\n\n${knowledgeContext}**EXECUTE TASK:**\n\n${cornerstonePrompt}`

  // Step 3: Gemini 호출 — 코너스톤은 더 긴 출력 필요 → maxOutputTokens 확장
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384, // 코너스톤은 8000자 → 약 12k tokens 여유 있게
    },
  })

  const responseText = result.response.text()
  logger.info('Cornerstone Gemini response', { length: responseText.length })

  // Step 4: JSON 파싱
  type ParsedCornerstone = {
    title?: string
    slug?: string
    excerpt?: string
    content?: string
    tags?: string[]
    seoTitle?: string
    seoDescription?: string
    coverImage?: string
  }
  const parsed: ParsedCornerstone = parseAIResponse(responseText)
  if (!parsed.title) parsed.title = `${body.mainKeyword} 완벽 가이드`
  if (!parsed.content) parsed.content = responseText
  if (!parsed.excerpt) parsed.excerpt = (parsed.content || '').substring(0, 160)
  if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) {
    parsed.tags = [body.mainKeyword, '코너스톤']
  }

  // Step 5: 커버 이미지
  const postTitle = parsed.title || `${body.mainKeyword} 완벽 가이드`
  let coverImageUrl: string = parsed.coverImage || ''
  if (!coverImageUrl) {
    try {
      const query = extractImageKeywords(postTitle)
      const image = await searchUnsplashImage(query)
      if (image) coverImageUrl = getOptimizedImageUrl(image, 1080, 75)
    } catch (err) {
      logger.warn('Unsplash 검색 실패', { err: String(err) })
    }
  }
  if (!coverImageUrl) coverImageUrl = autoGenerateThumbnailUrl(postTitle, request)

  // Step 6: DRAFT 저장 + spoke 관계 미리 설정 (publish 시점에서 박스 삽입)
  const slug = generateUniqueSlugWithTimestamp(parsed.title || postTitle)

  const defaultAuthor = await getDefaultPostAuthor()
  const cornerstonePost = await prisma.post.create({
    data: {
      title: postTitle,
      slug,
      content: unwrapContent(parsed.content || responseText),
      excerpt: parsed.excerpt || responseText.substring(0, 160),
      tags: tagsToString(parsed.tags || [body.mainKeyword, '코너스톤', '완벽가이드']),
      seoTitle: parsed.seoTitle || parsed.title || postTitle,
      seoDescription: parsed.seoDescription || parsed.excerpt || '',
      coverImage: coverImageUrl,
      status: 'DRAFT',
      author: defaultAuthor,
      originalLanguage: 'ko',
      isCornerstone: true,
    },
  })

  // 미리 spoke 관계 설정 (DB 레벨만; 박스는 publish 시점에 삽입)
  await prisma.post.updateMany({
    where: { id: { in: body.sourcePostIds } },
    data: { cornerstoneId: cornerstonePost.id },
  })

  logger.info('Cornerstone draft created', {
    id: cornerstonePost.id,
    slug: cornerstonePost.slug,
    spokeCount: body.sourcePostIds.length,
  })

  return createSuccessResponse(
    {
      id: cornerstonePost.id,
      title: cornerstonePost.title,
      slug: cornerstonePost.slug,
      status: cornerstonePost.status,
      content: cornerstonePost.content,
      excerpt: cornerstonePost.excerpt,
      seoTitle: cornerstonePost.seoTitle,
      seoDescription: cornerstonePost.seoDescription,
      coverImage: cornerstonePost.coverImage,
      tags: cornerstonePost.tags,
      sourcePostIds: body.sourcePostIds,
    },
    new URL(request.url).pathname
  )
}

export async function POST(request: NextRequest) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 })
  }

  const rateLimit = checkGeminiRateLimit()
  if (!rateLimit.success) {
    return NextResponse.json(createRateLimitResponse(rateLimit.resetTime), {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
      },
    })
  }

  return withErrorHandler(handler)(request)
}
