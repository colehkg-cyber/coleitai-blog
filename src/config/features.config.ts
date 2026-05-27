/**
 * Features Configuration
 *
 * 기능별 on/off 토글. 개인 블로그 전용 기능과 기업 블로그 전용 기능을 분리한다.
 * false로 설정하면 해당 컴포넌트/API가 렌더링/실행되지 않는다.
 */
export const featuresConfig = {
  /** 댓글 시스템 */
  comments: false,

  /** Google AdSense 광고 */
  adsense: false,

  /** 쿠팡 파트너스 제휴 상품 */
  affiliateProducts: false,

  /** YouTube 자동 동기화 (cron) */
  youtubeSync: false,

  /** AI 콘텐츠 자동 생성 (cron) */
  aiContentGeneration: false,

  /** 뉴스레터 구독 */
  newsletter: false,

  /** 광고 차단기 감지 알림 */
  adBlockerNotice: false,

  /** Service Worker (오프라인 지원) */
  serviceWorker: false,

  /** 조회수 카운터 */
  viewCounter: false,

  /** 다국어 지원 (false면 defaultLocale만 사용) */
  i18n: false,

  /** 관련 포스트 추천 */
  relatedPosts: true,

  /** 목차 (Table of Contents) */
  tableOfContents: true,
} as const
