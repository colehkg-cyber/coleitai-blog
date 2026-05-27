/**
 * Brand Configuration
 *
 * 시각적 브랜딩 자산. 로고, OG 이미지, 저작권 정보 등.
 * site.config.ts가 "무슨 사이트인가"를 정의한다면,
 * brand.config.ts는 "어떻게 보이는가"를 정의한다.
 */
export const brandConfig = {
  /** 로고 설정 */
  logo: {
    /** 텍스트 로고 (이미지가 없을 때 사용) */
    text: '나의 블로그',
    /** 이미지 로고 경로 (public/ 기준). null이면 텍스트 로고 사용 */
    image: null as string | null,
    /** 로고 클릭 시 이동할 외부 URL. null이면 블로그 홈으로 이동 */
    url: null as string | null,
  },

  /**
   * 🎨 헤더 색상 — 여기 두 값만 바꾸면 모든 페이지 상단 헤더 색이 바뀝니다.
   * CSS 색상값으로 입력 (예: '#ffffff' 흰색, '#1e3a8a' 남색, '#111827' 검정)
   * 배경을 어둡게 바꾸면 글자(text)는 '#ffffff' 로 함께 바꿔주세요.
   */
  header: {
    /** 헤더 배경색 */
    background: '#ffffff',
    /** 로고·메뉴 글자색 */
    text: '#1d4ed8',
  },

  /** 기본 OG 이미지 (public/ 기준, 1200x630 권장) */
  ogImage: '/og-image.png',

  /**
   * OG 이미지 내 캐릭터/로고 이미지 (public/ 기준).
   * null이면 OG 이미지에 캐릭터 없이 텍스트만 표시.
   * 개인 블로그에서 캐릭터/아바타를 넣고 싶을 때 사용.
   */
  ogCharacterImage: null as string | null,

  /** 저작권 정보 */
  copyright: {
    holder: '나의 블로그',
    startYear: new Date().getFullYear(),
  },
} as const
