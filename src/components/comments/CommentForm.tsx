'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CommentFormProps {
  postSlug: string
  parentId?: string | null
  onSuccess?: () => void
  onCancel?: () => void
  locale?: string
}

export default function CommentForm({ postSlug, parentId, onSuccess, onCancel, locale = 'ko' }: CommentFormProps) {
  const isEnglish = locale === 'en'
  const router = useRouter()
  const [formData, setFormData] = useState({
    authorName: '',
    content: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/posts/${postSlug}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          parentId,
        }),
      })

      if (!response.ok) {
        throw new Error(isEnglish ? 'Failed to post comment.' : '댓글 작성에 실패했습니다.')
      }

      // 폼 초기화
      setFormData({
        authorName: '',
        content: '',
      })

      // 성공 콜백
      if (onSuccess) {
        onSuccess()
      }

      // 페이지 새로고침
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : (isEnglish ? 'Failed to post comment.' : '댓글 작성에 실패했습니다.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      {...({
        toolname: 'add_comment',
        tooldescription: '현재 글에 댓글을 작성합니다. 부모 댓글 ID가 있으면 답글로 등록됩니다.',
      } as Record<string, string>)}
    >
      <div>
        <label htmlFor="authorName" className="block text-sm font-medium text-gray-700 mb-1">
          {isEnglish ? 'Nickname' : '닉네임'} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="authorName"
          name="authorName"
          required
          value={formData.authorName}
          onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={isEnglish ? "Your nickname" : "닉네임을 입력하세요"}
          {...({
            toolparamdescription: '댓글 작성자 표시 이름(닉네임).',
          } as Record<string, string>)}
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          {isEnglish ? 'Comment' : '댓글 내용'} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={4}
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={isEnglish ? "Leave your comment..." : "의견을 남겨주세요..."}
          {...({
            toolparamdescription: '댓글 본문 텍스트. 줄바꿈 가능.',
          } as Record<string, string>)}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (isEnglish ? 'Posting...' : '작성 중...') : (isEnglish ? 'Post Comment' : '댓글 작성')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            {isEnglish ? 'Cancel' : '취소'}
          </button>
        )}
      </div>
    </form>
  )
}