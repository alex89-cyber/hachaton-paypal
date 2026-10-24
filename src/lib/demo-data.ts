import type { Dish, Ingredient } from "./inventory";

// "Birria Doña Lupe": the fictional stall used in the demo. Birria meat and
// consomé are shared across dishes on purpose, to show recipe-based deduction.

export const demoIngredients: Ingredient[] = [
  { id: "carne", name: "Carne de birria", unit: "g", stock: 12_000 },
  { id: "consome", name: "Consomé", unit: "ml", stock: 15_000 },
  { id: "tortilla", name: "Tortilla", unit: "pz", stock: 300 },
  { id: "queso", name: "Queso Oaxaca", unit: "g", stock: 2_500 },
  { id: "cebolla-cilantro", name: "Cebolla y cilantro", unit: "g", stock: 3_000 },
];

export const demoDishes: Dish[] = [
  {
    id: "birria-plato",
    nameEs: "Plato de birria",
    nameEn: "Birria plate",
    priceCents: 14_000,
    soldOut: false,
    recipe: [
      { ingredientId: "carne", qty: 250 },
      { ingredientId: "consome", qty: 300 },
      { ingredientId: "tortilla", qty: 4 },
      { ingredientId: "cebolla-cilantro", qty: 30 },
    ],
  },
  {
    id: "tacos-dorados",
    nameEs: "Orden de tacos dorados (3)",
    nameEn: "Crispy tacos (3)",
    priceCents: 9_000,
    soldOut: false,
    recipe: [
      { ingredientId: "carne", qty: 150 },
      { ingredientId: "tortilla", qty: 3 },
      { ingredientId: "consome", qty: 100 },
      { ingredientId: "cebolla-cilantro", qty: 20 },
    ],
  },
  {
    id: "quesabirria",
    nameEs: "Quesabirria",
    nameEn: "Quesabirria",
    priceCents: 4_500,
    soldOut: false,
    recipe: [
      { ingredientId: "carne", qty: 80 },
      { ingredientId: "queso", qty: 50 },
      { ingredientId: "tortilla", qty: 1 },
      { ingredientId: "consome", qty: 60 },
    ],
  },
  {
    id: "consome-vaso",
    nameEs: "Vaso de consomé",
    nameEn: "Cup of consomé",
    priceCents: 3_000,
    soldOut: false,
    recipe: [{ ingredientId: "consome", qty: 350 }],
  },
];
