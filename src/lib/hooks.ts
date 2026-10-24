"use client";

import useSWR from "swr";
import { loadSettings, rangeRecords } from "./db";
import { nextMonthStart } from "./format";

export function useSettings() {
  return useSWR(["settings"], loadSettings);
}

export function useMonthRecords(month: string) {
  return useSWR(["records", "month", month], ([, , m]) => rangeRecords(`${m}-01`, nextMonthStart(m)), {
    keepPreviousData: true,
  });
}
