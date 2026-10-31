"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dictionary } from "@/dictionaries";
import { fill } from "@/lib/format";
import type { OwnerView } from "@/lib/stall";

const UNITS = ["g", "kg", "ml", "l", "pz"] as const;
type Unit = (typeof UNITS)[number];

type IngredientRow = {
  key: string;
  name: string;
  unit: Unit;
};

type RecipeRow = {
  ingredient: string;
  qty: string;
};

type DishRow = {
  rowKey: string;
  id: string | null;
  nameEs: string;
  nameEn: string;
  price: string;
  recipe: RecipeRow[];
};

let seq = 0;

const newKey = () =>
  `new:${Date.now().toString(36)}${(seq++).toString(36)}`;

const asUnit = (u: string): Unit =>
  ((UNITS as readonly string[]).includes(u) ? u : "pz") as Unit;

function fromView(view: OwnerView): {
  ingredients: IngredientRow[];
  dishes: DishRow[];
} {
  return {
    ingredients: view.ingredients.map((i) => ({
      key: i.id,
      name: i.name,
      unit: asUnit(i.unit),
    })),
    dishes: view.dishes.map((d) => ({
      rowKey: d.id,
      id: d.id,
      nameEs: d.nameEs,
      nameEn: d.nameEn === d.nameEs ? "" : d.nameEn,
      price: String(d.priceCents / 100),
      recipe: d.recipe.map((r) => ({
        ingredient: r.ingredientId,
        qty: String(r.qty),
      })),
    })),
  };
}

const input =
  "w-full min-w-0 rounded-xl border border-line bg-background px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10";

