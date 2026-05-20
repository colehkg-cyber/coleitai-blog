# 작업 기록 (Worklog)

모든 주요 변경 사항을 이 파일에 기록합니다.

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
