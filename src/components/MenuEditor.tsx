"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { fill } from "@/lib/format";
import type { OwnerView } from "@/lib/stall";

// The owner's menu: ingredients (name + unit) and dishes (names, price, and the
// recipe of one portion). Everything is edited here and saved in one go.

const UNITS = ["g", "kg", "ml", "l", "pz"] as const;
type Unit = (typeof UNITS)[number];

type IngredientRow = { key: string; name: string; unit: Unit };
type RecipeRow = { ingredient: string; qty: string };
type DishRow = { rowKey: string; id: string | null; nameEs: string; nameEn: string; price: string; recipe: RecipeRow[] };

let seq = 0;
const newKey = () => `new:${Date.now().toString(36)}${(seq++).toString(36)}`;
const asUnit = (u: string): Unit => ((UNITS as readonly string[]).includes(u) ? (u as Unit) : "pz");

function fromView(view: OwnerView): { ingredients: IngredientRow[]; dishes: DishRow[] } {
  return {
    ingredients: view.ingredients.map((i) => ({ key: i.id, name: i.name, unit: asUnit(i.unit) })),
    dishes: view.dishes.map((d) => ({
      rowKey: d.id,
      id: d.id,
      nameEs: d.nameEs,
      nameEn: d.nameEn === d.nameEs ? "" : d.nameEn,
      price: String(d.priceCents / 100),
      recipe: d.recipe.map((r) => ({ ingredient: r.ingredientId, qty: String(r.qty) })),
    })),
  };
}

const input = "w-full rounded-xl border border-line bg-background px-3 py-2";

