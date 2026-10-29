"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/dictionaries";

/** Asks for the owner PIN; on success the page reloads with the panel. */
export function OwnerLogin({ stallName, t }: { stallName: string; t: Dictionary }) {
  const o = t.owner;
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/owner/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) return start(() => router.refresh());
    setPin("");
    setError(res?.status === 429 ? o.pinTooMany : res?.status === 401 ? o.pinWrong : o.pinError);
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-16 flex w-full max-w-xs flex-col gap-4 px-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">{o.title}</p>
        <h1 className="text-2xl font-bold">{stallName}</h1>
        <p className="mt-2 text-muted">{o.pinHint}</p>
      </div>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        aria-label={o.pinLabel}
        placeholder="••••"
        className="rounded-2xl border border-line bg-surface px-4 py-3 text-center text-2xl tracking-[0.4em]"
      />
      {error && <p className="text-center text-sm font-semibold text-bad">{error}</p>}
      <button
        type="submit"
        disabled={busy || !pin}
        className="rounded-2xl bg-brand py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? "…" : o.pinEnter}
      </button>
    </form>
  );
}
