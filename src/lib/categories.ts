import type { TxnType } from "./types";

export interface Category {
  name: string;
  color: string;
}

export const EXPENSE_CATEGORIES: Category[] = [
  { name: "식비", color: "#F08C4A" },
  { name: "카페/간식", color: "#B98A64" },
  { name: "술/유흥", color: "#9C6ADE" },
  { name: "생활", color: "#46A97A" },
  { name: "온라인쇼핑", color: "#4C7DF0" },
  { name: "패션/쇼핑", color: "#E0648D" },
  { name: "뷰티/미용", color: "#D57AC0" },
  { name: "교통", color: "#2FA6B5" },
  { name: "자동차", color: "#5E6FC2" },
  { name: "주거/통신", color: "#7C8798" },
  { name: "의료/건강", color: "#DB5A5E" },
  { name: "금융", color: "#68707D" },
  { name: "문화/여가", color: "#E3A33B" },
  { name: "여행/숙박", color: "#22A094" },
  { name: "교육/학습", color: "#7A6AD0" },
  { name: "자녀/육아", color: "#E9B23F" },
  { name: "반려동물", color: "#9C7A5E" },
  { name: "경조/선물", color: "#D9576F" },
  { name: "미분류", color: "#A3A9B3" },
];

export const INCOME_CATEGORIES: Category[] = [
  { name: "급여", color: "#3E6FE8" },
  { name: "용돈", color: "#5B8DEF" },
  { name: "금융수입", color: "#2F9E8F" },
  { name: "사업수입", color: "#6B6FD6" },
  { name: "기타수입", color: "#8A94A6" },
];

export const TRANSFER_CATEGORIES: Category[] = [
  { name: "이체", color: "#8A94A6" },
  { name: "카드대금", color: "#7C8798" },
  { name: "내계좌이체", color: "#9AA3B2" },
];

export const ALL_CATEGORY_NAMES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...TRANSFER_CATEGORIES,
].map((c) => c.name);

const colorMap = new Map(
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...TRANSFER_CATEGORIES].map((c) => [c.name, c.color]),
);

export function categoryColor(name: string): string {
  return colorMap.get(name) ?? "#A3A9B3";
}

export function categoriesFor(type: TxnType): Category[] {
  if (type === "income") return INCOME_CATEGORIES;
  if (type === "transfer") return TRANSFER_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export function defaultCategory(type: TxnType): string {
  if (type === "income") return "기타수입";
  if (type === "transfer") return "이체";
  return "미분류";
}

const MERCHANT_RULES: [RegExp, string][] = [
  [/스타벅스|투썸|이디야|메가.?커피|빽다방|컴포즈|폴바셋|블루보틀|커피|카페|베이커리|파리바게뜨|뚜레쥬르|배스킨|던킨/i, "카페/간식"],
  [/배달의민족|배민|요기요|쿠팡이츠|맥도날드|버거킹|롯데리아|맘스터치|김밥|식당|분식|치킨|피자/i, "식비"],
  [/GS25|CU|씨유|세븐일레븐|이마트24|미니스톱|이마트|홈플러스|롯데마트|다이소|코스트코|노브랜드/i, "생활"],
  [/쿠팡|네이버페이|11번가|G마켓|지마켓|옥션|SSG|마켓컬리|컬리|무신사|29CM|오늘의집/i, "온라인쇼핑"],
  [/택시|카카오T|카카오모빌리티|지하철|버스|코레일|SRT|티머니|캐시비|고속버스/i, "교통"],
  [/주유|GS칼텍스|SK에너지|S-OIL|에쓰오일|현대오일뱅크|주차|하이패스|세차/i, "자동차"],
  [/CGV|메가박스|롯데시네마|넷플릭스|NETFLIX|유튜브|YOUTUBE|멜론|스포티파이|SPOTIFY|티빙|웨이브|왓챠|디즈니/i, "문화/여가"],
  [/SKT|SK텔레콤|KT|LG\s?U\+|유플러스|관리비|도시가스|한국전력|수도/i, "주거/통신"],
  [/약국|병원|의원|치과|한의원|안과|피부과/i, "의료/건강"],
  [/올리브영|미용실|헤어|네일/i, "뷰티/미용"],
];

/** 분류가 없을 때 가맹점 이름으로 지출 분류를 추측한다. */
export function guessExpenseCategory(merchant: string): string | null {
  for (const [re, name] of MERCHANT_RULES) if (re.test(merchant)) return name;
  return null;
}
