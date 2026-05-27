import Link from 'next/link'
import { brandConfig, navigationConfig } from '@/config'

interface SiteHeaderProps {
  /** 현재 경로 — 네비 active 상태 표시용. 미지정 시 '/' 로 가정 */
  currentPath?: string
  /** locale 키 (default 'ko') */
  locale?: keyof typeof navigationConfig
}

/**
 * 사이트 공통 헤더.
 * 모든 페이지(홈/글 상세/아카이브/sub-page)가 이 컴포넌트를 사용한다.
 *
 * 🎨 색을 바꾸려면 → src/config/brand.config.ts 의 `header` 값만 수정하세요.
 *    (예: 배경 '#1e3a8a' 남색 + 글자 '#ffffff' 흰색)
 *    이 컴포넌트 한 곳이 모든 페이지 헤더에 반영됩니다.
 */
export default function SiteHeader({
  currentPath = '/',
  locale = 'ko',
}: SiteHeaderProps) {
  const items = navigationConfig[locale] ?? navigationConfig.ko
  const { background, text } = brandConfig.header

  return (
    <header style={{ backgroundColor: background, color: text }} className="border-b border-black/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 로고 */}
        <div className="flex justify-between items-center py-8">
          <a href={brandConfig.logo.url || '/'} className="flex items-center" style={{ color: text }}>
            {brandConfig.logo.image ? (
              <img
                src={brandConfig.logo.image}
                alt={brandConfig.logo.text}
                className="h-6 w-auto"
              />
            ) : (
              <span className="text-2xl font-bold tracking-tight">{brandConfig.logo.text}</span>
            )}
          </a>
        </div>

        {/* 네비게이션 */}
        <nav
          className="flex justify-center items-center gap-6 pb-4"
          aria-label="Main navigation"
        >
          {items.map((item) => {
            const isActive = currentPath === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ color: text, opacity: isActive ? 1 : 0.7 }}
                className={`text-sm font-medium pb-2 transition-opacity hover:opacity-100 ${
                  isActive ? 'border-b-2 border-current' : ''
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
