import { z } from "zod";
import { ALL_CATEGORY_NAMES } from "../categories";

export const ImageTxnSchema = z.object({
  date: z.string().describe("YYYY-MM-DD"),
  time: z.string().nullable().describe("HH:mm, 보이지 않으면 null"),
  type: z.enum(["expense", "income", "transfer"]),
  amount: z.number().int().describe("원 단위 양의 정수"),
  merchant: z.string().describe("가맹점명 또는 거래 내용"),
  category: z.enum(ALL_CATEGORY_NAMES as [string, ...string[]]),
  method: z.string().nullable().describe("결제수단(카드/계좌명), 보이지 않으면 null"),
});

export const ImageParseSchema = z.object({
  transactions: z.array(ImageTxnSchema),
  note: z.string().nullable().describe("사용자에게 알려줄 점(예: 일부가 잘려 읽지 못함). 없으면 null"),
});

export type ImageParseResult = z.infer<typeof ImageParseSchema>;

export interface ImageParseRequest {
  /** 캡처 한 장 = JPEG base64 조각 배열 */
  screens: string[][];
  /** 화면에 연/월이 없을 때 쓸 기본 월 (YYYY-MM) */
  month: string;
  today: string;
}
