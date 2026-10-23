import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// anon(publishable) 키는 브라우저에 공개되는 용도라 코드에 둬도 된다. 데이터는 RLS가 보호한다.
// 다른 프로젝트를 쓰려면 환경 변수로 덮어쓴다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dlnzdssssiorgavmvifi.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbnpkc3Nzc2lvcmdhdm12aWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDQyOTUsImV4cCI6MjEwODI4MDI5NX0.55k0KQY11oxd-7cX8eG3_Y-WnKWrNUvTrWAWxIgmlLY";

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 설정되지 않았어요.");
  client ??= createClient(url, key);
  return client;
}
