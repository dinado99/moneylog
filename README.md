# moneylog

휴대폰에서 쓰는 가계부. 데이터는 낼나 올인원 가계부(구글 시트)에만 저장된다. 별도 서버·DB 없음.

```
휴대폰 앱 ⇄ Apps Script 웹 앱 ⇄ 구글 시트 '가계부 기록' / '가계부 설정' ⇄ PC
```

- 앱에서 입력·수정·삭제하면 시트 '가계부 기록'(B~I열)에 바로 반영된다. 다른 칸·수식은 건드리지 않는다.
- 앱을 열 때 / 다시 돌아올 때 / 상단 버튼을 누를 때 시트를 새로 읽는다. 마지막으로 읽은 내용은 휴대폰에 저장해 두고 먼저 보여준다.
- 분류·계좌·시작 금액·달력 일정은 시트 '가계부 설정', '수입·지출 달력'을 따른다.
- 시트 연결 정보(웹 앱 URL, 비밀번호)는 그 휴대폰 브라우저에만 저장된다.

## 설정

1. 구글 시트에 `public/apps-script/Code.gs` 설치 (앱 첫 화면의 '연결 방법' 참고) → 웹 앱 URL 발급
2. 앱에서 URL과 스크립트의 TOKEN 입력

## 구조

```
public/apps-script/Code.gs   구글 시트에 붙여넣는 스크립트 (pull / push)
src/lib/record-key.ts        시트 한 줄 정규화 (스크립트 norm()과 같아야 함)
src/lib/sheet.ts             스크립트 호출
src/lib/store.ts             시트 데이터 캐시·추가/수정/삭제 (테스트: store.test.ts)
src/lib/connection.ts        연결 정보 (localStorage)
DESIGN.md                    디자인 규칙
```

```bash
npm install
npm run dev
npm test
```
