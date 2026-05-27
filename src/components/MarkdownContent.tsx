// PERF-CRITICAL: This MUST remain a Server Component (no 'use client').
// react-markdown/remark-gfm/rehype-raw run on server only, reducing client JS by ~100KB.
// Adding 'use client' would cause Lighthouse Performance regression (TBT +400ms).
import React from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSectionWrap from '@/lib/rehype-section-wrap'
import LazyImage from './LazyImage'
import type { Components } from 'react-markdown'
import { unwrapContent, cleanMarkdownHeadings } from '@/lib/utils/content'
import { COUPANG_DISCLAIMER_TEXT, COUPANG_DISCLAIMER_MARKDOWN } from '@/lib/coupang'

const CodeBlock = dynamic(() => import('./CodeBlock'), {
  loading: () => <code style={{ display: 'block', padding: '1rem', backgroundColor: '#1f2937', color: '#f3f4f6', borderRadius: '0.5rem', fontSize: '0.875rem', overflow: 'auto' }}>Loading...</code>,
})

interface MarkdownContentProps {
  content: string
}

function childrenToString(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToString).join('')
  return ''
}

function hasCoupangContent(text: string): boolean {
  return /coupa\.ng|coupang\.com|ads-partners\.coupang/i.test(text)
}

export default function MarkdownContent({ content: rawContent }: MarkdownContentProps) {
  // Final defense: unwrap JSON-wrapped content and clean heading prefixes
  let content = cleanMarkdownHeadings(unwrapContent(rawContent))

  // Auto-append Coupang disclaimer if content has Coupang links/iframes but no disclaimer
  if (hasCoupangContent(content) && !content.includes(COUPANG_DISCLAIMER_TEXT)) {
    content = content + COUPANG_DISCLAIMER_MARKDOWN
  }
  const createHeadingId = (text: React.ReactNode) => {
    const textString = childrenToString(text)
    // Use only text content for ID to ensure consistency between server and client
    return textString.toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-+|-+$/g, '')
  }
  
  return (
    <div style={{ maxWidth: '65ch', margin: '0 auto' }}>
      <ReactMarkdown 
        remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
        rehypePlugins={[rehypeRaw, rehypeSectionWrap]}
        components={{
          h1: ({children}) => {
            const id = createHeadingId(children)
            return <h1 id={id} style={{fontSize: '2.25rem', fontWeight: 700, marginTop: '2rem', marginBottom: '1rem', lineHeight: 1.2}}>{children}</h1>
          },
          h2: ({children}) => {
            const id = createHeadingId(children)
            return <h2 id={id} style={{fontSize: '1.875rem', fontWeight: 600, marginTop: '1.75rem', marginBottom: '0.75rem', lineHeight: 1.3}}>{children}</h2>
          },
          h3: ({children}) => {
            const id = createHeadingId(children)
            return <h3 id={id} style={{fontSize: '1.5rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem', lineHeight: 1.3}}>{children}</h3>
          },
          p: ({children}) => <p style={{marginBottom: '1.25rem', lineHeight: 1.75}}>{children}</p>,
          strong: ({children}) => <strong style={{fontWeight: 700}}>{children}</strong>,
          em: ({children}) => <em style={{fontStyle: 'italic'}}>{children}</em>,
          ul: ({children}) => <ul style={{listStyleType: 'disc', marginBottom: '1.25rem', paddingLeft: '1.5rem'}}>{children}</ul>,
          ol: ({children}) => <ol style={{listStyleType: 'decimal', marginBottom: '1.25rem', paddingLeft: '1.5rem'}}>{children}</ol>,
          li: ({children}) => <li style={{marginBottom: '0.5rem', lineHeight: 1.75}}>{children}</li>,
          input: ({type, checked}) => {
            // GFM 작업 목록(- [ ] / - [x])의 체크박스는 비활성·장식용이다.
            // 라벨이 없어 Lighthouse 접근성 "form elements do not have associated labels"
            // 경고가 뜨므로, 접근성 트리에서 숨기고(aria-hidden) 포커스 대상에서 제외한다.
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={!!checked}
                  readOnly
                  disabled
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{marginRight: '0.5rem'}}
                />
              )
            }
            return <input type={type} />
          },
          blockquote: ({children}) => <blockquote style={{borderLeft: '4px solid #e5e7eb', paddingLeft: '1rem', margin: '1.5rem 0', fontStyle: 'italic', color: '#6b7280'}}>{children}</blockquote>,
          code: ({children, className, node}) => {
            const isInline = !node?.position?.start?.line || node?.position?.start?.line === node?.position?.end?.line;
            return <CodeBlock inline={isInline} className={className}>{String(children).replace(/\n$/, '')}</CodeBlock>
          },
          pre: ({children}) => <>{children}</>,
          a: ({children, href}) => <a href={href} style={{color: '#3b82f6', textDecoration: 'underline'}} target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>{children}</a>,
          img: ({src, alt}) => <LazyImage src={typeof src === 'string' ? src : ''} alt={alt || ''} />,
          hr: () => <hr style={{borderColor: '#e5e7eb', margin: '2rem 0'}} />,
          table: ({children}) => <table style={{width: '100%', borderCollapse: 'collapse', margin: '1.5rem 0'}}>{children}</table>,
          th: ({children}) => <th style={{border: '1px solid #e5e7eb', padding: '0.5rem 1rem', textAlign: 'left', backgroundColor: '#f9fafb', fontWeight: 600}}>{children}</th>,
          td: ({children}) => <td style={{border: '1px solid #e5e7eb', padding: '0.5rem 1rem', textAlign: 'left'}}>{children}</td>,
          small: ({children}) => <small style={{display: 'block', marginTop: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.5}}>{children}</small>,
          iframe: ({src, title, width, height}) => {
            // Add privacy-enhanced mode for YouTube embeds
            let enhancedSrc = src || '';
            const isCoupang =
              !!src &&
              (src.includes('coupa.ng') ||
                src.includes('coupang.com') ||
                src.includes('ads-partners.coupang.com'))

            if (isCoupang) {
              return (
                <div style={{display: 'flex', justifyContent: 'center', margin: '2rem 0'}}>
                  <iframe
                    src={enhancedSrc}
                    title={title || 'Coupang Partners banner'}
                    width={typeof width === 'number' ? width : width || '120'}
                    height={typeof height === 'number' ? height : height || '240'}
                    style={{border: 0, maxWidth: '100%'}}
                    loading="lazy"
                    referrerPolicy="unsafe-url"
                    scrolling="no"
                  />
                </div>
              )
            }

            if (src && src.includes('youtube.com/embed/')) {
              enhancedSrc = src.replace('youtube.com/embed/', 'youtube-nocookie.com/embed/');
              // Add parameters to reduce cookies and improve performance
              const separator = enhancedSrc.includes('?') ? '&' : '?';
              enhancedSrc += `${separator}modestbranding=1&rel=0&showinfo=0&controls=1`;
            }

            return (
              <div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', margin: '2rem 0'}}>
                <iframe
                  src={enhancedSrc}
                  title={title || 'Embedded content'}
                  style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0, borderRadius: '0.5rem'}}
                  loading="lazy"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            );
          },
        } as Components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
