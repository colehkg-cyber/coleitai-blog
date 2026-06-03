'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import '@uiw/react-md-editor/markdown-editor.css'

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
)

interface PostEditorProps {
  initialData?: {
    title: string
    slug: string
    content: string
    excerpt?: string
    coverImage?: string
    tags?: string[]
    seoTitle?: string
    seoDescription?: string
    publishedAt?: string | null
  }
  onSubmit: (data: {
    title: string
    slug: string
    content: string
    excerpt: string
    coverImage: string
    tags: string[]
    seoTitle: string
    seoDescription: string
    publishedAt: string | null
  }) => Promise<void>
  isEdit?: boolean
}

export default function PostEditor({ initialData, onSubmit, isEdit = false }: PostEditorProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    content: initialData?.content || '',
    excerpt: initialData?.excerpt || '',
    coverImage: initialData?.coverImage || '',
    tags: initialData?.tags?.join(', ') || '',
    seoTitle: initialData?.seoTitle || '',
    seoDescription: initialData?.seoDescription || '',
    publishedAt: initialData?.publishedAt || null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // AI 생성 상태
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiKeywords, setAiKeywords] = useState('')
  const [aiDraftOutline, setAiDraftOutline] = useState('')
  const [coupangLink, setCoupangLink] = useState('')
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onSubmit({
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      })
    } catch (error) {
      console.error('Error submitting:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateSlug = () => {
    const slug = formData.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    setFormData({ ...formData, slug })
  }

  const generateWithAI = async () => {
    if (!aiPrompt) return

    setGenerationStatus('generating')
    setErrorMessage('')
    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          keywords: aiKeywords.split(',').map(k => k.trim()).filter(Boolean),
          draftOutline: aiDraftOutline || undefined,
          coupangLink: coupangLink || undefined,
        }),
      })

      const raw = await response.json()
      // withErrorHandler wraps in { success, data } format
      const data = raw.data || raw

      if (!response.ok) {
        const msg = raw.message || raw.error || '알 수 없는 오류가 발생했습니다.'
        throw new Error(msg)
      }

      if (data.title) {
        setFormData({
          ...formData,
          title: data.title || formData.title,
          slug: data.slug || formData.slug,
          content: data.content || '',
          excerpt: data.excerpt || formData.excerpt,
          tags: data.tags?.join(', ') || formData.tags,
          seoTitle: data.seoTitle || data.title || formData.seoTitle,
          seoDescription: data.seoDescription || data.excerpt || formData.seoDescription,
        })
      } else if (data.content) {
        setFormData({ ...formData, content: data.content })
      }

      setGenerationStatus('success')
    } catch (error) {
      console.error('Error generating content:', error)
      setGenerationStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'AI 콘텐츠 생성에 실패했습니다. 다시 시도해주세요.'
      )
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      {...({
        toolname: isEdit ? 'update_post' : 'create_post',
        tooldescription: isEdit
          ? '기존 글의 제목·본문·태그·SEO 메타 등을 수정합니다. 슬러그는 그대로 두는 것을 권장.'
          : '새 블로그 글을 작성합니다. 제목·슬러그·본문이 필수이며, 발행 체크박스를 켜면 즉시 공개됩니다.',
      } as Record<string, string>)}
    >
      {/* AI 콘텐츠 생성 섹션 */}
      <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <h3 className="text-lg font-bold text-indigo-900">AI 콘텐츠 생성</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="ai-keywords" className="block text-sm font-medium text-gray-700">
              타겟 키워드 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="ai-keywords"
              placeholder="예: nextjs 15, app router, react 19"
              value={aiKeywords}
              onChange={(e) => setAiKeywords(e.target.value)}
              disabled={generationStatus === 'generating'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="ai-topic" className="block text-sm font-medium text-gray-700">
              주제 / 제목 방향 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="ai-topic"
              placeholder="예: Next.js 15 새로운 기능 정리 — 실무자가 알아야 할 핵심"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={generationStatus === 'generating'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="ai-outline" className="block text-sm font-medium text-gray-700">
              초안 / 개요 (선택)
            </label>
            <textarea
              id="ai-outline"
              rows={3}
              placeholder="글의 방향이나 포함할 내용을 적어주세요. 예: 1. 서론 - 왜 업그레이드해야 하는지  2. 핵심 변경점 3가지  3. 마이그레이션 팁"
              value={aiDraftOutline}
              onChange={(e) => setAiDraftOutline(e.target.value)}
              disabled={generationStatus === 'generating'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="coupang-link" className="block text-sm font-medium text-gray-700">
              쿠팡 파트너스 링크 또는 HTML (선택)
            </label>
            <textarea
              id="coupang-link"
              rows={3}
              placeholder={'예: https://coupa.ng/xxxx 또는 <iframe src="https://coupa.ng/xxxx" width="120" height="240" ...></iframe>'}
              value={coupangLink}
              onChange={(e) => setCoupangLink(e.target.value)}
              disabled={generationStatus === 'generating'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              입력하면 상품 리뷰형 글로 생성되고, 글 마지막에 쿠팡 파트너스 고지문이 자동으로 추가됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={generateWithAI}
            disabled={generationStatus === 'generating' || !aiPrompt}
            className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 border border-transparent text-sm font-bold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          >
            {generationStatus === 'generating' ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                AI 콘텐츠 생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                글 생성하기
              </>
            )}
          </button>

          {generationStatus === 'success' && (
            <p className="text-sm text-green-600 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              생성 완료! 아래에서 내용을 확인하고 수정하세요.
            </p>
          )}

          {generationStatus === 'error' && errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}
        </div>
      </div>

      {/* 콘텐츠 편집 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">콘텐츠 편집</h3>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            제목
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            {...({
              toolparamdescription: '글 제목. 60자 이내, 핵심 키워드를 앞쪽에 배치하는 것을 권장.',
            } as Record<string, string>)}
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
            슬러그 (URL)
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              id="slug"
              name="slug"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="block w-full rounded-none rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              {...({
                toolparamdescription: 'URL 슬러그(a-z, 0-9, 하이픈). 영문 소문자 3~6단어, 60자 이내.',
              } as Record<string, string>)}
            />
            <button
              type="button"
              onClick={generateSlug}
              className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 hover:bg-gray-100"
            >
              자동 생성
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700">
            요약
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={2}
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            {...({
              toolparamdescription: '글 요약(2~3문장, 160자 이내). 메타 description의 fallback으로도 쓰임.',
            } as Record<string, string>)}
          />
        </div>

        <div>
          <label htmlFor="coverImage" className="block text-sm font-medium text-gray-700">
            커버 이미지
          </label>
          <div className="mt-1 space-y-2">
            <input
              type="url"
              id="coverImage"
              name="coverImage"
              placeholder="이미지 URL을 입력하거나 아래에서 파일을 업로드하세요"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              {...({
                toolparamdescription: '커버 이미지의 절대 URL(https). 비워두면 OG 기본 이미지 사용.',
              } as Record<string, string>)}
            />

            <div className="flex items-center space-x-4">
              <label className="block">
                <span className="sr-only">이미지 파일 선택</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    const uploadFormData = new FormData()
                    uploadFormData.append('image', file)
                    uploadFormData.append('postId', 'temp-' + Date.now())

                    try {
                      const response = await fetch('/api/admin/upload-image', {
                        method: 'POST',
                        body: uploadFormData
                      })

                      if (response.ok) {
                        const { imageUrl } = await response.json()
                        setFormData(prev => ({ ...prev, coverImage: imageUrl }))
                      }
                    } catch (error) {
                      console.error('Image upload failed:', error)
                    }
                  }}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100"
                />
              </label>

              {formData.coverImage && (
                <div className="relative w-20 h-20">
                  <img
                    src={formData.coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, coverImage: '' })}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            본문
          </label>
          <MDEditor
            value={formData.content}
            onChange={(val) => setFormData({ ...formData, content: val || '' })}
            height={400}
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            태그 (쉼표로 구분)
          </label>
          <input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            {...({
              toolparamdescription: '쉼표로 구분된 태그 목록. 예: "Next.js, React, Vercel".',
            } as Record<string, string>)}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* SEO 제목: 50~60자 권장 (구글 검색 결과 잘림 방지) */}
          {(() => {
            const titleLen = formData.seoTitle.length
            const titleStatus =
              titleLen === 0 ? 'gray' :
              titleLen < 50 ? 'yellow' :
              titleLen <= 60 ? 'green' :
              titleLen <= 70 ? 'yellow' : 'red'
            const titleColorClass = {
              gray: 'text-gray-400',
              yellow: 'text-yellow-600',
              green: 'text-green-600',
              red: 'text-red-600',
            }[titleStatus]
            const titleHint = {
              gray: '권장 50~60자',
              yellow: titleLen < 50 ? `${50 - titleLen}자 더` : `${titleLen - 60}자 초과 (60자 권장)`,
              green: '최적',
              red: '검색 결과에서 잘림',
            }[titleStatus]
            return (
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="seoTitle" className="block text-sm font-medium text-gray-700">
                    SEO 제목
                  </label>
                  <span className={`text-xs ${titleColorClass}`}>
                    {titleLen}자 · {titleHint}
                  </span>
                </div>
                <input
                  type="text"
                  id="seoTitle"
                  name="seoTitle"
                  value={formData.seoTitle}
                  onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                  maxLength={70}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  {...({
                    toolparamdescription: 'meta title용 SEO 제목(50~60자 권장, 70자 한도). 비우면 글 제목 사용.',
                  } as Record<string, string>)}
                />
              </div>
            )
          })()}

          {/* SEO 설명: 150~160자 권장 (모바일·데스크탑 모두 안전한 범위) */}
          {(() => {
            const descLen = formData.seoDescription.length
            const descStatus =
              descLen === 0 ? 'gray' :
              descLen < 150 ? 'yellow' :
              descLen <= 160 ? 'green' :
              descLen <= 200 ? 'yellow' : 'red'
            const descColorClass = {
              gray: 'text-gray-400',
              yellow: 'text-yellow-600',
              green: 'text-green-600',
              red: 'text-red-600',
            }[descStatus]
            const descHint = {
              gray: '권장 150~160자',
              yellow: descLen < 150 ? `${150 - descLen}자 더` : `${descLen - 160}자 초과 (160자 권장)`,
              green: '최적',
              red: '검색 결과에서 잘림',
            }[descStatus]
            return (
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="seoDescription" className="block text-sm font-medium text-gray-700">
                    SEO 설명
                  </label>
                  <span className={`text-xs ${descColorClass}`}>
                    {descLen}자 · {descHint}
                  </span>
                </div>
                <input
                  type="text"
                  id="seoDescription"
                  name="seoDescription"
                  value={formData.seoDescription}
                  onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                  maxLength={200}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  {...({
                    toolparamdescription: 'meta description용 SEO 설명(150~160자 권장, 200자 한도).',
                  } as Record<string, string>)}
                />
              </div>
            )
          })()}
        </div>
      </div>

      <div className="flex justify-between">
        <label className="flex items-center">
          <input
            type="checkbox"
            name="publishNow"
            checked={!!formData.publishedAt}
            onChange={(e) => setFormData({
              ...formData,
              publishedAt: e.target.checked ? new Date().toISOString() : null
            })}
            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            {...({
              toolparamdescription: '체크하면 저장 즉시 발행. 미체크 시 초안(DRAFT)으로 저장.',
            } as Record<string, string>)}
          />
          <span className="ml-2 text-sm text-gray-700">바로 발행하기</span>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : isEdit ? '수정 완료' : '글 저장'}
        </button>
      </div>
    </form>
  )
}
