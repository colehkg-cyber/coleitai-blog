/**
 * Unsplash API 유틸리티
 *
 * 블로그 포스트용 고품질 이미지를 자동으로 가져옵니다.
 */

import { getSettingValue } from '@/lib/settings'

async function getUnsplashKey(): Promise<string | undefined> {
  // DB 설정 우선, env 폴백
  const dbKey = await getSettingValue('UNSPLASH_ACCESS_KEY')
  return dbKey || process.env.UNSPLASH_ACCESS_KEY
}

interface UnsplashImage {
  id: string
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
  }
  alt_description: string | null
  description: string | null
  user: {
    name: string
    username: string
  }
  links: {
    html: string
  }
}

interface UnsplashSearchResponse {
  results: UnsplashImage[]
  total: number
  total_pages: number
}

/**
 * Unsplash에서 키워드로 이미지 검색
 */
export async function searchUnsplashImage(
  query: string,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape'
): Promise<UnsplashImage | null> {
  const accessKey = await getUnsplashKey()
  if (!accessKey) {
    console.warn('⚠️ UNSPLASH_ACCESS_KEY가 설정되지 않았습니다. (admin 설정 또는 env에서 등록하세요)')
    return null
  }

  try {
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.append('query', query)
    // per_page 30 + 랜덤 선택: 같은 query여도 매번 다른 이미지를 얻기 위함.
    // (1로 두면 항상 #1 결과가 와서 여러 글이 같은 썸네일을 공유함)
    url.searchParams.append('per_page', '30')
    url.searchParams.append('orientation', orientation)

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      }
    })

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`)
    }

    const data: UnsplashSearchResponse = await response.json()

    if (data.results.length === 0) {
      console.warn(`⚠️ "${query}"에 대한 이미지를 찾을 수 없습니다.`)
      return null
    }

    // 결과 중 랜덤 1장 — 다양성 확보
    const randomIndex = Math.floor(Math.random() * data.results.length)
    return data.results[randomIndex]
  } catch (error) {
    console.error('❌ Unsplash 이미지 검색 실패:', error)
    return null
  }
}

/**
 * 블로그 포스트 제목에서 적절한 검색 키워드 추출
 */
export function extractImageKeywords(title: string): string {
  const keywordMap: Record<string, string> = {
    // AI & Tech
    'AI': 'artificial intelligence technology',
    '인공지능': 'artificial intelligence robot',
    'ChatGPT': 'AI chatbot technology',
    'GPT': 'AI language model',
    'Claude': 'AI assistant technology',
    'Gemini': 'AI technology digital',
    'LLM': 'artificial intelligence neural network',
    '머신러닝': 'machine learning data',
    '딥러닝': 'deep learning neural network',
    '프롬프트': 'AI prompt engineering',
    '자동화': 'automation workflow digital',
    '코딩': 'programming code laptop',
    '개발': 'software development coding',
    '노코드': 'no code technology startup',
    // Startup & Business
    '스타트업': 'startup office team',
    '창업': 'entrepreneur startup business',
    'PM': 'product management meeting',
    '프로덕트': 'product design strategy',
    'SEO': 'SEO marketing digital',
    '마케팅': 'digital marketing analytics',
    '성장': 'business growth chart',
    '투자': 'investment finance money',
    '수익': 'revenue business profit',
    '사업': 'business strategy planning',
    // Biohacking & Health
    '바이오해킹': 'biohacking health wellness',
    '다이어트': 'healthy diet food',
    '건강': 'health wellness lifestyle',
    '운동': 'fitness exercise gym',
    '케토': 'keto diet healthy food',
    '수면': 'sleep wellness rest',
    '웨고비': 'weight loss health medical',
    '멘탈': 'mental health mindfulness',
    'ADHD': 'focus productivity brain',
    // Lifestyle
    '독서': 'reading books library',
    '생산성': 'productivity desk workspace',
    '루틴': 'morning routine lifestyle',
    '자기계발': 'personal development growth',
    '재테크': 'financial planning investment',
    '부업': 'side hustle freelance',
    // General Tech
    '블로그': 'blogging writing laptop',
    '유튜브': 'youtube content creator',
    '콘텐츠': 'content creation digital',
    '디자인': 'design creative workspace',
    '앱': 'mobile app smartphone',
  }

  for (const [keyword, search] of Object.entries(keywordMap)) {
    if (title.includes(keyword)) {
      return search
    }
  }

  // Default: technology & digital
  return 'technology digital workspace minimal'
}

/**
 * 블로그 포스트에 최적화된 이미지 URL 생성
 */
export function getOptimizedImageUrl(
  image: UnsplashImage,
  width: number = 1080,
  quality: number = 75
): string {
  const url = new URL(image.urls.raw)
  url.searchParams.append('w', width.toString())
  url.searchParams.append('q', quality.toString())
  url.searchParams.append('auto', 'format')
  url.searchParams.append('fit', 'crop')
  return url.toString()
}

/**
 * OG 이미지 전용 URL 생성 — 1200×630 강제 (페이스북·카톡·트위터 표준)
 *
 * Unsplash URL이면 1200×630으로 crop, 아니면 원본 URL 반환.
 * 일반 본문 썸네일은 1080px 그대로 두고, OG meta 태그에만 이 함수 사용.
 */
export function getOgImageUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback
  if (!url.includes('images.unsplash.com')) return url
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('w', '1200')
    parsed.searchParams.set('h', '630')
    parsed.searchParams.set('fit', 'crop')
    parsed.searchParams.set('crop', 'entropy')
    parsed.searchParams.set('q', '80')
    parsed.searchParams.set('auto', 'format')
    // fm은 auto와 충돌하므로 제거
    parsed.searchParams.delete('fm')
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * 기존 Unsplash URL을 최적화된 형태로 변환
 * fm=jpg → auto=format (AVIF/WebP 자동 전환)
 * w=1200 → w=1080 (적정 크기)
 * q=80 → q=75 (파일 크기 절감)
 */
export function optimizeUnsplashUrl(url: string): string {
  if (!url.includes('images.unsplash.com')) return url
  try {
    const parsed = new URL(url)
    // Switch from fixed format to auto-format (browser-negotiated AVIF/WebP)
    if (parsed.searchParams.has('fm')) {
      parsed.searchParams.delete('fm')
      parsed.searchParams.set('auto', 'format')
    }
    // Reduce width if over 1080
    const w = parseInt(parsed.searchParams.get('w') || '0')
    if (w > 1080) {
      parsed.searchParams.set('w', '1080')
    }
    // Reduce quality if over 75
    const q = parseInt(parsed.searchParams.get('q') || '0')
    if (q > 75) {
      parsed.searchParams.set('q', '75')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * 이미지 attribution (저작권 표시)
 */
export function getImageAttribution(image: UnsplashImage): string {
  return `Photo by <a href="${image.links.html}?utm_source=seo_blog_template&utm_medium=referral">${image.user.name}</a> on <a href="https://unsplash.com?utm_source=seo_blog_template&utm_medium=referral">Unsplash</a>`
}

/**
 * Alt text 생성
 */
export function generateAltText(image: UnsplashImage, fallback: string): string {
  return image.alt_description || image.description || fallback
}
