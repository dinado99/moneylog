# 머니로그 디자인

새로 만들 때도 이 규칙과 `src/app/globals.css`, `src/components/ui.tsx`, `src/components/sheet.tsx`를 그대로 쓴다.

## 방향

- 모바일 우선, 한 손으로 쓰는 앱. 최대 폭 `max-w-md`(448px), 좌우 여백 16px(카드) / 20px(텍스트).
- 깔끔하지만 노티 나지 않게: 회색 배경 위 흰 카드, 강조색은 파랑 하나, 숫자는 크고 굵게.
- 이모지는 분류 아이콘에만. 장식용 그라데이션·그림자 남발 금지(그림자는 선택된 세그먼트 정도만).
- 라이트/다크 모드 둘 다. 다크 모드 색은 따로 정의돼 있다(자동 반전 아님).

## 색 (CSS 변수 → Tailwind 클래스)

| 토큰 | 라이트 | 다크 | 쓰임 |
| --- | --- | --- | --- |
| `--bg` → `bg-bg` | #f4f5f7 | #0e0f12 | 화면 배경 |
| `--surface` → `bg-surface` | #ffffff | #17191d | 카드, 시트 |
| `--surface-2` → `bg-surface-2` | #f1f2f5 | #212328 | 입력칸, 칩, 세그먼트 바탕 |
| `--ink` → `text-ink` | #16181d | #f2f3f5 | 본문·숫자, 기본 버튼 배경 |
| `--ink-2` → `text-ink-2` | #4a4f59 | #b7bbc4 | 보조 텍스트 |
| `--ink-3` → `text-ink-3` | #8b909a | #7c818b | 설명·라벨 |
| `--line` → `border-line` | #e8e9ed | #2a2d33 | 구분선 |
| `--accent` → `text-accent` | #2f6bff | #5b8cff | 링크·강조 (하나만) |
| `--accent-soft` | #eaf0ff | #1b2540 | 강조 배경 |
| `--income` → `text-income` | #2f6bff | #6f9bff | 수입·플러스 잔액 |
| `--danger` → `text-danger` | #e5484d | #ff6369 | 삭제·마이너스(부채) |

금액 색: 지출 `text-ink`(앞에 `-`), 수입 `text-income`(앞에 `+`), 이체 `text-ink-3`, 0원 `text-ink-3`.

### 차트 범주색 (`--series-1` ~ `--series-7`, `--series-other`)

색약 구분이 검증된 7색. 8개 이상이면 돌려 쓰지 말고 나머지는 `--series-other`(회색) "기타"로 접는다.
라이트: #2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #6250d6 / 기타 #b4b8c0. 다크는 `globals.css` 참고.
차트에는 항상 범례나 이름 라벨을 같이 둔다(색만으로 구분하지 않기). 막대·조각 사이 2px 간격.

## 글꼴

- Pretendard Variable (CDN, `layout.tsx`), 없으면 시스템 고딕.
- 자간 -0.01em, 숫자는 `num` 유틸리티(고정폭 숫자, 자간 -0.02em).
- 크기: 큰 금액 28–34px bold / 화면 제목 20px bold / 카드 제목 16px semibold / 본문 15px / 보조 13px / 캡션 12px.
- 입력칸은 16px 이상(iOS 확대 방지).

## 모양

- 카드 `rounded-3xl`(24px), 시트 위쪽 28px, 입력칸·버튼 `rounded-2xl`(16px), 칩 `rounded-full`.
- 버튼 높이 52px(`h-13`): 기본 `bg-ink text-surface`, 보조 `bg-surface-2`, 삭제 `bg-surface-2 text-danger`.
- 목록 행: 좌우 20px, 위아래 12–14px, 행 사이 `border-line`.
- 하단 탭바: 반투명 흰 배경 + blur, 높이 56px, 아이콘 22px + 11px 라벨.
- 하단 시트(`Sheet`): 배경 어둡게, 아래에서 올라오는 애니메이션, 위에 손잡이.
- 안전 영역: `pt-safe`, `pb-safe` 유틸리티.

## 컴포넌트 (`src/components/ui.tsx`, `sheet.tsx`)

`Card`, `PageHeader`, `BackHeader`, `Button`, `Segmented`, `TextInput`, `LoadError`, `Sheet`

## 아이콘

- 앱 아이콘·파비콘: Fluent Emoji 3D 지갑(👛), 배경 #fde8f0. `src/app/icon.png`, `src/app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png`.
- 라이선스: MIT (`public/licenses/fluentui-emoji.txt`).
- UI 아이콘: lucide-react, 22px, 선 굵기 1.8(선택 시 2.2).
