'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Verify password by making a test API call
      const response = await fetch(`/api/admin/posts?password=${encodeURIComponent(password)}&limit=1`)

      if (response.ok) {
        // Store password in sessionStorage
        sessionStorage.setItem('admin_password', password)
        router.push('/admin')
      } else if (response.status === 401) {
        setError('비밀번호가 올바르지 않습니다.')
      } else {
        setError('서버 오류가 발생했습니다. 다시 시도해주세요.')
      }
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            관리자 로그인
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            관리자 비밀번호를 입력하세요
          </p>
        </div>
        <form
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
          {...({
            toolname: 'admin_login',
            tooldescription: '관리자 비밀번호로 로그인하여 글 작성·수정 페이지에 접근합니다.',
          } as Record<string, string>)}
        >
          <div>
            <label htmlFor="password" className="sr-only">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="비밀번호"
              {...({
                toolparamdescription: '관리자 비밀번호. 환경변수 ADMIN_PASSWORD와 일치해야 합니다.',
              } as Record<string, string>)}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? '확인 중...' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
