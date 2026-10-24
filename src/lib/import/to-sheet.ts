import { splitEmoji } from "../format";
import type { Kind, MoneyRecord, RecordDraft, SheetSettings } from "../types";
import type { BankRow } from "./table";

/** 시트 'moneylog 규칙' 탭 한 줄. 계좌 규칙은 category에 시트 계좌 이름 */
export interface Rule {
  type: "가맹점" | "분류" | "계좌";
  source: string;
  category: string;
  subcategory: string;
}

type Target = [label: string, sub?: string];

// 뱅크샐러드 분류(대분류/소분류) → 낼나 기본 분류. 위에서부터 먼저 맞는 규칙.
const EXPENSE: [RegExp, RegExp | null, Target][] = [
  [/카페|간식/, /커피|음료|카페/, ["식비", "커피"]],
  [/카페|간식/, null, ["식비", "간식비"]],
  [/식비/, /장보기|마트|식재료|반찬|정육|과일/, ["식비", "식자재구입비"]],
  [/식비/, /배달/, ["식비", "배달식비"]],
  [/식비/, null, ["식비", "외식비"]],
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
  [/문화|여가/, /OTT|구독|스트리밍|넷플릭스|유튜브/i, ["IT서비스이용료", "OTT구독료"]],
  [/문화|여가/, /영화/, ["문화생활비", "영화관람료"]],
  [/문화|여가/, /도서|책/, ["문화생활비", "도서구입비"]],
  [/문화|여가/, null, ["문화생활비"]],
  [/여행|숙박/, null, ["문화생활비", "여행경비"]],
  [/교육|학습/, null, ["자기계발비", "강의수강료"]],
  [/금융/, /보험/, ["금융비용", "보험료"]],
  [/금융/, /이자/, ["금융비용", "이자비용"]],
  [/금융/, /연회비/, ["금융비용", "연회비"]],
  [/금융/, /수수료/, ["기타비용", "지급수수료"]],
  [/금융/, null, ["금융비용"]],
  [/경조|선물/, /선물/, ["가족 지출", "선물구입비"]],
  [/경조|선물/, null, ["사회생활비", "경조사비"]],
  [/자녀|육아|가족/, null, ["가족 지출"]],
  [/기부|반려/, null, ["기타비용"]],
];

const INCOME: [RegExp, RegExp | null, Target][] = [
  [/급여|월급|근로/, null, ["근로소득", "급여"]],
  [/상여|성과|보너스/, null, ["근로소득", "성과금"]],
  [/금융|이자|투자/, /배당/, ["금융소득", "배당소득"]],
  [/금융|이자|투자/, null, ["금융소득", "이자소득"]],
  [/용돈/, null, ["기타소득", "용돈"]],
  [/환급/, null, ["기타소득", "카드사환급금"]],
  [/취소|환불/, null, ["기타소득", "결제 취소"]],
  [/.*/, null, ["기타소득"]],
];

