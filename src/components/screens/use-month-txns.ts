"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { monthTxns } from "@/lib/db";

export function useMonthTxns(month: string) {
  return useLiveQuery(() => monthTxns(month), [month]);
}
