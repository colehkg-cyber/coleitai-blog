# 작업 기록 (Worklog)

모든 주요 변경 사항을 이 파일에 기록합니다.

---

## 2026-05-27 — 헤더 색 config 단일 제어 + 컨설팅 제거

- **변경**:
  - `src/components/SiteHeader.tsx`: 하드코딩 색(그라데이션/회색)을 `brandConfig.header`(배경/글자) inline style로 전환. 색 변경이 config 한 곳으로 끝남. (구조·locale prop은 기존 유지)
  - `src/config/brand.config.ts`: `header.background`/`header.text` 추가. 템플릿 기본은 **흰색 배경(#ffffff) + 파랑 글자(#1d4ed8)** 유지.
  - 컨설팅 제거: `src/app/[locale]/consulting/` 삭제, `features.config.ts` `consulting` 플래그 삭제, `middleware.ts` 컨설팅 서브도메인 리다이렉트 블록 삭제(기능 OFF라 동작 영향 없음).
- **이유**: 수강생이 "헤더 색 바꿔줘" 했을 때 `brand.config.ts` 한 곳만 고치면 되도록 구조 정리. 컨설팅은 CMA 전용이라 템플릿에서 제외.
- **검증**: `pnpm type-check` 통과(에러 0).
## 2026-05-27 — SEO/접근성: not-found description + 작업목록 체크박스 라벨 경고 제거

- **변경**:
  - `src/app/posts/[slug]/page.tsx`: "Post Not Found" 분기에도 `description`(사이트 기본 설명) 추가
  - `src/components/MarkdownContent.tsx`: `input` 렌더러 추가 — GFM 작업목록 체크박스(비활성·장식용)에 `aria-hidden`+`tabIndex=-1` 부여
- **이유**: Lighthouse 접근성 "form elements do not have associated labels"가 본문 마크다운 `- [ ]` 체크박스 때문에 발생. 신규 밀키트 사용자에게 동일 문제가 퍼지지 않도록 템플릿에 반영.
- **검증**: `pnpm type-check` 통과(에러 0).
## 2026-05-27 — GitHub Actions 정리: 죽은 워크플로우 삭제 + Hourly 503 재시도

- **변경**:
  - `.github/workflows/daily-content.yml`, `.github/workflows/daily-shorts-regeneration.yml` 삭제 (참조 스크립트 부재로 항상 실패하는 죽은 워크플로우)
  - `src/app/api/cron/generate-post/route.ts`: `generateContentWithRetry` 추가 — Gemini 503/429 시 지수 백오프(2s·4s·8s, 최대 3회) 재시도
- **이유**: Hourly가 `gemini-2.5-flash-lite` 일시적 503(과부하)에 재시도 없이 실패하던 문제를 템플릿 차원에서 해결. 신규 밀키트 사용자에게 동일 문제가 퍼지지 않도록 원본에 반영.
- **검증**: `pnpm type-check` 통과(에러 0). 인스턴스(`ahj1402-sys/my-blog`)에서 수동 실행 시 HTTP 200 + 글 발행 확인 완료.
## 2026-05-20 — 헤더 통일 (SiteHeader 컴포넌트로 추출)

- **변경**:
  - `src/components/SiteHeader.tsx` 신설 — 사이트 공통 헤더 (디자인은 기존 PageLayout 그대로 유지: 흰 배경 + `.logo-text` 그라데이션 + 회색 네비)
  - `src/app/[locale]/page.tsx` — inline 헤더 제거 → `<SiteHeader currentPath="/" />`
  - `src/app/[locale]/posts/[slug]/page.tsx` — inline 헤더 제거 → `<SiteHeader locale={...} />`
  - `src/app/posts/[slug]/page.tsx` — inline 헤더 제거 (하드코딩 About/Contact 링크도 함께 제거)
  - `src/app/archive/page.tsx` — inline 헤더 제거 → `<SiteHeader currentPath="/archive" />`
  - `src/components/PageLayout.tsx` — 내부적으로 SiteHeader 위임 (DRY)
- **이유**: 기존엔 4개 메인 페이지가 각자 inline 헤더를 다르게 박아놨음 (홈은 그라데이션 로고, 글 상세는 italic serif, 아카이브는 다른 폰트, 등). 그래서 헤더를 한 번 바꾸려면 4~5 곳을 동시에 수정해야 했고 디자인이 일관되지 않음. 한 컴포넌트로 통일해서 앞으로는 `SiteHeader.tsx` 한 파일만 고치면 모든 페이지에 반영됨.
- **검증**: `pnpm type-check` 통과. 디자인은 PageLayout이 원래 쓰던 스타일과 동일하게 유지했으므로 sub-page들의 외형 변화는 없음 (홈/글 상세/아카이브만 PageLayout 스타일로 통일됨).

---

## 2026-05-20 — 썸네일 다양성 + cron 500 에러 가시성 개선

- **변경**:
  - `src/lib/unsplash.ts`: `per_page` 1 → 30, 결과 중 랜덤 1장 선택
  - `src/app/api/cron/generate-post/route.ts`: handler를 try/catch로 감싸 예외 시 메시지를 응답 body에 포함
- **이유**:
  - 썸네일 동일 문제: `extractImageKeywords`가 기본값으로 fallback되면 + `per_page: 1`은 항상 #1 사진을 반환 → 여러 글이 같은 썸네일 공유. 키워드 매칭되어도 동일 query는 동일 #1 → 다양성 0.
  - 500 에러 가시성: cron route에 top-level try/catch가 없어서 예외 발생 시 Next.js가 빈 body의 500을 반환 → workflow 로그에 원인이 안 보임. try/catch로 message/stage를 응답에 실어 디버깅 가능하도록.
- **검증**: `pnpm type-check` 통과.

---

## 2026-05-20 — GitHub Actions 글 생성 워크플로우 silent failure 수정

- **변경**: `.github/workflows/auto-publish.yml`
  - curl에 `-L` 추가 → SITE_URL이 redirect 도메인이어도 따라감 (308 차단)
  - 성공 판정을 `>= 500`만 실패 → `2xx 외 전부 실패`로 강화
  - 실패 시 흔한 원인(SITE_URL 불일치, CRON_SECRET 불일치, 키워드 미등록) 출력
- **이유**: 수강생이 workflow를 수동 실행해도 글이 생성되지 않는 경우. SITE_URL secret이 redirect 도메인이면 308 응답이 와서 curl이 멈춤. 워크플로우는 500 미만이면 success 처리해서 사용자가 실패를 인지하지 못함.
- **검증**: ahj1402-sys/my-blog에서 재현·검증 완료. -L 적용 후 308 → 실제 원인(CRON_SECRET 불일치 시 401) 노출.

---

## 2026-05-20 — Admin 설정 페이지 401 Unauthorized 수정

- **변경**: `src/app/admin/settings/page.tsx`
  - 인증 패턴을 codebase 표준(`sessionStorage` + `?password=` query param)으로 통일
  - GET 3개 (settings, meta-description, default-author) — 존재하지 않는 `document.cookie` 읽음 → `sessionStorage`로 변경
  - POST 5개 (settings 저장 3개 + favicon/logo 업로드 2개) — 인증 헤더 자체가 없음 → `?password=` 추가
  - `getAdminPasswordOrPrompt()` 헬퍼 추가
- **이유**: 설정 페이지에서 저장 시 401. POST 요청들이 인증 정보를 안 보내고 있었음. GET도 `document.cookie`를 읽고 있었는데 로그인은 `sessionStorage`에 저장하므로 작동한 적이 없음.
- **검증**: `pnpm type-check` 에러 없음. `AdminPostsTable.tsx`와 동일한 패턴.

---

## 2026-05-20 — Admin URL 복사 시 404 발생 문제 수정

- **변경**: `src/components/admin/AdminPostsTable.tsx` `handleCopyUrl`
  - `process.env.NEXT_PUBLIC_SITE_URL` → `window.location.origin` 으로 변경
- **이유**: `NEXT_PUBLIC_SITE_URL` 환경변수가 실제 배포 URL과 다르면 복사된 URL이 404로 연결되는 문제. 수강생이 환경변수 정확히 맞추기 어려우므로 코드 레벨에서 차단.
- **검증**: `pnpm type-check` 에러 없음. admin 페이지는 `'use client'` 컴포넌트라 `window.location.origin`은 항상 현재 접속한 도메인(=실제 배포 URL)을 반환.

---

## 2026-05-12 — Lighthouse SEO/Performance 100점화

- **변경**:
  - `src/app/[locale]/posts/[slug]/page.tsx` + `src/app/posts/[slug]/page.tsx` (generateMetadata):
    - `description` fallback 체인 추가 — `seoDescription → excerpt → 본문 stripMarkdown 160자 → siteConfig.description` (절대 undefined 없음) → SEO 100점
  - 동일 두 페이지 LCP cover image (`Image priority`):
    - `fetchPriority="high"` + `loading="eager"` 명시 추가 → Lighthouse "LCP request discovery" 통과 (Performance 점수 +10)
- **이유**: Lighthouse 결과 SEO 92점 (meta description 누락), Performance 90점 (LCP fetchpriority 미적용)
- **검증**: `pnpm exec tsc --noEmit` — 에러 없음

---

## 2026-05-12 — 쿠팡 CSP / 발행 / Unsplash 설정 패치

- **변경**:
  - `next.config.ts`: CSP `frame-src`에 `https://*.coupangcdn.com`, `https://partners.coupangcdn.com`, `https://ads-partners.coupang.com` 추가 → 쿠팡 위젯 iframe 회색 화면 오류 해결
  - `src/app/api/posts/[id]/route.ts` (PUT): `publishedAt` 값에 따라 `status`도 `PUBLISHED`/`DRAFT`로 함께 갱신 → "바로 발행" 실제 동작
  - `src/components/SimplePostWriter.tsx`: 체크박스(`formData.publishedAt`)가 켜져 있으면 "초안 저장" 버튼도 발행되도록 `handleSave` 보정, 버튼 라벨 동적 변경
  - `src/lib/settings.ts`: `ALLOWED_KEYS`에 `UNSPLASH_ACCESS_KEY` 추가
  - `src/lib/unsplash.ts`: env 직접 참조 대신 `getSettingValue('UNSPLASH_ACCESS_KEY')` → env 폴백으로 변경
  - `src/app/api/generate-content/route.ts`: 글 생성 시 Unsplash 검색 → 실패 시 OG 이미지 폴백 순서로 `coverImage` 자동 설정
  - `src/app/admin/settings/page.tsx`: Unsplash Access Key 입력/저장 UI 추가
- **이유**: 쿠팡 파트너스 위젯 CSP 차단, "바로 발행하기" 미동작, Unsplash 썸네일 미사용/설정 부재 문제 해결
- **검증**: `pnpm exec tsc --noEmit` — 새 코드에 신규 타입 에러 없음 (기존 pdf-parse 에러만 잔존)

---

## 2026-05-12 — Coleitai Blog 초기화

- **변경**: intalk-blog 기반 코드를 Coleitai Blog로 분리
  - InTalk 전용 파일 30+개 삭제
  - site.config.ts, brand.config.ts 기본값으로 변경
  - Admin1 (설정 가이드 + 전문 지식 관리) / Admin2 (CMS) 분리
  - 환경 변수 검증 시스템 구축 (env-validation.ts, preflight-check.ts)
  - CLAUDE.md 재작성 (harness-engineering + planning-workflow + wwh-framework + superpowers + context7 통합)
- **이유**: 누구나 클론해서 본인 블로그를 만들 수 있는 밀키트 템플릿 구축
- **검증**: pnpm build 성공, TypeScript 에러 0개
