"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { clock, fill, money, qty } from "@/lib/format";
import { type CashUp, cardLabel, type OwnerView, phoneCardId, type Reservation } from "@/lib/stall";

type Ticket = Record<string, number>;
type Toast = { kind: "ok" | "bad"; text: string } | null;

const POLL_MS = 10_000;

export function OwnerPanel({
  initial,
  lang,
  timezone,
  t,
}: {
  initial: OwnerView;
  lang: string;
  timezone: string;
  t: Dictionary;
}) {
  const o = t.owner;
  const [view, setView] = useState(initial);
  const [ticket, setTicket] = useState<Ticket>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [opening, setOpening] = useState(false);
  const [cashUp, setCashUp] = useState<CashUp | null>(null);
  const [restocking, setRestocking] = useState(false);
  const [phone, setPhone] = useState("");

  const name = useCallback((d: { nameEs: string; nameEn: string }) => (lang === "es" ? d.nameEs : d.nameEn), [lang]);
  const fmt = useCallback((c: number) => money(c, view.currency, lang), [view.currency, lang]);

  // Keep in sync with other devices (and, later, with reservations coming in).
  useEffect(() => {
    const id = setInterval(async () => {
      if (busy) return;
      const res = await fetch(`/api/stalls/${view.slug}?view=owner`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setView(await res.json());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [view.slug, busy]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  type ActResult = OwnerView & {
    closedCashUp?: CashUp;
    error?: string;
    short?: string[];
    stamped?: { cardId: string; stamps: number };
  };
  async function act(body: object): Promise<ActResult | null> {
    setBusy(true);
    try {
      const res = await fetch(`/api/stalls/${view.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) setView(json);
      return json;
    } catch {
      setToast({ kind: "bad", text: "Error de conexión / Connection error" });
      return null;
    } finally {
      setBusy(false);
    }
  }

  const lines = useMemo(
    () => Object.entries(ticket).filter(([, n]) => n > 0).map(([dishId, n]) => ({ dishId, qty: n })),
    [ticket],
  );
  const ticketTotal = lines.reduce((s, l) => s + (view.dishes.find((d) => d.id === l.dishId)?.priceCents ?? 0) * l.qty, 0);

  function add(dishId: string, delta: number) {
    setTicket((cur) => ({ ...cur, [dishId]: Math.max(0, (cur[dishId] ?? 0) + delta) }));
  }

  const rewardName = useMemo(() => {
    const d = view.dishes.find((x) => x.id === view.loyalty.rewardDishId);
    return d ? name(d).toLowerCase() : "";
  }, [view.dishes, view.loyalty.rewardDishId, name]);

  /** "⭐ 4 de 10 sellos", or the reward note when the card is full. */
  const stampNote = (stamps: number) =>
    stamps >= view.loyalty.stampsPerReward
      ? fill(o.stampFull, { reward: rewardName })
      : fill(o.stampsLine, { have: stamps, n: view.loyalty.stampsPerReward });

  async function charge(method: "cash" | "card") {
    if (!lines.length || busy) return;
    if (phone.trim() && !phoneCardId(phone)) return setToast({ kind: "bad", text: o.badPhone });
    const r = await act({ action: "sale", lines, method, customerPhone: phone.trim() || undefined });
    if (!r) return;
    if (r.error === "short") {
      const names = (r.short ?? []).map((id) => view.ingredients.find((i) => i.id === id)?.name ?? id).join(", ");
      setToast({ kind: "bad", text: fill(o.short, { items: names }) });
    } else if (r.error === "closed") {
      setToast({ kind: "bad", text: o.closedError });
    } else {
      const sold = fill(o.sold, { total: fmt(ticketTotal) });
      setToast({ kind: "ok", text: r.stamped ? `${sold} · ${stampNote(r.stamped.stamps)}` : sold });
      setTicket({});
      setPhone("");
    }
  }

  async function close() {
    const r = await act({ action: "close" });
    if (r?.closedCashUp) setCashUp(r.closedCashUp);
    setTicket({});
  }

  return (
    <div className="flex flex-1 flex-col pb-48">
      <header className="sticky top-0 z-10 border-b border-line bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{o.title}</p>
            <h1 className="truncate text-xl font-bold">{view.name}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">{o.todaySales}</p>
            <p className="text-xl font-bold tabular-nums">{fmt(view.today.totalCents)}</p>
            <p className="text-xs text-muted">{fill(o.salesCount, { n: view.today.salesCount })}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
              view.isOpen ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"
            }`}
          >
            <span className={`size-2 rounded-full ${view.isOpen ? "bg-ok" : "bg-bad"}`} />
            {view.isOpen ? t.open : t.closed}
          </span>
          <Link href={`/${lang}/${view.slug}`} target="_blank" className="text-sm text-brand underline">
            {o.publicPage}
          </Link>
          <Link href={`/${lang}/panel/${view.slug}/corte`} className="text-sm text-brand underline">
            {o.studioLink}
          </Link>
          <span className="flex-1" />
          {view.isOpen && (
            <button
              onClick={() => setRestocking(true)}
              disabled={busy}
              className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
            >
              {o.restock}
            </button>
          )}
          {view.isOpen ? (
            <button
              onClick={close}
              disabled={busy}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold active:scale-95"
            >
              {o.closeDay}
            </button>
          ) : (
            <button
              onClick={() => setOpening(true)}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white active:scale-95"
            >
              {o.openDay}
            </button>
          )}
        </div>
      </header>

      <details className="mx-4 mt-4 rounded-2xl bg-brand-soft px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-brand">{o.guideTitle}</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
          {o.guide.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>

      <Reservations
        view={view}
        t={t}
        lang={lang}
        timezone={timezone}
        fmt={fmt}
        busy={busy}
        onDeliver={async (id) => {
          const r = await act({ action: "deliver", reservationId: id });
          if (r?.error) setToast({ kind: "bad", text: o.paypalError });
          else if (r) setToast({ kind: "ok", text: o.delivered });
        }}
        onCancel={async (id) => {
          const r = await act({ action: "cancelReservation", reservationId: id });
          if (r?.error) setToast({ kind: "bad", text: o.paypalError });
          else if (r) setToast({ kind: "ok", text: o.reservationCancelled });
        }}
        onRedeem={async (id, reward) => {
          const r = await act({ action: "redeem", reservationId: id });
          if (!r) return;
          if (!r.error) setToast({ kind: "ok", text: fill(o.redeemed, { reward }) });
          else
            setToast({
              kind: "bad",
              text: r.error === "closed" ? o.closedError : r.error === "short" ? o.redeemShort : o.redeemNotEnough,
            });
        }}
      />

      <h2 className="px-4 pt-5 text-sm font-semibold uppercase tracking-wide text-muted">{o.sell}</h2>
      <p className="px-4 text-sm text-muted">{o.sellHint}</p>
      <section className="grid grid-cols-2 gap-3 p-4">
        {view.dishes.map((d) => {
          const out = d.portions === 0;
          const inTicket = ticket[d.id] ?? 0;
          return (
            <div
              key={d.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-surface shadow-sm transition ${
                inTicket ? "border-brand" : "border-transparent"
              } ${out ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => add(d.id, 1)}
                disabled={!view.isOpen || out || inTicket >= d.portions}
                className="flex min-h-32 flex-1 flex-col items-start gap-1 p-3 text-left active:scale-[0.98] disabled:active:scale-100"
              >
                <span className="text-base font-semibold leading-tight">{name(d)}</span>
                <span className="text-sm text-muted">{fmt(d.priceCents)}</span>
                <span className="flex-1" />
                <span className={`text-sm font-semibold ${out ? "text-bad" : d.portions <= 5 ? "text-warn" : "text-ok"}`}>
                  {out ? t.soldOut : fill(t.left, { n: d.portions })}
                </span>
                {d.soldOutAt && (
                  <span className="text-xs text-warn">
                    {fill(o.runsOutAt, { time: clock(d.soldOutAt, timezone, lang) })}
                    {d.limitingIngredient ? ` ${fill(o.limitedBy, { ingredient: d.limitingIngredient })}` : ""}
                  </span>
                )}
              </button>
              {inTicket > 0 && (
                <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {inTicket}
                </span>
              )}
              {view.isOpen &&
                (out && !d.soldOut ? (
                  // Out because an ingredient ran out: the fix is adding stock.
                  <button
                    onClick={() => setRestocking(true)}
                    disabled={busy}
                    className="border-t border-line px-3 py-2 text-xs font-semibold text-brand active:bg-brand-soft"
                  >
                    {o.restockDish}
                  </button>
                ) : (
                  <button
                    onClick={() => act({ action: "soldOut", dishId: d.id, soldOut: !d.soldOut })}
                    disabled={busy}
                    className="border-t border-line px-3 py-2 text-xs font-semibold text-muted active:bg-brand-soft"
                  >
                    {d.soldOut ? o.unmarkSoldOut : o.markSoldOut}
                  </button>
                ))}
            </div>
          );
        })}
      </section>

      {view.loyalty.rewardDishId && (
        <Customers
          view={view}
          t={t}
          busy={busy}
          reward={rewardName}
          onStamp={async (body) => {
            const r = await act({ action: "stamp", ...body });
            if (r?.stamped) setToast({ kind: "ok", text: stampNote(r.stamped.stamps) });
            else if (r?.error) setToast({ kind: "bad", text: o.badPhone });
          }}
          onRedeem={async (cardId) => {
            const r = await act({ action: "redeem", cardId });
            if (!r) return;
            if (!r.error) setToast({ kind: "ok", text: fill(o.redeemed, { reward: rewardName }) });
            else
              setToast({
                kind: "bad",
                text: r.error === "closed" ? o.closedError : r.error === "short" ? o.redeemShort : o.redeemNotEnough,
              });
          }}
        />
      )}

      <footer className="mt-6 px-4 text-center text-xs text-muted">
        <p>{o.demoNote}</p>
        <button onClick={() => act({ action: "reset" })} className="mt-2 underline">
          {o.reset}
        </button>
      </footer>

      {view.isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="mx-auto max-w-md">
            {lines.length === 0 ? (
              <p className="py-3 text-center text-muted">{o.empty}</p>
            ) : (
              <>
                <ul className="mb-3 flex max-h-28 flex-col gap-1 overflow-y-auto">
                  {lines.map((l) => {
                    const d = view.dishes.find((x) => x.id === l.dishId)!;
                    return (
                      <li key={l.dishId} className="flex items-center gap-2 text-sm">
                        <button
                          onClick={() => add(l.dishId, -1)}
                          className="flex size-7 items-center justify-center rounded-full bg-brand-soft font-bold text-brand"
                          aria-label="-1"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-semibold tabular-nums">{l.qty}</span>
                        <span className="flex-1 truncate">{name(d)}</span>
                        <span className="tabular-nums">{fmt(d.priceCents * l.qty)}</span>
                      </li>
                    );
                  })}
                </ul>
                {view.loyalty.rewardDishId && (
                  <label className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-2">
                    <span aria-hidden>⭐</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d +()-]/g, ""))}
                      inputMode="tel"
                      autoComplete="off"
                      placeholder={o.customerPhone}
                      aria-label={o.customerPhone}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                  </label>
                )}
                <div className="mb-3 flex items-baseline justify-between">
                  <button
                    onClick={() => {
                      setTicket({});
                      setPhone("");
                    }}
                    className="text-sm text-muted underline"
                  >
                    {o.clear}
                  </button>
                  <span className="text-2xl font-bold tabular-nums">{fmt(ticketTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => charge("cash")}
                    disabled={busy}
                    className="rounded-2xl bg-brand py-4 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
                  >
                    {o.cash}
                  </button>
                  <button
                    onClick={() => charge("card")}
                    disabled={busy}
                    className="rounded-2xl bg-brand-strong py-4 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-50"
                  >
                    {o.card}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 top-4 z-40 mx-auto max-w-md rounded-2xl px-4 py-3 text-center font-semibold shadow-lg ${
            toast.kind === "ok" ? "bg-ok text-white" : "bg-bad text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {opening && (
        <OpenDialog
          view={view}
          t={t}
          busy={busy}
          onCancel={() => setOpening(false)}
          onOpen={async (counts) => {
            await act({ action: "open", counts });
            setOpening(false);
          }}
        />
      )}

      {restocking && (
        <RestockDialog
          view={view}
          t={t}
          lang={lang}
          busy={busy}
          onCancel={() => setRestocking(false)}
          onRestock={async (adds) => {
            const r = await act({ action: "restock", adds });
            setRestocking(false);
            if (r?.error === "closed") setToast({ kind: "bad", text: o.closedError });
            else if (r) setToast({ kind: "ok", text: o.restocked });
          }}
        />
      )}

      {cashUp && (
        <CashUpDialog cashUp={cashUp} t={t} lang={lang} slug={view.slug} fmt={fmt} onDone={() => setCashUp(null)} />
      )}
    </div>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 sm:rounded-3xl">{children}</div>
    </div>
  );
}

function OpenDialog({
  view,
  t,
  busy,
  onCancel,
  onOpen,
}: {
  view: OwnerView;
  t: Dictionary;
  busy: boolean;
  onCancel: () => void;
  onOpen: (counts: Record<string, number>) => void;
}) {
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(view.ingredients.map((i) => [i.id, String(Math.round(i.stock))])),
  );
  return (
    <Sheet>
      <h2 className="text-xl font-bold">{t.owner.openTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.owner.openHint}</p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onOpen(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])));
        }}
      >
        {view.ingredients.map((i) => (
          <label key={i.id} className="flex items-center gap-3">
            <span className="flex-1">{i.name}</span>
            <input
              inputMode="decimal"
              className="w-28 rounded-xl border border-line bg-background px-3 py-2 text-right text-lg tabular-nums"
              value={counts[i.id]}
              onChange={(e) => setCounts((c) => ({ ...c, [i.id]: e.target.value.replace(/[^\d.]/g, "") }))}
              aria-label={`${i.name} (${i.unit})`}
            />
            <span className="w-8 text-sm text-muted">{i.unit}</span>
          </label>
        ))}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="rounded-2xl border border-line py-3 font-semibold">
            {t.owner.cancel}
          </button>
          <button type="submit" disabled={busy} className="rounded-2xl bg-brand py-3 font-bold text-white disabled:opacity-50">
            {t.owner.openConfirm}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function CashUpDialog({
  cashUp,
  t,
  lang,
  slug,
  fmt,
  onDone,
}: {
  cashUp: CashUp;
  t: Dictionary;
  lang: string;
  slug: string;
  fmt: (c: number) => string;
  onDone: () => void;
}) {
  const o = t.owner;
  return (
    <Sheet>
      <h2 className="text-xl font-bold">{o.cashUpTitle}</h2>
      <div className="mt-4 rounded-2xl bg-brand-soft p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">{o.total}</span>
          <span className="text-3xl font-bold tabular-nums">{fmt(cashUp.totalCents)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span>
            {o.cash}: <b className="tabular-nums">{fmt(cashUp.byMethod.cash)}</b>
          </span>
          <span>
            {o.card}: <b className="tabular-nums">{fmt(cashUp.byMethod.card)}</b>
          </span>
          {cashUp.byMethod.paypal > 0 && (
            <span>
              PayPal: <b className="tabular-nums">{fmt(cashUp.byMethod.paypal)}</b>
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{fill(o.salesCount, { n: cashUp.salesCount })}</p>
      </div>

      <h3 className="mt-5 font-semibold">{o.byDish}</h3>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {cashUp.byDish.map((d) => (
          <li key={d.dishId} className="flex justify-between">
            <span>
              {d.qty} × {lang === "es" ? d.nameEs : d.nameEn}
            </span>
            <span className="tabular-nums">{fmt(d.totalCents)}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 font-semibold">{o.used}</h3>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {cashUp.used.map((u) => (
          <li key={u.ingredientId} className="flex justify-between">
            <span>{u.name}</span>
            <span className="tabular-nums text-muted">
              {qty(u.used, u.unit, lang)} · {fill(o.leftOver, { n: qty(u.left, u.unit, lang) })}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={`/${lang}/panel/${slug}/corte`}
        className="mt-6 block w-full rounded-2xl border-2 border-brand py-3 text-center font-bold text-brand"
      >
        📊 {o.studioOpen}
      </Link>
      <button onClick={onDone} className="mt-3 w-full rounded-2xl bg-brand py-3 font-bold text-white">
        {o.done}
      </button>
    </Sheet>
  );
}

function Reservations({
  view,
  t,
  lang,
  timezone,
  fmt,
  busy,
  onDeliver,
  onCancel,
  onRedeem,
}: {
  view: OwnerView;
  t: Dictionary;
  lang: string;
  timezone: string;
  fmt: (c: number) => string;
  busy: boolean;
  onDeliver: (id: string) => void;
  onCancel: (id: string) => void;
  onRedeem: (id: string, reward: string) => void;
}) {
  const o = t.owner;
  const active = view.reservations.filter((r) => r.status === "held" || r.status === "authorized");
  const done = view.reservations.filter((r) => r.status !== "held" && r.status !== "authorized").slice(-3).reverse();
  if (active.length === 0 && done.length === 0) return null;
  const dish = new Map(view.dishes.map((d) => [d.id, lang === "es" ? d.nameEs : d.nameEn]));
  const items = (r: Reservation) => r.lines.map((l) => `${l.qty} × ${dish.get(l.dishId) ?? l.dishId}`).join(", ");
  const { stampsPerReward: per, rewardDishId } = view.loyalty;
  const reward = rewardDishId ? (dish.get(rewardDishId) ?? "").toLowerCase() : "";
  // The customer's stamp card, shown on each of their reservations. With a
  // full card the owner hands the reward over and taps "Canjear".
  const stamps = (r: Reservation, compact = false) => {
    if (!r.payerId || !rewardDishId) return null;
    const have = view.loyalty.stamps[r.payerId] ?? 0;
    if (have < per) {
      return compact ? null : <p className="mt-1 text-sm text-muted">{fill(o.stampsLine, { have, n: per })}</p>;
    }
    return (
      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-warn-soft px-3 py-2 text-warn">
        <p className="text-sm font-semibold">{fill(o.rewardReady, { name: r.customerName, reward })}</p>
        <button
          onClick={() => onRedeem(r.id, reward)}
          disabled={busy}
          className="shrink-0 rounded-full bg-warn px-3 py-1.5 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
        >
          {o.redeem}
        </button>
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-2 px-4 pt-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {o.reservations} {active.length > 0 && <span className="text-brand">· {active.length}</span>}
      </h2>
      {active.map((r) => (
        <article key={r.id} className="rounded-2xl border-2 border-brand/30 bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold">{r.customerName}</p>
              <p className="text-sm">{items(r)}</p>
            </div>
            <p className="shrink-0 text-lg font-bold tabular-nums">{fmt(r.totalCents)}</p>
          </div>
          <p className={`mt-2 text-sm font-semibold ${r.status === "authorized" ? "text-ok" : "text-warn"}`}>
            {r.status === "authorized"
              ? fill(o.paidHeld, { time: clock(r.pickupBy, timezone, lang) })
              : o.awaitingPayment}
          </p>
          {stamps(r)}
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              onClick={() => onDeliver(r.id)}
              disabled={busy || r.status !== "authorized"}
              className="rounded-xl bg-ok py-3 font-bold text-white active:scale-[0.98] disabled:opacity-40"
            >
              {o.deliver}
            </button>
            <button
              onClick={() => onCancel(r.id)}
              disabled={busy}
              className="rounded-xl border border-line px-4 py-3 font-semibold active:scale-[0.98] disabled:opacity-40"
            >
              {o.cancel}
            </button>
          </div>
        </article>
      ))}
      {done.map((r) => (
        <div key={r.id} className="px-1">
          <p className="flex justify-between gap-3 text-sm text-muted">
            <span className="truncate">
              {r.customerName} · {items(r)}
            </span>
            <span className="shrink-0">{o.reservationStatus[r.status]}</span>
          </p>
          {r.status === "captured" && stamps(r, true)}
        </div>
      ))}
    </section>
  );
}

function RestockDialog({
  view,
  t,
  lang,
  busy,
  onCancel,
  onRestock,
}: {
  view: OwnerView;
  t: Dictionary;
  lang: string;
  busy: boolean;
  onCancel: () => void;
  onRestock: (adds: Record<string, number>) => void;
}) {
  const o = t.owner;
  const [adds, setAdds] = useState<Record<string, string>>({});
  const parsed = Object.fromEntries(
    Object.entries(adds)
      .map(([k, v]) => [k, Number(v) || 0] as const)
      .filter(([, n]) => n > 0),
  );
  return (
    <Sheet>
      <h2 className="text-xl font-bold">{o.restockTitle}</h2>
      <p className="mt-1 text-sm text-muted">{o.restockHint}</p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (Object.keys(parsed).length) onRestock(parsed);
        }}
      >
        {view.ingredients.map((i) => (
          <label key={i.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block">{i.name}</span>
              <span className={`block text-xs ${i.stock <= 0 ? "font-semibold text-bad" : "text-muted"}`}>
                {fill(o.youHave, { n: qty(i.stock, i.unit, lang) })}
              </span>
            </span>
            <span className="text-lg text-muted">+</span>
            <input
              inputMode="decimal"
              placeholder="0"
              className="w-24 rounded-xl border border-line bg-background px-3 py-2 text-right text-lg tabular-nums"
              value={adds[i.id] ?? ""}
              onChange={(e) => setAdds((c) => ({ ...c, [i.id]: e.target.value.replace(/[^\d.]/g, "") }))}
              aria-label={`${o.restock} ${i.name} (${i.unit})`}
            />
            <span className="w-8 text-sm text-muted">{i.unit}</span>
          </label>
        ))}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="rounded-2xl border border-line py-3 font-semibold">
            {o.cancel}
          </button>
          <button
            type="submit"
            disabled={busy || !Object.keys(parsed).length}
            className="rounded-2xl bg-brand py-3 font-bold text-white disabled:opacity-50"
          >
            {o.restockConfirm}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** Stamp cards: find a customer, add a stamp by hand, hand over the reward. */
function Customers({
  view,
  t,
  busy,
  reward,
  onStamp,
  onRedeem,
}: {
  view: OwnerView;
  t: Dictionary;
  busy: boolean;
  reward: string;
  onStamp: (body: { cardId?: string; phone?: string; name?: string }) => void;
  onRedeem: (cardId: string) => void;
}) {
  const o = t.owner;
  const per = view.loyalty.stampsPerReward;
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const q = query.trim().toLowerCase();
  const asPhone = phoneCardId(query);
  const cards = view.loyalty.cards.filter(
    (c) => !q || c.id === asPhone || cardLabel(c).toLowerCase().includes(q) || c.id.includes(q.replace(/\D/g, "") || "~"),
  );
  const isNew = asPhone !== null && !view.loyalty.cards.some((c) => c.id === asPhone);

  return (
    <section className="flex flex-col gap-2 px-4 pt-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{o.customers}</h2>
      <p className="text-sm text-muted">{fill(o.customersHint, { n: per, reward })}</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={o.customerSearch}
        className="rounded-xl border border-line bg-surface px-3 py-2"
        aria-label={o.customerSearch}
      />
      {isNew && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-line p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={o.customerName}
            className="rounded-xl border border-line bg-background px-3 py-2"
            aria-label={o.customerName}
          />
          <button
            onClick={() => {
              onStamp({ phone: query, name });
              setName("");
            }}
            disabled={busy}
            className="rounded-xl bg-brand py-2.5 font-bold text-white active:scale-[0.98] disabled:opacity-40"
          >
            {o.newCard}
          </button>
        </div>
      )}
      {cards.length === 0 && !isNew && <p className="py-2 text-sm text-muted">{q ? o.noCustomer : o.noCards}</p>}
      <ul className="flex flex-col gap-2">
        {cards.slice(0, 8).map((c) => {
          const ready = c.stamps >= per;
          return (
            <li
              key={c.id}
              className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm ${ready ? "bg-warn-soft" : "bg-surface"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{cardLabel(c)}</p>
                <p className={`text-sm ${ready ? "font-semibold text-warn" : "text-muted"}`}>
                  {ready ? fill(o.stampFull, { reward }) : fill(o.stampsLine, { have: c.stamps, n: per })}
                </p>
              </div>
              {ready && (
                <button
                  onClick={() => onRedeem(c.id)}
                  disabled={busy}
                  className="rounded-full bg-warn px-3 py-1.5 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
                >
                  {o.redeem}
                </button>
              )}
              <button
                onClick={() => onStamp({ cardId: c.id })}
                disabled={busy}
                className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold active:scale-95 disabled:opacity-40"
                aria-label={`${o.addStamp} ${cardLabel(c)}`}
              >
                {o.addStamp}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
