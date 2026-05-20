import { brandConfig, navigationConfig } from '@/config'
import SiteHeader from '@/components/SiteHeader'

interface PageLayoutProps {
  locale: string
  currentPath: string
  children: React.ReactNode
}

export default function PageLayout({ locale, currentPath, children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader
        currentPath={currentPath}
        locale={locale as keyof typeof navigationConfig}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            &copy; {brandConfig.copyright.startYear} {brandConfig.copyright.holder}
          </div>
        </div>
      </footer>
    </div>
  )
}