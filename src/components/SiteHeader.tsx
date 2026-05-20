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
 * 헤더 디자인을 바꾸려면 이 파일만 수정하면 모든 페이지에 반영된다.
 */
export default function SiteHeader({
  currentPath = '/',
  locale = 'ko',
}: SiteHeaderProps) {
  const items = navigationConfig[locale] ?? navigationConfig.ko

  return (
    <header className="border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-8">
          <a href={brandConfig.logo.url || '/'} className="flex items-center">
            {brandConfig.logo.image ? (
              <img
                src={brandConfig.logo.image}
                alt={brandConfig.logo.text}
                className="h-6 w-auto"
              />
            ) : (
              <span className="logo-text">{brandConfig.logo.text}</span>
            )}
          </a>
        </div>
        <nav
          className="flex justify-center items-center gap-6 pb-4"
          aria-label="Main navigation"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium pb-2 transition-colors ${
                currentPath === item.href
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
