'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CornerstoneItem {
  id: string
  title: string
  slug: string
  status: 'DRAFT' | 'PUBLISHED'
  publishedAt: string | null
  createdAt: string
  coverImage: string | null
  views: number
  spokeCount: number
}

export default function CornerstoneListPage() {
  const [items, setItems] = useState<CornerstoneItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchList = async () => {
    try {
      const res = await fetch('/api/admin/cornerstone')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setItems(data)
    } catch (err) {
      console.error('Cornerstone list fetch failed', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">코너스톤 관리</h1>
          <p className="text-sm text-gray-600 mt-1">
            기존 글 3~20개를 묶어 5,000~8,000자 종합 가이드를 자동 생성합니다.
            발행 시 source 글들에 자동으로 링크 박스가 삽입됩니다.
          </p>
        </div>
        <Link
          href="/admin/cornerstone/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm whitespace-nowrap"
        >
          + 새 코너스톤 생성
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      ) : items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-2">아직 생성된 코너스톤이 없습니다.</p>
          <p className="text-sm text-gray-400">
            발행된 글이 20편 이상 쌓인 후 같은 주제 여러 편(3~20개)을 묶어 만드는 것이 효과적입니다.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제목</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">묶인 글</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">발행일</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    <Link href={`/posts/${c.slug}`} className="hover:text-blue-600" target="_blank">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {c.status === 'PUBLISHED' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        발행됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.spokeCount}편</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.publishedAt
                      ? new Date(c.publishedAt).toLocaleDateString('ko-KR')
                      : new Date(c.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right space-x-2">
                    <Link href={`/admin/edit/${c.id}`} className="text-blue-600 hover:text-blue-800">편집</Link>
                    {c.status === 'DRAFT' && (
                      <PublishButton id={c.id} onPublished={fetchList} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PublishButton({ id, onPublished }: { id: string; onPublished: () => void }) {
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    if (!confirm('이 코너스톤을 발행하면 묶인 source 글들의 본문 끝에 자동으로 링크 박스가 삽입됩니다. 진행할까요?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cornerstone/${id}/publish`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '발행 실패')
      }
      const data = await res.json()
      const spokeCount = data?.data?.spokeCount ?? data?.spokeCount ?? 0
      alert(`발행 완료. ${spokeCount}개 source 글에 링크 박스가 삽입되었습니다.`)
      onPublished()
    } catch (err) {
      alert(err instanceof Error ? err.message : '발행 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-green-600 hover:text-green-800 disabled:opacity-50"
    >
      {loading ? '발행 중...' : '발행'}
    </button>
  )
}
