const won = new Intl.NumberFormat("ko-KR");

export function formatWon(n: number): string {
  return `${won.format(Math.round(n))}원`;
}

export function formatNumber(n: number): string {
  return won.format(Math.round(n));
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-23" -> "23일 금요일" */
export function formatDayHeader(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${d}일 ${WEEKDAYS[wd]}요일`;
}

/** "2026-10-23" -> "10월 23일 (금)" */
export function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${m}월 ${d}일 (${WEEKDAYS[wd]})`;
}

/** "2026-10" -> "2026년 10월" (올해면 "10월") */
export function formatMonth(month: string, today = todayString()): string {
  const [y, m] = month.split("-").map(Number);
  return today.startsWith(String(y)) ? `${m}월` : `${y}년 ${m}월`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function currentMonth(): string {
  return todayString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