export function MenuEditor({ initial, lang, t }: { initial: OwnerView; lang: string; t: Dictionary }) {
  const m = t.menu;
  const [saved, setSaved] = useState(() => JSON.stringify(fromView(initial)));
  const [ingredients, setIngredients] = useState(() => fromView(initial).ingredients);
  const [dishes, setDishes] = useState(() => fromView(initial).dishes);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = useMemo(() => JSON.stringify({ ingredients, dishes }) !== saved, [ingredients, dishes, saved]);
  const unitOf = new Map(ingredients.map((i) => [i.key, i.unit]));

  const setDish = (k: string, patch: Partial<DishRow>) =>
    setDishes((ds) => ds.map((d) => (d.rowKey === k ? { ...d, ...patch } : d)));
  const setRecipe = (k: string, f: (r: RecipeRow[]) => RecipeRow[]) =>
    setDishes((ds) => ds.map((d) => (d.rowKey === k ? { ...d, recipe: f(d.recipe) } : d)));
  const move = (i: number, by: number) =>
    setDishes((ds) => {
      const j = i + by;
      if (j < 0 || j >= ds.length) return ds;
      const next = [...ds];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function removeIngredient(row: IngredientRow) {
    const used = dishes.some((d) => d.recipe.some((r) => r.ingredient === row.key));
    if (used && !window.confirm(fill(m.removeIngredientConfirm, { name: row.name || "?" }))) return;
    setIngredients((is) => is.filter((i) => i.key !== row.key));
    setDishes((ds) => ds.map((d) => ({ ...d, recipe: d.recipe.filter((r) => r.ingredient !== row.key) })));
  }

  function validate(): string | null {
    if (!dishes.length) return m.errors.no_dishes;
    if (ingredients.some((i) => !i.name.trim()) || dishes.some((d) => !d.nameEs.trim())) return m.errors.empty_name;
    const names = ingredients.map((i) => i.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return m.errors.duplicate_ingredient;
    if (dishes.some((d) => d.recipe.some((r) => r.ingredient && !(Number(r.qty) > 0)))) return m.errors.bad_qty;
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) return setNote({ ok: false, text: problem });
    setBusy(true);
    setNote(null);
    const body = {
      action: "saveMenu",
      ingredients: ingredients.map((i) => ({ key: i.key, name: i.name.trim(), unit: i.unit })),
      dishes: dishes.map((d) => ({
        id: d.id,
        nameEs: d.nameEs.trim(),
        nameEn: d.nameEn.trim(),
        priceCents: Math.round(Math.max(0, Number(d.price) || 0) * 100),
        // Rows with no ingredient picked are left out; the same ingredient twice adds up.
        recipe: Object.entries(
          d.recipe.reduce<Record<string, number>>((acc, r) => {
            if (r.ingredient) acc[r.ingredient] = (acc[r.ingredient] ?? 0) + Number(r.qty);
            return acc;
          }, {}),
        ).map(([ingredient, qty]) => ({ ingredient, qty })),
      })),
    };
    const res = await fetch(`/api/stalls/${initial.slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 401) return window.location.reload();
    const json = await res?.json().catch(() => null);
    if (!res?.ok) {
      const key = (json?.error ?? "generic") as keyof typeof m.errors;
      return setNote({ ok: false, text: m.errors[key] ?? m.errors.generic });
    }
    // Server ids replace the "new:" keys, so the next save updates instead of adding.
    const fresh = fromView(json as OwnerView);
    setIngredients(fresh.ingredients);
    setDishes(fresh.dishes);
    setSaved(JSON.stringify(fresh));
    setNote({ ok: true, text: m.saved });
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-36 pt-4">
      <header>
        <Link href={`/${lang}/panel/${initial.slug}`} className="text-sm font-semibold text-brand">
          {m.back}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{m.title}</h1>
        <p className="mt-1 text-sm text-muted">{m.intro}</p>
      </header>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{m.ingredients}</h2>
          <p className="text-sm text-muted">{m.ingredientsHint}</p>
        </div>
        {ingredients.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <input
              className={input}
              value={row.name}
              placeholder={m.ingredientName}
              aria-label={m.ingredientName}
              onChange={(e) =>
                setIngredients((is) => is.map((i) => (i.key === row.key ? { ...i, name: e.target.value } : i)))
              }
            />
            <select
              className="rounded-xl border border-line bg-background px-2 py-2"
              value={row.unit}
              aria-label={m.unit}
              onChange={(e) =>
                setIngredients((is) => is.map((i) => (i.key === row.key ? { ...i, unit: asUnit(e.target.value) } : i)))
              }
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {m.units[u]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeIngredient(row)}
              aria-label={m.removeIngredient}
              className="shrink-0 rounded-full px-2 py-1 text-lg text-bad"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setIngredients((is) => [...is, { key: newKey(), name: "", unit: "g" }])}
          className="self-start rounded-full border border-brand px-3 py-1.5 text-sm font-semibold text-brand"
        >
          {m.addIngredient}
        </button>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{m.dishes}</h2>
        {dishes.map((d, idx) => (
          <div key={d.rowKey} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <input
                  className={`${input} font-semibold`}
                  value={d.nameEs}
                  placeholder={m.dishNameEs}
                  aria-label={m.dishNameEs}
                  onChange={(e) => setDish(d.rowKey, { nameEs: e.target.value })}
                />
                <input
                  className={`${input} text-sm`}
                  value={d.nameEn}
                  placeholder={m.dishNameEn}
                  aria-label={m.dishNameEn}
                  onChange={(e) => setDish(d.rowKey, { nameEn: e.target.value })}
                />
              </div>
              <div className="flex flex-col">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={m.moveUp} className="px-2 text-lg disabled:opacity-20">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === dishes.length - 1}
                  aria-label={m.moveDown}
                  className="px-2 text-lg disabled:opacity-20"
                >
                  ↓
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <span className="w-20 text-sm text-muted">{m.price}</span>
              <span className="text-lg">$</span>
              <input
                className={`${input} w-32 text-right tabular-nums`}
                inputMode="decimal"
                value={d.price}
                onChange={(e) => setDish(d.rowKey, { price: e.target.value.replace(/[^\d.]/g, "") })}
              />
              <span className="text-sm text-muted">{initial.currency}</span>
            </label>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{m.recipe}</p>
              {d.recipe.map((r, ri) => (
                <div key={ri} className="flex items-center gap-2">
                  <select
                    className="min-w-0 flex-1 rounded-xl border border-line bg-background px-2 py-2"
                    value={r.ingredient}
                    aria-label={m.chooseIngredient}
                    onChange={(e) =>
                      setRecipe(d.rowKey, (rs) => rs.map((x, j) => (j === ri ? { ...x, ingredient: e.target.value } : x)))
                    }
                  >
                    <option value="">{m.chooseIngredient}</option>
                    {ingredients
                      .filter((i) => i.name.trim())
                      .map((i) => (
                        <option key={i.key} value={i.key}>
                          {i.name}
                        </option>
                      ))}
                  </select>
                  <input
                    className="w-20 rounded-xl border border-line bg-background px-2 py-2 text-right tabular-nums"
                    inputMode="decimal"
                    value={r.qty}
                    aria-label={m.qty}
                    onChange={(e) =>
                      setRecipe(d.rowKey, (rs) =>
                        rs.map((x, j) => (j === ri ? { ...x, qty: e.target.value.replace(/[^\d.]/g, "") } : x)),
                      )
                    }
                  />
                  <span className="w-6 text-sm text-muted">{unitOf.get(r.ingredient) ?? ""}</span>
                  <button
                    type="button"
                    onClick={() => setRecipe(d.rowKey, (rs) => rs.filter((_, j) => j !== ri))}
                    aria-label={m.removeFromRecipe}
                    className="px-1 text-lg text-bad"
                  >
                    ×
                  </button>
                </div>
              ))}
              {!d.recipe.some((r) => r.ingredient) && <p className="text-xs font-semibold text-warn">{m.recipeEmpty}</p>}
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setRecipe(d.rowKey, (rs) => [...rs, { ingredient: "", qty: "" }])}
                  className="rounded-full border border-line px-3 py-1 text-sm font-semibold"
                >
                  {m.addToRecipe}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(fill(m.removeDishConfirm, { name: d.nameEs || m.newDish })))
                      setDishes((ds) => ds.filter((x) => x.rowKey !== d.rowKey));
                  }}
                  className="text-sm text-bad underline"
                >
                  {m.removeDish}
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDishes((ds) => [
              ...ds,
              { rowKey: newKey(), id: null, nameEs: "", nameEn: "", price: "", recipe: [{ ingredient: "", qty: "" }] },
            ])
          }
          className="self-start rounded-full border border-brand px-3 py-1.5 text-sm font-semibold text-brand"
        >
          {m.addDish}
        </button>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          {note ? (
            <p className={`text-center text-sm font-semibold ${note.ok ? "text-ok" : "text-bad"}`}>{note.text}</p>
          ) : (
            dirty && <p className="text-center text-sm text-muted">{m.unsaved}</p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="rounded-2xl bg-brand py-3 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? m.saving : m.save}
          </button>
        </div>
      </div>
    </div>
  );
}
