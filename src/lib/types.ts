/** 시트 '가계부 기록'의 구분 */
export type Kind = "지출" | "수입" | "이동";

/** 시트 한 줄과 같은 칸 */
export interface RecordDraft {
  /** YYYY-MM-DD */
  date: string;
  kind: Kind;
  /** 대분류 (시트 그대로, 이모지 포함. 이동은 비어 있음) */
  category?: string;
  subcategory?: string;
  content: string;
  /** 양수(원) */
  amount: number;
  inAccount?: string;
  outAccount?: string;
}

export interface MoneyRecord extends RecordDraft {
  id: string;
  source: "app" | "sheet" | "import";
  sheetKey: string | null;
  synced: boolean;
  createdAt: string;
}

export interface Sub {
  name: string;
  /** 고정수입/고정지출 */
  fixed: boolean;
}

export interface Category {
  id: string;
  kind: "자산" | "부채" | "수입" | "지출";
  name: string;
  subs: Sub[];
  sort: number;
}

export interface Account {
  id: string;
  kind: "자산" | "부채";
  category: string;
  subcategory: string | null;
  name: string;
  startAmount: number;
  memo: string | null;
  hidden: boolean;
  sort: number;
}

export interface Schedule {
  id: string;
  name: string;
  day: number;
  weekend: "당기기" | "밀기" | null;
}

export interface Config {
  sheetUrl: string | null;
  sheetToken: string | null;
  startYear: number | null;
  fiscalMonth: number;
  lastSync: string | null;
}
