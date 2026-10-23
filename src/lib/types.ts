export type TxnType = "expense" | "income" | "transfer";
export type TxnSource = "manual" | "excel" | "image";

export interface Txn {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time?: string;
  type: TxnType;
  /** 항상 양수(원) */
  amount: number;
  category: string;
  subcategory?: string;
  /** 가맹점 / 내용 */
  merchant: string;
  /** 결제수단 */
  method?: string;
  memo?: string;
  source: TxnSource;
  createdAt: number;
  /** 중복 판별 키 */
  hash: string;
}

export type TxnDraft = Omit<Txn, "id" | "createdAt" | "hash" | "source">;
