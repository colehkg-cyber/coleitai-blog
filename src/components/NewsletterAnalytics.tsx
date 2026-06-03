'use client'

import { trackNewsletterSignup } from './GoogleAnalytics'

interface NewsletterAnalyticsProps {
  children: React.ReactNode
  onSubmit?: (email: string) => void
}

export default function NewsletterAnalytics({ children, onSubmit }: NewsletterAnalyticsProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    
    if (email) {
      // Track newsletter signup
      trackNewsletterSignup(email)
      
      // Call parent onSubmit handler if provided
      if (onSubmit) {
        onSubmit(email)
      }
      
      // Show success message (you can customize this)
      alert('Thanks for subscribing! We\'ll be in touch soon.')
      
      // Reset form
      e.currentTarget.reset()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      {...({
        toolname: 'subscribe_newsletter',
        tooldescription: '이메일 주소를 뉴스레터 구독 목록에 추가합니다. children으로 전달되는 input은 name="email"이어야 합니다.',
      } as Record<string, string>)}
    >
      {children}
    </form>
  )
}