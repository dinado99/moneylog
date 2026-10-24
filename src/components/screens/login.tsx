"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, TextInput } from "../ui";

export function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) setMessage({ text: "이메일 또는 비밀번호가 맞지 않아요.", error: true });
      } else {
        const { data, error } = await supabase().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) setMessage({ text: error.message, error: true });
        else if (!data.session) setMessage({ text: "메일함에서 인증 링크를 누른 뒤 로그인해 주세요." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6">
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-[26px] leading-snug font-bold">
          머니로그
          <span className="block text-[16px] font-medium text-ink-3">휴대폰에서 쓰는 내 가계부</span>
        </p>
        <form onSubmit={submit} className="mt-10 space-y-3">
          <TextInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className="h-13 w-full bg-surface" />
          <TextInput
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="h-13 w-full bg-surface"
          />
          {message && <p className={`px-1 text-[14px] ${message.error ? "text-danger" : "text-ink-2"}`}>{message.text}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? "로그인" : "가입하기"}
          </Button>
        </form>
      </div>
      <button
        className="pb-safe mb-8 text-[14px] text-ink-3"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage(null);
        }}
      >
        {mode === "signin" ? "처음이에요 · 가입하기" : "이미 계정이 있어요 · 로그인"}
      </button>
    </div>
  );
}
