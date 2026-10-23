# moneylog

개인용 가계부. 모바일 웹(홈 화면에 추가해서 앱처럼)으로 쓰는 걸 기준으로 만들었다.

- **엑셀/CSV로 가져오기** — 뱅크샐러드 내보내기 엑셀(`가계부 내역` 시트), 카드사·은행 CSV(EUC-KR 포함)를 헤더 이름으로 자동 인식해서 날짜·시간·분류·결제수단별로 나눠 넣는다.
- **표 붙여넣기** — 엑셀에서 제목 줄까지 복사해 붙여넣어도 같은 방식으로 읽는다.
- 저장 전 확인 화면에서 항목 수정/제외 가능, 이미 있는 내역(같은 날짜·시간·금액·내용)은 자동으로 빠진다.
- 월별 지출/수입, 분류별 비중, 일별 내역, 검색, 직접 입력.
- 지출·수입 분류(대분류/소분류, 이모지)와 자산(그룹/계좌·카드) 관리. 뱅크샐러드 분류는 내 분류로 자동 변환되고,
  처음 보는 결제수단은 자산에 자동 추가된다. 자산 이름을 바꾸면 예전 이름은 별칭으로 남아 다음 가져오기에도 인식된다.
- 뱅크샐러드 자산 현황(항목·상품명·금액)을 가져오면 자산별 잔액과 총 자산이 채워진다.

## 데이터 저장

내역은 **Supabase**(Postgres)에 저장되고, 이메일+비밀번호로 로그인한다. RLS로 본인 내역만 읽고 쓸 수 있다.
유료 API는 쓰지 않는다 (Supabase 무료 플랜으로 충분).
설정 탭에서 JSON 백업/복원 가능.

## Supabase 설정

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/` 안의 SQL 파일을 이름 순서대로 실행
   (Supabase CLI를 쓴다면 `supabase link` 후 `supabase db push`)
3. Project Settings › API에서 URL과 publishable key(구 anon key)를 환경 변수에 입력
4. Authentication › URL Configuration의 Site URL을 배포 주소로 설정 (가입 인증 메일 링크용)
5. 앱에서 가입해서 계정을 만든 뒤, 혼자 쓸 거라면 Authentication › Sign In / Providers에서
   **Allow new users to sign up** 을 꺼서 다른 사람이 가입하지 못하게 막기

## 개발

```bash
npm install

npm run dev
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm test` | 엑셀/CSV 파서 테스트 (vitest) |

## 배포

Vercel 등 Next.js가 돌아가는 곳이면 된다. Supabase URL과 anon 키는 `src/lib/supabase.ts`에 기본값으로 들어 있어서
환경 변수 없이 배포해도 된다. 다른 프로젝트를 쓰려면 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 덮어쓴다.

배포 후 휴대폰 브라우저에서 열고 "홈 화면에 추가"하면 앱처럼 쓸 수 있다.

## 구조

```
supabase/migrations/                         테이블·RLS 정의
src/
  app/
    page.tsx, history/, import/, settings/   화면 라우트 (로그인 전에는 로그인 화면)
  components/
    screens/                                 화면별 클라이언트 컴포넌트
    txn-sheet.tsx                            거래 입력/수정 바텀시트
  lib/
    supabase.ts                              Supabase 클라이언트
    db.ts                                    transactions 테이블 읽기/쓰기, 중복 판별 hash
    categories.ts                            분류 목록·색상, 가맹점 이름 기반 분류 추측
    import/table.ts                          표 데이터 → 거래 (헤더 자동 인식)
    import/file.ts                           xlsx/csv 파일·붙여넣은 표 읽기
    import/map.ts                            뱅크샐러드 분류/결제수단 → 내 분류/자산
    settings-db.ts, defaults.ts              분류·자산 테이블 읽기/쓰기, 처음 넣어 주는 기본값
```

## 크레딧

앱 아이콘: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (Microsoft, MIT License — `public/licenses/fluentui-emoji.txt`)