// 뱅크샐러드 분류가 비어 있을 때 가맹점 이름으로 뱅크샐러드식 분류를 추측
const MERCHANT: [RegExp, string, string?][] = [
  [/스타벅스|투썸|이디야|메가.?커피|빽다방|컴포즈|폴바셋|블루보틀|커피|카페/i, "카페/간식", "커피/음료"],
  [/베이커리|파리바게뜨|뚜레쥬르|배스킨|던킨|브레드/i, "카페/간식", "베이커리"],
  [/배달의민족|배민|요기요|쿠팡이츠/i, "식비", "배달"],
  [/맥도날드|버거킹|롯데리아|맘스터치|김밥|식당|분식|치킨|피자/i, "식비"],
  [/GS25|CU|씨유|세븐일레븐|이마트24|미니스톱|다이소|이마트|홈플러스|롯데마트|코스트코|노브랜드/i, "생활"],
  [/쿠팡|11번가|G마켓|지마켓|옥션|SSG|컬리|오늘의집/i, "온라인쇼핑"],
  [/무신사|29CM|지그재그|에이블리/i, "패션/쇼핑"],
  [/택시|카카오T|카카오모빌리티/i, "교통", "택시"],
  [/지하철|버스|코레일|SRT|티머니|캐시비/i, "교통"],
  [/CGV|메가박스|롯데시네마/i, "문화/여가", "영화"],
  [/넷플릭스|NETFLIX|유튜브|YOUTUBE|멜론|스포티파이|티빙|웨이브|왓챠|디즈니|아이클라우드|iCloud/i, "문화/여가", "OTT"],
  [/SKT|SK텔레콤|KT|LG\s?U\+|유플러스/i, "주거/통신", "휴대폰"],
  [/약국/i, "의료/건강", "약국"],
  [/병원|의원|치과|한의원/i, "의료/건강", "병원"],
  [/올리브영|미용실|헤어|네일/i, "뷰티/미용"],
];

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 이동은 대분류 없음. 뱅크샐러드 타입 → 시트 구분 */
const KIND: Record<BankRow["type"], Kind> = { expense: "지출", income: "수입", transfer: "이동" };

export interface Mapped {
  draft: RecordDraft;
  /** 어떻게 분류했는지 (확인 화면 표시용) */
  how: "규칙" | "예전 기록" | "자동" | "미분류";
  needsCategory: boolean;
  needsAccount: boolean;
  /** 원래 결제수단 이름 (계좌 규칙 저장용) */
  rawAccount?: string;
  raw: BankRow;
}

