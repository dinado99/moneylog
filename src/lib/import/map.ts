import { TRANSFER_CATEGORIES } from "../categories";
import { mainCategories, type Settings } from "../settings-db";
import type { TxnDraft } from "../types";

type Target = [main: string, sub?: string];

// 뱅크샐러드 분류(대분류/소분류) → 기본 분류. 위에서부터 먼저 맞는 규칙을 쓴다.
const EXPENSE_RULES: [main: RegExp, sub: RegExp | null, target: Target][] = [
  [/카페|간식/, null, ["식비", "간식/카페"]],
  [/식비/, /장보기|마트|식재료|반찬|정육|과일/, ["식비", "식자재구입비"]],
  [/식비/, null, ["식비", "외식/배달비"]],
  [/술|유흥/, null, ["사회생활비", "모임비"]],
  [/교통/, /택시/, ["교통비", "택시비"]],
  [/교통|자동차/, null, ["교통비", "대중교통"]],
  [/주거|통신/, /통신|휴대폰|핸드폰|인터넷/, ["통신비", "핸드폰요금"]],
  [/주거|통신/, null, ["주거비", "생활비"]],
  [/패션|의류/, /세탁|수선/, ["의류비", "세탁수선비"]],
  [/패션|의류/, null, ["의류비", "의복구입비"]],
  [/뷰티|미용/, /화장품/, ["이미용비", "화장품구입비"]],
  [/뷰티|미용/, /피부|에스테틱/, ["이미용비", "피부관리비"]],
  [/뷰티|미용/, null, ["이미용비", "이미용비"]],
  [/생활/, null, ["물품구입비", "생활용품구입비"]],
  [/쇼핑/, null, ["물품구입비", "기타물품구입비"]],
  [/의료|건강/, /약/, ["의료건강비", "약제비"]],
  [/의료|건강/, /병원|의원|치과|한의원/, ["의료건강비", "병원비"]],
  [/의료|건강/, /운동|헬스|피트니스/, ["자기계발비", "운동시설이용료"]],
  [/의료|건강/, null, ["의료건강비", "기타건강비"]],
  [/문화|여가/, /OTT|구독|스트리밍|넷플릭스|유튜브/, ["IT서비스이용료", "OTT구독료"]],
  [/문화|여가/, /영화/, ["문화생활비", "영화관람료"]],
  [/문화|여가/, /도서|책/, ["문화생활비", "도서구입비"]],
  [/문화|여가/, null, ["문화생활비", "취미생활"]],
  [/여행|숙박/, null, ["문화생활비", "여행경비"]],
  [/교육|학습/, null, ["자기계발비", "강의수강료"]],
  [/금융/, /보험/, ["금융비용", "보험료"]],
  [/금융/, /이자/, ["금융비용", "이자비용"]],
  [/금융/, /수수료/, ["기타비용", "지급수수료"]],
  [/금융/, null, ["금융비용"]],
  [/경조|선물/, /선물/, ["사회생활비", "지인선물"]],
  [/경조|선물/, /조의|부의|장례/, ["경조사비", "조사비"]],
  [/경조|선물/, null, ["경조사비", "경사비"]],
  [/자녀|육아|가족/, null, ["가족 지출"]],
  [/기부/, null, ["기타비용", "기부금"]],
  [/반려/, null, ["기타비용"]],
];

const INCOME_RULES: [main: RegExp, sub: RegExp | null, target: Target][] = [
  [/급여|월급|근로/, null, ["근로소득", "급여"]],
  [/상여|성과|보너스/, null, ["근로소득", "성과금"]],
  [/금융|이자/, /배당/, ["금융소득", "배당소득"]],
  [/금융|이자/, null, ["금융소득", "이자소득"]],
  [/용돈/, null, ["기타소득", "용돈"]],
  [/환급/, null, ["기타소득", "카드사환급금"]],
  [/.*/, null, ["기타소득"]],
];

/**
 * 가져온 내역의 분류를 사용자 분류에 맞춘다.
 * 1) 이미 사용자 분류와 같으면 그대로 2) 뱅크샐러드 → 기본 분류 규칙 3) 못 맞추면 원래 이름 유지
 */
export function mapCategory(s: Settings, d: Pick<TxnDraft, "type" | "category" | "subcategory">): Pick<TxnDraft, "category" | "subcategory"> {
  if (d.type === "transfer") {
    return { category: TRANSFER_CATEGORIES.includes(d.category) ? d.category : "이체", subcategory: undefined };
  }
  const mains = mainCategories(s, d.type);
  const resolve = ([main, sub]: Target) => {
    const m = mains.find((c) => c.name === main);
    if (!m) return null;
    return { category: m.name, subcategory: sub && m.subs.some((c) => c.name === sub) ? sub : undefined };
  };

  // 대분류·소분류가 모두 내 분류와 같으면 그대로
  const direct = mains.find((c) => c.name === d.category);
  if (direct && (!d.subcategory || direct.subs.some((c) => c.name === d.subcategory))) {
    return { category: direct.name, subcategory: d.subcategory };
  }
  const rules = d.type === "income" ? INCOME_RULES : EXPENSE_RULES;
  for (const [main, sub, target] of rules) {
    if (main.test(d.category) && (!sub || sub.test(d.subcategory ?? ""))) {
      const hit = resolve(target);
      if (hit) return hit;
    }
  }
  if (direct) return { category: direct.name, subcategory: undefined };
  return { category: d.category || "미분류", subcategory: d.subcategory };
}

/** 결제수단 이름(또는 별칭)이 자산과 맞으면 자산 이름으로 바꾼다. */
export function mapMethod(s: Settings, method: string | undefined): string | undefined {
  if (!method) return undefined;
  const hit = s.assets.find((a) => a.name === method || a.aliases.includes(method));
  return hit?.name ?? method;
}

export function mapDraft(s: Settings, d: TxnDraft): TxnDraft {
  return { ...d, ...mapCategory(s, d), method: mapMethod(s, d.method) };
}