export function MenuEditor({
  initial,
  lang,
  t,
}: {
  initial: OwnerView;
  lang: string;
  t: Dictionary;
}) {
  const m = t.menu;
  const isSpanish = lang === "es";

  // Textos que cambian según el idioma seleccionado.
  const ui = {
    ingredient: isSpanish ? "Ingrediente" : "Ingredient",
    unit: isSpanish ? "Unidad de medida" : "Unit of measure",
    dishesDescription: isSpanish
      ? "Administra tus platillos, precios y recetas."
      : "Manage your dishes, prices, and recipes.",
    dishNumber: isSpanish ? "PLATILLO" : "DISH",
    recipeDescription: isSpanish
      ? "Ingredientes y cantidades por porción."
      : "Ingredients and quantities per serving.",
    ingredientsCount: isSpanish ? "ingredientes" : "ingredients",
    dishesCount: isSpanish ? "platillos" : "dishes",
  };

  const [saved, setSaved] = useState(() =>
    JSON.stringify(fromView(initial))
  );

  const [ingredients, setIngredients] = useState(
    () => fromView(initial).ingredients
  );

  const [dishes, setDishes] = useState(
    () => fromView(initial).dishes
  );

  const [busy, setBusy] = useState(false);

  const [note, setNote] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const dirty = useMemo(
    () => JSON.stringify({ ingredients, dishes }) !== saved,
    [ingredients, dishes, saved]
  );

  const unitOf = new Map(
    ingredients.map((i) => [i.key, i.unit])
  );

  const setDish = (k: string, patch: Partial<DishRow>) =>
    setDishes((ds) =>
      ds.map((d) =>
        d.rowKey === k ? { ...d, ...patch } : d
      )
    );

  const setRecipe = (
    k: string,
    f: (r: RecipeRow[]) => RecipeRow[]
  ) =>
    setDishes((ds) =>
      ds.map((d) =>
        d.rowKey === k
          ? { ...d, recipe: f(d.recipe) }
          : d
      )
    );

  const move = (i: number, by: number) =>
    setDishes((ds) => {
      const j = i + by;

      if (j < 0 || j >= ds.length) return ds;

      const next = [...ds];
      [next[i], next[j]] = [next[j], next[i]];

      return next;
    });

  function removeIngredient(row: IngredientRow) {
    const used = dishes.some((d) =>
      d.recipe.some((r) => r.ingredient === row.key)
    );

    if (
      used &&
      !window.confirm(
        fill(m.removeIngredientConfirm, {
          name: row.name || "?",
        })
      )
    ) {
      return;
    }

    setIngredients((is) =>
      is.filter((i) => i.key !== row.key)
    );

    setDishes((ds) =>
      ds.map((d) => ({
        ...d,
        recipe: d.recipe.filter(
          (r) => r.ingredient !== row.key
        ),
      }))
    );
  }

  function validate(): string | null {
    if (!dishes.length) return m.errors.no_dishes;

    if (
      ingredients.some((i) => !i.name.trim()) ||
      dishes.some((d) => !d.nameEs.trim())
    ) {
      return m.errors.empty_name;
    }

    const names = ingredients.map((i) =>
      i.name.trim().toLowerCase()
    );

    if (new Set(names).size !== names.length) {
      return m.errors.duplicate_ingredient;
    }

    if (
      dishes.some((d) =>
        d.recipe.some(
          (r) => r.ingredient && !(Number(r.qty) > 0)
        )
      )
    ) {
      return m.errors.bad_qty;
    }

    return null;
  }

  async function save() {
    const problem = validate();

    if (problem) {
      return setNote({ ok: false, text: problem });
    }

    setBusy(true);
    setNote(null);

    const body = {
      action: "saveMenu",

      ingredients: ingredients.map((i) => ({
        key: i.key,
        name: i.name.trim(),
        unit: i.unit,
      })),

      dishes: dishes.map((d) => ({
        id: d.id,
        nameEs: d.nameEs.trim(),
        nameEn: d.nameEn.trim(),
        priceCents: Math.round(
          Math.max(0, Number(d.price) || 0) * 100
        ),
        recipe: Object.entries(
          d.recipe.reduce<Record<string, number>>(
            (acc, r) => {
              if (r.ingredient) {
                acc[r.ingredient] =
                  (acc[r.ingredient] ?? 0) +
                  Number(r.qty);
              }

              return acc;
            },
            {}
          )
        ).map(([ingredient, qty]) => ({
          ingredient,
          qty,
        })),
      })),
    };

    const res = await fetch(
      `/api/stalls/${initial.slug}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    ).catch(() => null);

    setBusy(false);

    if (res?.status === 401) {
      return window.location.reload();
    }

    const json = await res?.json().catch(() => null);

    if (!res?.ok) {
      const key = (json?.error ?? "generic") as keyof typeof m.errors;

      return setNote({
        ok: false,
        text: m.errors[key] ?? m.errors.generic,
      });
    }

    const fresh = fromView(json as OwnerView);

    setIngredients(fresh.ingredients);
    setDishes(fresh.dishes);
    setSaved(JSON.stringify(fresh));

    setNote({
      ok: true,
      text: m.saved,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pb-32 pt-6 sm:px-6 lg:px-8">

      {/* ENCABEZADO */}

      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/${lang}/panel/${initial.slug}`}
            className="text-sm font-semibold text-brand hover:underline"
          >
            {m.back}
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {m.title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {m.intro}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-background px-3 py-2 text-muted">
            {ingredients.length} {ui.ingredientsCount}
          </span>

          <span className="rounded-full bg-background px-3 py-2 text-muted">
            {dishes.length} {ui.dishesCount}
          </span>
        </div>
      </header>

      {/* DISTRIBUCIÓN PRINCIPAL */}

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.7fr)]">

        {/* INGREDIENTES */}

        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">

          <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-lg">
                  📦
                </span>

                <h2 className="text-base font-bold">
                  {m.ingredients}
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-muted">
                {m.ingredientsHint}
              </p>
            </div>

            <span className="shrink-0 rounded-lg bg-background px-2 py-1 text-xs font-semibold text-muted">
              {ingredients.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {ingredients.map((row, index) => (
              <div
                key={row.key}
                className="rounded-xl border border-line bg-background p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">
                    {ui.ingredient} {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeIngredient(row)}
                    aria-label={m.removeIngredient}
                    className="rounded-lg px-2 py-1 text-lg leading-none text-bad transition hover:bg-surface"
                  >
                    ×
                  </button>
                </div>

                <input
                  className={input}
                  value={row.name}
                  placeholder={m.ingredientName}
                  aria-label={m.ingredientName}
                  onChange={(e) =>
                    setIngredients((is) =>
                      is.map((i) =>
                        i.key === row.key
                          ? { ...i, name: e.target.value }
                          : i
                      )
                    )
                  }
                />

                <label className="mt-2 block">
                  <span className="mb-1 block text-xs text-muted">
                    {ui.unit}
                  </span>

                  <select
                    className={input}
                    value={row.unit}
                    aria-label={m.unit}
                    onChange={(e) =>
                      setIngredients((is) =>
                        is.map((i) =>
                          i.key === row.key
                            ? {
                                ...i,
                                unit: asUnit(e.target.value),
                              }
                            : i
                        )
                      )
                    }
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {m.units[u]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setIngredients((is) => [
                ...is,
                {
                  key: newKey(),
                  name: "",
                  unit: "g",
                },
              ])
            }
            className="w-full rounded-xl border border-brand px-4 py-3 text-sm font-semibold text-brand transition hover:bg-background"
          >
            {m.addIngredient}
          </button>
        </section>

        {/* PLATILLOS */}

        <section className="flex min-w-0 flex-col gap-4">

          <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-lg">
                  🍽️
                </span>

                <h2 className="text-base font-bold">
                  {m.dishes}
                </h2>
              </div>

              <p className="text-sm text-muted">
                {ui.dishesDescription}
              </p>
            </div>

            <span className="shrink-0 rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-muted">
              {dishes.length}
            </span>
          </div>

          {dishes.map((d, idx) => (
            <article
              key={d.rowKey}
              className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md sm:p-5"
            >

              {/* NOMBRE Y ORDEN */}

              <div className="flex min-w-0 items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted">
                      {ui.dishNumber} {idx + 1}
                    </span>
                  </div>

                  <input
                    className={`${input} font-semibold`}
                    value={d.nameEs}
                    placeholder={m.dishNameEs}
                    aria-label={m.dishNameEs}
                    onChange={(e) =>
                      setDish(d.rowKey, {
                        nameEs: e.target.value,
                      })
                    }
                  />

                  <input
                    className={`${input} text-sm`}
                    value={d.nameEn}
                    placeholder={m.dishNameEn}
                    aria-label={m.dishNameEn}
                    onChange={(e) =>
                      setDish(d.rowKey, {
                        nameEn: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-line">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    aria-label={m.moveUp}
                    className="px-3 py-1.5 text-lg transition hover:bg-background disabled:opacity-20"
                  >
                    ↑
                  </button>

                  <div className="border-t border-line" />

                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === dishes.length - 1}
                    aria-label={m.moveDown}
                    className="px-3 py-1.5 text-lg transition hover:bg-background disabled:opacity-20"
                  >
                    ↓
                  </button>
                </div>
              </div>

              {/* PRECIO */}

              <div className="rounded-xl bg-background p-3">
                <label className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-muted">
                    {m.price}
                  </span>

                  <span className="text-lg font-semibold">
                    $
                  </span>

                  <input
                    className={`${input} min-w-0 flex-1 text-right font-semibold tabular-nums`}
                    inputMode="decimal"
                    value={d.price}
                    onChange={(e) =>
                      setDish(d.rowKey, {
                        price: e.target.value.replace(/[^\d.]/g, ""),
                      })
                    }
                  />

                  <span className="text-xs font-semibold text-muted">
                    {initial.currency}
                  </span>
                </label>
              </div>

              {/* RECETA */}

              <div className="flex flex-col gap-3 border-t border-line pt-4">

                <div>
                  <h3 className="text-sm font-bold">
                    {m.recipe}
                  </h3>

                  <p className="mt-1 text-xs text-muted">
                    {ui.recipeDescription}
                  </p>
                </div>

                {d.recipe.map((r, ri) => (
                  <div
                    key={ri}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_76px_30px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_100px_45px_32px]"
                  >
                    <select
                      className={`${input} min-w-0`}
                      value={r.ingredient}
                      aria-label={m.chooseIngredient}
                      onChange={(e) =>
                        setRecipe(d.rowKey, (rs) =>
                          rs.map((x, j) =>
                            j === ri
                              ? {
                                  ...x,
                                  ingredient: e.target.value,
                                }
                              : x
                          )
                        )
                      }
                    >
                      <option value="">
                        {m.chooseIngredient}
                      </option>

                      {ingredients
                        .filter((i) => i.name.trim())
                        .map((i) => (
                          <option key={i.key} value={i.key}>
                            {i.name}
                          </option>
                        ))}
                    </select>

                    <input
                      className="w-full min-w-0 rounded-xl border border-line bg-background px-2 py-2.5 text-right text-sm tabular-nums outline-none focus:border-brand"
                      inputMode="decimal"
                      value={r.qty}
                      aria-label={m.qty}
                      onChange={(e) =>
                        setRecipe(d.rowKey, (rs) =>
                          rs.map((x, j) =>
                            j === ri
                              ? {
                                  ...x,
                                  qty: e.target.value.replace(/[^\d.]/g, ""),
                                }
                              : x
                          )
                        )
                      }
                    />

                    <span className="text-center text-xs text-muted">
                      {unitOf.get(r.ingredient) ?? ""}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setRecipe(d.rowKey, (rs) =>
                          rs.filter((_, j) => j !== ri)
                        )
                      }
                      aria-label={m.removeFromRecipe}
                      className="rounded-lg px-1 py-1 text-xl text-bad transition hover:bg-background"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {!d.recipe.some((r) => r.ingredient) && (
                  <p className="rounded-lg bg-background p-3 text-xs font-semibold text-warn">
                    {m.recipeEmpty}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">

                  <button
                    type="button"
                    onClick={() =>
                      setRecipe(d.rowKey, (rs) => [
                        ...rs,
                        { ingredient: "", qty: "" },
                      ])
                    }
                    className="rounded-full border border-line px-3 py-2 text-sm font-semibold transition hover:bg-background"
                  >
                    {m.addToRecipe}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          fill(m.removeDishConfirm, {
                            name: d.nameEs || m.newDish,
                          })
                        )
                      ) {
                        setDishes((ds) =>
                          ds.filter(
                            (x) => x.rowKey !== d.rowKey
                          )
                        );
                      }
                    }}
                    className="text-sm font-semibold text-bad underline"
                  >
                    {m.removeDish}
                  </button>
                </div>
              </div>
            </article>
          ))}

          {/* AGREGAR PLATILLO */}

          <button
            type="button"
            onClick={() =>
              setDishes((ds) => [
                ...ds,
                {
                  rowKey: newKey(),
                  id: null,
                  nameEs: "",
                  nameEn: "",
                  price: "",
                  recipe: [
                    { ingredient: "", qty: "" },
                  ],
                },
              ])
            }
            className="w-full rounded-xl border border-dashed border-brand px-4 py-4 text-sm font-semibold text-brand transition hover:bg-surface"
          >
            {m.addDish}
          </button>
        </section>
      </div>

      {/* BARRA INFERIOR DE GUARDADO */}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 sm:px-2 lg:flex-row lg:items-center lg:justify-end">

          {note ? (
            <p
              className={`text-center text-sm font-semibold lg:mr-auto ${
                note.ok ? "text-ok" : "text-bad"
              }`}
            >
              {note.text}
            </p>
          ) : (
            dirty && (
              <p className="text-center text-sm text-muted lg:mr-auto">
                {m.unsaved}
              </p>
            )
          )}

          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="w-full rounded-xl bg-brand px-8 py-3 text-base font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto lg:min-w-64"
          >
            {busy ? m.saving : m.save}
          </button>
        </div>
      </div>
    </div>
  );
}