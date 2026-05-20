'use client'

import { useState, useEffect } from 'react'

function getAdminPasswordOrPrompt(): string | null {
  let password = sessionStorage.getItem('admin_password')
  if (!password) {
    const input = prompt('Admin 비밀번호를 입력하세요:')
    if (!input) return null
    sessionStorage.setItem('admin_password', input)
    password = input
  }
  return password
}

export default function AdminSettingsPage() {
  const [faviconUrl, setFaviconUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [unsplashKey, setUnsplashKey] = useState('')
  const [unsplashConfigured, setUnsplashConfigured] = useState(false)
  const [savingUnsplash, setSavingUnsplash] = useState(false)
  const [defaultAuthor, setDefaultAuthor] = useState('')
  const [savingAuthor, setSavingAuthor] = useState(false)

  useEffect(() => {
    const password = getAdminPasswordOrPrompt()
    if (!password) return
    const auth = `?password=${encodeURIComponent(password)}`

    // Load current settings
    fetch(`/api/admin/settings${auth}`)
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          if (data.settings.SITE_FAVICON_URL?.isConfigured) {
            setFaviconUrl(data.settings.SITE_FAVICON_URL.masked || '(설정됨)')
          }
          if (data.settings.SITE_META_DESCRIPTION?.isConfigured) {
            // For meta description we want full value, not masked
            // We'll load it separately
          }
          if (data.settings.SITE_LOGO_URL?.isConfigured) {
            setLogoUrl(data.settings.SITE_LOGO_URL.masked || '(설정됨)')
          }
          if (data.settings.UNSPLASH_ACCESS_KEY?.isConfigured) {
            setUnsplashConfigured(true)
            setUnsplashKey(data.settings.UNSPLASH_ACCESS_KEY.masked || '(설정됨)')
          }
        }
      })
      .catch(() => {})

    // Load meta description full value
    fetch(`/api/admin/settings/meta-description${auth}`)
      .then(res => res.json())
      .then(data => {
        if (data.value) setMetaDescription(data.value)
      })
      .catch(() => {})

    // Load default author full value (not sensitive — show plain text)
    fetch(`/api/admin/settings/default-author${auth}`)
      .then(res => res.json())
      .then(data => {
        if (data.value) setDefaultAuthor(data.value)
      })
      .catch(() => {})
  }, [])

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage('')

    try {
      const password = getAdminPasswordOrPrompt()
      if (!password) { setUploading(false); return }
      const formData = new FormData()
      formData.append('favicon', file)

      const res = await fetch(`/api/admin/upload-favicon?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(`오류: ${data.error}`)
        return
      }

      setFaviconUrl(data.url)
      setMessage('Favicon이 업로드되었습니다.')
    } catch {
      setMessage('업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    setMessage('')

    try {
      const password = getAdminPasswordOrPrompt()
      if (!password) { setUploadingLogo(false); return }
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch(`/api/admin/upload-logo?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(`오류: ${data.error}`)
        return
      }

      setLogoUrl(data.url)
      setMessage('로고가 업로드되었습니다.')
    } catch {
      setMessage('업로드 실패')
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSaveUnsplash() {
    if (!unsplashKey.trim() || unsplashKey.startsWith('(') || unsplashKey.includes('••••')) {
      setMessage('새 Unsplash Access Key를 입력하세요.')
      return
    }
    setSavingUnsplash(true)
    setMessage('')
    try {
      const password = getAdminPasswordOrPrompt()
      if (!password) { setSavingUnsplash(false); return }
      const res = await fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ UNSPLASH_ACCESS_KEY: unsplashKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(`오류: ${data.error || '저장 실패'}`)
        return
      }
      setMessage('Unsplash Access Key가 저장되었습니다.')
      setUnsplashConfigured(true)
      // 보안상 입력 후 마스킹 표시
      const masked = unsplashKey.length > 8
        ? unsplashKey.slice(0, 4) + '••••' + unsplashKey.slice(-4)
        : '••••••••'
      setUnsplashKey(masked)
    } catch {
      setMessage('저장 실패')
    } finally {
      setSavingUnsplash(false)
    }
  }

  async function handleSaveDefaultAuthor() {
    const trimmed = defaultAuthor.trim()
    if (!trimmed) {
      setMessage('작성자 이름을 입력하세요.')
      return
    }
    setSavingAuthor(true)
    setMessage('')
    try {
      const password = getAdminPasswordOrPrompt()
      if (!password) { setSavingAuthor(false); return }
      const res = await fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ DEFAULT_POST_AUTHOR: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(`오류: ${data.error || '저장 실패'}`)
        return
      }
      setMessage('기본 작성자 이름이 저장되었습니다.')
    } catch {
      setMessage('저장 실패')
    } finally {
      setSavingAuthor(false)
    }
  }

  async function handleSaveDescription() {
    setSaving(true)
    setMessage('')

    try {
      const password = getAdminPasswordOrPrompt()
      if (!password) { setSaving(false); return }
      const res = await fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          SITE_META_DESCRIPTION: metaDescription,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(`오류: ${data.error}`)
        return
      }

      setMessage('Meta description이 저장되었습니다.')
    } catch {
      setMessage('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">사이트 설정</h1>

        {message && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${
            message.startsWith('오류') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {message}
          </div>
        )}

        {/* Favicon Section */}
        <section className="mb-8 pb-8 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Favicon</h2>
          <p className="text-sm text-gray-500 mb-4">
            브라우저 탭에 표시되는 아이콘입니다. PNG, SVG, ICO, WebP 파일을 업로드하세요 (최대 1MB).
          </p>

          <div className="flex items-start gap-4">
            {faviconUrl && !faviconUrl.startsWith('(') && (
              <div className="flex-shrink-0">
                <img
                  src={faviconUrl}
                  alt="Current favicon"
                  className="w-16 h-16 rounded border border-gray-200 object-contain bg-gray-50"
                />
              </div>
            )}
            <div>
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                {uploading ? '업로드 중...' : 'Favicon 업로드'}
                <input
                  type="file"
                  accept="image/png,image/svg+xml,image/x-icon,image/jpeg,image/webp"
                  onChange={handleFaviconUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {faviconUrl && (
                <p className="mt-2 text-xs text-gray-500 break-all max-w-md">
                  {faviconUrl}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Logo Section */}
        <section className="mb-8 pb-8 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">로고</h2>
          <p className="text-sm text-gray-500 mb-4">
            사이트 헤더에 표시되는 로고 이미지입니다. PNG, JPEG, SVG, WebP 파일을 업로드하세요 (최대 2MB).
          </p>

          <div className="flex items-start gap-4">
            {logoUrl && !logoUrl.startsWith('(') && (
              <div className="flex-shrink-0">
                <img
                  src={logoUrl}
                  alt="Current logo"
                  className="h-16 max-w-[200px] rounded border border-gray-200 object-contain bg-gray-50 p-1"
                />
              </div>
            )}
            <div>
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                {uploadingLogo ? '업로드 중...' : '로고 업로드'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
              {logoUrl && (
                <p className="mt-2 text-xs text-gray-500 break-all max-w-md">
                  {logoUrl}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Unsplash Access Key Section */}
        <section className="mb-8 pb-8 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unsplash Access Key</h2>
          <p className="text-sm text-gray-500 mb-4">
            글 썸네일을 Unsplash에서 자동으로 가져옵니다.{' '}
            <a
              href="https://unsplash.com/oauth/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Unsplash Developers
            </a>
            에서 무료로 발급받을 수 있습니다.
          </p>
          <div className="flex items-start gap-3">
            <input
              type="text"
              value={unsplashKey}
              onChange={(e) => setUnsplashKey(e.target.value)}
              placeholder={unsplashConfigured ? '(설정됨 — 새 값으로 교체하려면 붙여넣기)' : 'Unsplash Access Key 입력'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
            />
            <button
              onClick={handleSaveUnsplash}
              disabled={savingUnsplash}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {savingUnsplash ? '저장 중...' : '저장'}
            </button>
          </div>
          {unsplashConfigured && (
            <p className="mt-2 text-xs text-green-600">
              ✓ 설정 완료 — 새 글 생성 시 Unsplash 썸네일이 자동 적용됩니다.
            </p>
          )}
        </section>

        {/* Default Post Author Section */}
        <section className="mb-8 pb-8 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">기본 작성자 이름</h2>
          <p className="text-sm text-gray-500 mb-4">
            글 하단에 &quot;By [이름]&quot; 으로 표시됩니다. AI가 자동 생성한 글, 직접 작성한 글 모두에 적용됩니다.
            기본값은 <span className="font-mono">콜Cole</span> 입니다.
          </p>
          <div className="flex items-start gap-3">
            <input
              type="text"
              value={defaultAuthor}
              onChange={(e) => setDefaultAuthor(e.target.value)}
              placeholder="콜Cole"
              maxLength={40}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <button
              onClick={handleSaveDefaultAuthor}
              disabled={savingAuthor}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {savingAuthor ? '저장 중...' : '저장'}
            </button>
          </div>
        </section>

        {/* Meta Description Section */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Meta Description</h2>
          <p className="text-sm text-gray-500 mb-4">
            검색 엔진 결과에 표시되는 사이트 설명입니다. SEO에 중요한 요소입니다.
          </p>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="사이트에 대한 설명을 입력하세요..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {metaDescription.length}/160자 (권장)
            </span>
            <button
              onClick={handleSaveDescription}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
