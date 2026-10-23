// 처음 로그인했을 때 넣어 주는 기본 분류/자산 그룹

export const DEFAULT_CATEGORIES: { type: "expense" | "income"; emoji: string; name: string; subs: string[] }[] = [
  { type: "expense", emoji: "👗", name: "의류비", subs: ["의복구입비", "세탁수선비"] },
  { type: "expense", emoji: "🍽️", name: "식비", subs: ["식자재구입비", "외식/배달비", "간식/카페"] },
  { type: "expense", emoji: "🚌", name: "교통비", subs: ["대중교통", "택시비"] },
  { type: "expense", emoji: "🏠", name: "주거비", subs: ["생활비"] },
  { type: "expense", emoji: "💈", name: "이미용비", subs: ["이미용비", "화장품구입비", "피부관리비"] },
  { type: "expense", emoji: "🛍️", name: "물품구입비", subs: ["생활용품구입비", "운동용품구입비", "기타물품구입비"] },
  { type: "expense", emoji: "📞", name: "통신비", subs: ["핸드폰요금"] },
  { type: "expense", emoji: "💻", name: "IT서비스이용료", subs: ["OTT구독료", "기타서비스이용료"] },
  { type: "expense", emoji: "🎪", name: "문화생활비", subs: ["도서구입비", "영화관람료", "여행경비", "취미생활"] },
  { type: "expense", emoji: "🏥", name: "의료건강비", subs: ["병원비", "약제비", "건강식품구입비", "기타건강비"] },
  { type: "expense", emoji: "📚", name: "자기계발비", subs: ["강의수강료", "운동시설이용료"] },
  { type: "expense", emoji: "🍻", name: "사회생활비", subs: ["모임비", "지인선물", "기타비용"] },
  { type: "expense", emoji: "👨‍👩‍👧", name: "가족 지출", subs: ["선물", "용돈"] },
  { type: "expense", emoji: "💸", name: "금융비용", subs: ["보험료", "이자비용", "연회비"] },
  { type: "expense", emoji: "💵", name: "기타비용", subs: ["잡손실", "지급수수료", "기부금"] },
  { type: "expense", emoji: "💌", name: "경조사비", subs: ["경사비", "조사비"] },
  { type: "income", emoji: "👷", name: "근로소득", subs: ["급여", "성과금", "퇴직연금적립액", "연말정산환급금"] },
  { type: "income", emoji: "💵", name: "금융소득", subs: ["이자소득", "배당소득", "증권평가손익", "퇴직연금평가손익"] },
  { type: "income", emoji: "💰", name: "기타소득", subs: ["해지환급금", "카드사환급금", "보험수익", "용돈", "잡이익"] },
];

export const DEFAULT_ASSET_GROUPS = [
  { emoji: "💰", name: "현금·예금" },
  { emoji: "📈", name: "저축·투자" },
  { emoji: "💳", name: "신용카드" },
  { emoji: "🎸", name: "기타자산" },
];
