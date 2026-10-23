# moneylog

개인용 가계부. 모바일 웹(홈 화면에 추가해서 앱처럼)으로 쓰는 걸 기준으로 만들었다.

- **캡처로 가져오기** — 뱅크샐러드 가계부 화면 캡처를 올리면 Claude가 거래를 날짜·분류·결제수단별로 나눠서 채워준다.
- **엑셀/CSV로 가져오기** — 뱅크샐러드 내보내기 엑셀(`가계부 내역` 시트), 카드사·은행 CSV(EUC-KR 포함)를 헤더 이름으로 자동 인식.
- 저장 전 확인 화면에서 항목 수정/제외 가능, 이미 있는 내역(같은 날짜·시간·금액·내용)은 자동으로 빠진다.
- 월별 지출/수입, 분류별 비중, 일별 내역, 검색, 직접 입력.

## 데이터 저장

내역은 **브라우저(IndexedDB)에만** 저장된다. 서버에는 아무것도 남지 않고, 캡처 분석 때만 이미지가 Claude API로 전송된다.
기기 변경 전에는 설정 › 백업 파일 내보내기로 JSON 백업.

## 개발

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력
npm run dev
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm test` | 엑셀/CSV 파서 테스트 (vitest) |

## 배포

Vercel 등 Next.js가 돌아가는 곳이면 된다. 환경 변수:

- `ANTHROPIC_API_KEY` — 캡처 분석용 (필수)
- `APP_PASSCODE` — URL을 아는 누구나 API를 쓰지 못하게 막는 간단한 패스코드 (권장)

배포 후 휴대폰 브라우저에서 열고 "홈 화면에 추가"하면 앱처럼 쓸 수 있다.

## 구조

```
src/
  app/
    page.tsx, history/, import/, settings/   화면 라우트
    api/parse-image/route.ts                 캡처 → 거래 추출 (Claude API, structured output)
  components/
    screens/                                 화면별 클라이언트 컴포넌트
    txn-sheet.tsx                            거래 입력/수정 바텀시트
  lib/
    db.ts                                    IndexedDB(Dexie), 중복 판별 hash
    categories.ts                            분류 목록·색상, 가맹점 이름 기반 분류 추측
    import/table.ts                          표 데이터 → 거래 (헤더 자동 인식)
    import/file.ts                           xlsx/csv 파일 읽기
    import/image.ts                          긴 캡처를 겹치게 잘라 JPEG로 변환
```
