const won = new Intl.NumberFormat("ko-KR");

export function formatNumber(n: number): string {
  return won.format(Math.round(n));
}

export function formatWon(n: number): string {
  return `${formatNumber(n)}원`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

/** "2026-10-23" -> "23일 금요일" */
export function formatDayHeader(date: string): string {
  return `${Number(date.slice(8))}일 ${weekday(date)}요일`;
}

export function formatMonth(month: string, today = todayString()): string {
  const [y, m] = month.split("-").map(Number);
  return today.startsWith(String(y)) ? `${m}월` : `${y}년 ${m}월`;
}

const pad = (n: number) => String(n).padStart(2, "0");

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

export function nextMonthStart(month: string): string {
  return `${shiftMonth(month, 1)}-01`;
}

/** "🍽️ 식비" -> { emoji: "🍽️", label: "식비" } */
export function splitEmoji(name: string): { emoji: string | null; label: string } {
  const m = name.match(/^(\p{Extended_Pictographic}[\p{Extended_Pictographic}‍️\p{Emoji_Modifier}]*)\s*(.*)$/u);
  return m ? { emoji: m[1], label: m[2] || name } : { emoji: null, label: name };
}
