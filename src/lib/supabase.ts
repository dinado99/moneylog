import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// anon 키는 브라우저에 공개되는 용도라 기본값으로 둬도 된다. 데이터는 RLS(본인 데이터만)가 보호한다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dlnzdssssiorgavmvifi.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbnpkc3Nzc2lvcmdhdm12aWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDQyOTUsImV4cCI6MjEwODI4MDI5NX0.55k0KQY11oxd-7cX8eG3_Y-WnKWrNUvTrWAWxIgmlLY";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  client ??= createClient(url, key);
  return client;
}

export function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}
