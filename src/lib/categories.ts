// 이체는 사용자 분류와 별개로 고정 목록을 쓴다 (지출 합계에서 빠짐)
export const TRANSFER_CATEGORIES = ["이체", "카드대금", "내계좌이체"];

// 분류 순서대로 돌려 쓰는 색 (통계 막대, 아이콘 배경)
const PALETTE = [
  "#F08C4A", "#4C7DF0", "#46A97A", "#E0648D", "#9C6ADE", "#2FA6B5", "#E3A33B", "#DB5A5E",
  "#5E6FC2", "#B98A64", "#22A094", "#D57AC0", "#7A6AD0", "#68707D", "#E9B23F", "#7C8798",
];

export function paletteColor(index: number): string {
  return index < 0 ? "#A3A9B3" : PALETTE[index % PALETTE.length];
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

/** 분류가 없을 때 가맹점 이름으로 (뱅크샐러드식) 지출 분류를 추측한다. */
export function guessExpenseCategory(merchant: string): string | null {
  for (const [re, name] of MERCHANT_RULES) if (re.test(merchant)) return name;
  return null;
}
