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

/** 시트에 있는 한 줄. key로 시트에서 같은 줄을 찾는다. */
export interface MoneyRecord extends RecordDraft {
  /** 화면용 고유값 (같은 내용 줄이 여러 개일 수 있어 순번을 붙임) */
  id: string;
  key: string;
}

export interface Sub {
  name: string;
  /** 고정수입/고정지출 */
  fixed: boolean;
}

export interface Category {
  kind: "자산" | "부채" | "수입" | "지출";
  name: string;
  subs: Sub[];
}

export interface Account {
  sort: number;
  kind: "자산" | "부채";
  category: string;
  subcategory: string;
  name: string;
  start: number;
  memo: string;
  hidden: boolean;
}

export interface Schedule {
  name: string;
  day: number;
  weekend: "당기기" | "밀기" | null;
}

export interface SheetSettings {
  startYear: number | null;
  fiscalMonth: number;
  categories: Category[];
  accounts: Account[];
  schedules: Schedule[];
}
