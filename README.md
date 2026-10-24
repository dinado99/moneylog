# moneylog

휴대폰에서 쓰는 가계부. 낼나 올인원 가계부(구글 시트)와 양방향으로 맞춰진다.

```
휴대폰 앱 ⇄ Supabase (moneylog_ 테이블) ⇅ 구글 시트 '가계부 기록' / '가계부 설정' ⇄ PC
```

- 앱에서 입력·수정·삭제하면 Supabase에 저장되고 곧바로 시트 '가계부 기록'(B~I열)에도 반영된다.
- 앱을 열 때 / 다시 돌아올 때 / 동기화 버튼을 누를 때 시트를 읽어 PC에서 바뀐 줄을 반영한다(시트가 우선).
- 분류·계좌·시작 금액·달력 일정은 시트 '가계부 설정', '수입·지출 달력'을 따른다.

## 설정

1. Supabase SQL Editor에서 `supabase/setup.sql` 실행 (여러 번 실행해도 안전, 모든 테이블 `moneylog_` 접두어)
2. 구글 시트에 `public/apps-script/Code.gs` 설치 (앱 설정 화면의 '연결 방법' 참고) → 웹 앱 URL 발급
3. 앱 설정에서 URL과 스크립트의 TOKEN 입력

## 구조

```
public/apps-script/Code.gs   구글 시트에 붙여넣는 스크립트 (pull / push)
supabase/setup.sql           테이블 + RLS
src/lib/record-key.ts        시트 한 줄 정규화 (스크립트 norm()과 같아야 함)
src/lib/sync.ts              앱 ↔ 시트 차이 계산 (테스트: sync.test.ts)
src/lib/run-sync.ts          실제 동기화 실행
src/lib/db.ts, sheet.ts      Supabase / 스크립트 호출
DESIGN.md                    디자인 규칙
```

```bash
npm install
npm run dev
npm test
```