export function makeMapper(settings: SheetSettings, history: MoneyRecord[], rules: Rule[]) {
  const accounts = [...new Set(settings.accounts.filter((a) => !a.hidden).map((a) => a.name))];
  const cats = (kind: Kind) => settings.categories.filter((c) => c.kind === kind);
  const merchantRules = rules.filter((r) => r.type === "가맹점").sort((a, b) => b.source.length - a.source.length);
  const catRules = new Map(rules.filter((r) => r.type === "분류").map((r) => [r.source, r]));
  const accountRules = new Map(rules.filter((r) => r.type === "계좌").map((r) => [r.source, r.category]));

  // 같은 가게를 예전에 어떤 분류로 넣었는지 (가장 최근 것)
  const learned = new Map<string, RecordDraft>();
  for (const r of [...history].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (r.kind !== "이동" && r.category && r.content) learned.set(`${r.kind}|${norm(r.content)}`, r);
  }

  /** 시트 분류로 맞추기: 라벨(이모지 뺀 이름)이 같은 대분류, 있는 소분류만 */
  function resolve(kind: Kind, label: string, sub?: string) {
    const c = cats(kind).find((x) => splitEmoji(x.name).label === label || x.name === label);
    if (!c) return null;
    return { category: c.name, subcategory: sub && c.subs.some((s) => s.name === sub) ? sub : undefined };
  }

  function validCategory(kind: Kind, category?: string, sub?: string) {
    const c = cats(kind).find((x) => x.name === category);
    if (!c) return null;
    return { category: c.name, subcategory: sub && c.subs.some((s) => s.name === sub) ? sub : undefined };
  }

  function account(raw?: string): string | undefined {
    if (!raw) return undefined;
    if (accountRules.has(raw)) return accountRules.get(raw);
    if (accounts.includes(raw)) return raw;
    // "신세계이마트 삼성카드 SFC 7" ↔ "삼성SFC카드": 계좌 이름(카드 뺀)의 글자가 순서대로 다 들어 있으면 같은 걸로 본다
    // 반대로 짧은 이름("삼성카드")이 계좌 이름("삼성SFC카드") 안에 순서대로 들어 있어도 같은 걸로 본다
    const target = norm(raw);
    const within = (small: string, big: string) => {
      let i = 0;
      for (const ch of big) if (ch === small[i]) i++;
      return i === small.length;
    };
    let best: string | undefined;
    let bestLen = 0;
    for (const a of accounts) {
      const core = norm(a).replace(/카드$/, "");
      if (core.length >= 2 && within(core, target) && core.length > bestLen) {
        best = a;
        bestLen = core.length;
      }
    }
    if (best) return best;
    const rawCore = target.replace(/카드$/, "");
    if (rawCore.length < 2) return undefined;
    let hits = accounts.filter((a) => within(rawCore, norm(a)));
    // "삼성카드"면 삼성증권 말고 카드 계좌만
    if (hits.length > 1 && /카드/.test(raw)) hits = hits.filter((a) => /카드/.test(a));
    return hits.length === 1 ? hits[0] : undefined;
  }

  function map(row: BankRow): Mapped {
    const kind = KIND[row.type];
    const content = row.merchant === "(내용 없음)" ? "" : row.merchant;
    let how: Mapped["how"] = kind === "이동" ? "자동" : "미분류";
    let cat: { category: string; subcategory?: string } | null = null;

    if (kind !== "이동") {
      const mr = merchantRules.find((r) => norm(content).includes(norm(r.source)));
      if (mr) {
        cat = validCategory(kind, mr.category, mr.subcategory);
        if (cat) how = "규칙";
      }
      if (!cat) {
        const prev = learned.get(`${kind}|${norm(content)}`);
        if (prev) {
          cat = validCategory(kind, prev.category, prev.subcategory);
          if (cat) how = "예전 기록";
        }
      }
      let bsCat = row.category;
      let bsSub = row.subcategory ?? "";
      if (!bsCat && kind === "지출") {
        const g = MERCHANT.find(([re]) => re.test(content));
        if (g) [bsCat, bsSub] = [g[1], g[2] ?? ""];
      }
      if (!cat && bsCat) {
        const cr = catRules.get(`${bsCat}>${bsSub}`) ?? catRules.get(bsCat);
        if (cr) {
          cat = validCategory(kind, cr.category, cr.subcategory);
          if (cat) how = "규칙";
        }
      }
      if (!cat && bsCat) {
        // 뱅크샐러드 분류 이름이 시트 분류와 같고 소분류도 맞으면 그대로, 아니면 기본표, 그래도 없으면 대분류만
        const direct = resolve(kind, bsCat, bsSub);
        if (direct && (!bsSub || direct.subcategory)) cat = direct;
        if (!cat) {
          for (const [main, sub, [label, s]] of kind === "수입" ? INCOME : EXPENSE) {
            if (main.test(bsCat) && (!sub || sub.test(bsSub))) {
              cat = resolve(kind, label, s);
              if (cat) break;
            }
          }
        }
        cat ??= direct;
        if (cat) how = "자동";
      }
    }

    // 결제수단: 지출은 출금계좌, 수입은 입금계좌, 이동은 출금계좌 + (카드대금·내계좌이체면 내용으로) 입금계좌
    const acc = account(row.method);
    const draft: RecordDraft = {
      date: row.date,
      kind,
      category: cat?.category,
      subcategory: cat?.subcategory,
      content,
      amount: row.amount,
      inAccount: kind === "수입" ? acc : kind === "이동" ? account(content) : undefined,
      outAccount: kind === "수입" ? undefined : acc,
    };
    return {
      draft,
      how,
      needsCategory: kind !== "이동" && !draft.category,
      needsAccount: !!row.method && !acc,
      rawAccount: row.method,
      raw: row,
    };
  }

  return Object.assign(map, { account });
}

/** 중복 판단: 날짜·구분·금액·내용 (분류·계좌가 달라도 같은 거래) */
export function dedupeKey(r: Pick<RecordDraft, "date" | "kind" | "amount" | "content">): string {
  return [r.date, r.kind, Math.round(r.amount), norm(r.content)].join("|");
}
