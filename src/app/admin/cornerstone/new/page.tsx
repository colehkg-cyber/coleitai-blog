'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PostListItem {
  id: string
  title: string
  slug: string
  status: 'DRAFT' | 'PUBLISHED'
  publishedAt: string | null
  views: number
  tags: string
}

const MIN_PICK = 3
const MAX_PICK = 20

export default function NewCornerstonePage() {
  const router = useRouter()
  const [posts, setPosts] = useState<PostListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mainKeyword, setMainKeyword] = useState('')
  const [targetTitle, setTargetTitle] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch('/api/admin/posts?orderBy=publishedAt&order=desc')
        if (!res.ok) throw new Error('Failed to fetch posts')
        const data = await res.json()
        // 발행된 글만 코너스톤 source 후보
        setPosts((data || []).filter((p: PostListItem) => p.status === 'PUBLISHED'))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    posts.forEach((p) =>
      (p.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => tagSet.add(t))
    )
    return Array.from(tagSet).sort()
  }, [posts])

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false
      if (tagFilter && !(p.tags || '').includes(tagFilter)) return false
      return true
    })
  }, [posts, search, tagFilter])

  const togglePost = (id: string) => {
    setSelectedIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= MAX_PICK) {
        alert(`최대 ${MAX_PICK}개까지 선택 가능합니다.`)
        return cur
      }
      return [...cur, id]
    })
  }

  const canGenerate =
    selectedIds.length >= MIN_PICK &&
    selectedIds.length <= MAX_PICK &&
    mainKeyword.trim().length >= 2

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/cornerstone/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePostIds: selectedIds,
          mainKeyword: mainKeyword.trim(),
          targetTitle: targetTitle.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '생성 실패')

      const id = data?.data?.id || data?.id
      if (!id) throw new Error('생성된 글 ID를 받지 못했습니다.')

      alert('코너스톤 초안이 생성되었습니다. 편집 화면에서 검토 후 발행하세요.')
      router.push(`/admin/edit/${id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '생성 실패')
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">새 코너스톤 생성</h1>
        <p className="text-sm text-gray-600 mt-1">
          기존 발행 글 {MIN_PICK}~{MAX_PICK}개를 묶어 종합 가이드를 자동 생성합니다.
        </p>
      </div>

      {/* Step 1: 키워드 + 제목 */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">1. 메인 키워드 & 제목</h2>
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            메인 키워드 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={mainKeyword}
            onChange={(e) => setMainKeyword(e.target.value)}
            placeholder="예: 재택근무"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            목표 제목 <span className="text-gray-400">(선택, AI가 자동 생성)</span>
          </label>
          <input
            type="text"
            value={targetTitle}
            onChange={(e) => setTargetTitle(e.target.value)}
            placeholder="예: 재택근무 완벽 가이드"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Step 2: 글 선택 */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            2. Source 글 선택 ({selectedIds.length}/{MAX_PICK})
          </h2>
          <span className="text-xs text-gray-500">
            {MIN_PICK}~{MAX_PICK}개 선택 필수
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목 검색..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">전체 태그</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">조건에 맞는 발행 글이 없습니다.</p>
        ) : (
          <div className="border border-gray-200 rounded-md max-h-96 overflow-y-auto">
            {filtered.map((post) => {
              const checked = selectedIds.includes(post.id)
              return (
                <label
                  key={post.id}
                  className={`flex items-start gap-3 p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    checked ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePost(post.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{post.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {post.tags || '태그 없음'}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Step 3: 생성 버튼 */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <div className="text-sm text-gray-600">
          {!canGenerate && (
            <ul className="space-y-1">
              {selectedIds.length < MIN_PICK && (
                <li className="text-red-500">
                  ❗ {MIN_PICK - selectedIds.length}개 더 선택해주세요
                </li>
              )}
              {!mainKeyword.trim() && <li className="text-red-500">❗ 메인 키워드 입력 필수</li>}
            </ul>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {generating ? '생성 중... (30~60초 소요)' : 'AI로 코너스톤 초안 생성'}
        </button>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-3">
        <strong>📌 생성 흐름:</strong> AI가 선택한 글들을 종합 → 5,000~8,000자 코너스톤 초안 작성
        → DRAFT 상태로 저장 → 편집 화면으로 이동. 검토 후 [발행] 클릭 시 source 글들에 자동으로 링크
        박스가 삽입됩니다.
      </div>
    </div>
  )
}
