"use client";

import useSWR from "swr";
import { monthTxns } from "@/lib/db";

export function useMonthTxns(month: string) {
  return useSWR(["txns", month], ([, m]) => monthTxns(m), { keepPreviousData: true });
}
