"use client";

import { AgStudioAiModule, AgStudioLicenseManager, createAiHarness, studioTheme, type AgStudioApi } from "ag-studio";
import { AgStudio } from "ag-studio-react";
import { useMemo, useState } from "react";
import type { CashUpTables } from "@/lib/analytics";
import { geminiAdapter } from "./geminiAdapter";
import { dataSources, initialReport } from "./report";
import { ticketWidget, type TicketContext } from "./TicketWidget";

// The cash-up in AG Studio: the day's sales, inventory and reservations, a
// dashboard ready on open, a custom "Ticket del corte" widget, the stall's
// colours, and Studio's agents answering in Spanish through Gemini.

// AG Studio keys are meant for the browser bundle. Without one Studio still
// runs, with a watermark ("trial") and console notices.
const license = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE;
if (license) AgStudioLicenseManager.setLicenseKey(license);

const font = "var(--font-geist-sans), system-ui, sans-serif";
const theme = studioTheme.withParams({
  fontFamily: font,
  studioCanvasFontFamily: font,
  studioWidgetTitleFontFamily: font,
  studioWidgetSubtitleFontFamily: font,
  chartFontFamily: font,
  accentColor: "#a3341f",
  textColor: "#2a1a14",
  subtleTextColor: "#7a6458",
  borderColor: "#eadfd3",
  backgroundColor: "#ffffff",
  studioCanvasBackgroundColor: "#fbf6ef",
  studioWidgetBackgroundColor: "#ffffff",
  studioWidgetBorder: { width: 1, color: "#eadfd3" },
  studioWidgetBorderRadius: 14,
  studioWidgetPadding: 10,
  studioWidgetTitleFontSize: 16,
  studioWidgetTitleFontWeight: "bold",
  studioWidgetTitleTextColor: "#2a1a14",
  studioWidgetSubtitleTextColor: "#7a6458",
  studioToggleButtonActiveBackgroundColor: "#a3341f",
  studioToggleButtonActiveBorderColor: "#a3341f",
  studioToggleButtonActiveColor: "#a3341f",
  chartTextColor: "#2a1a14",
  chartSubtleTextColor: "#7a6458",
  // Chiles, masa, cilantro, agave…: warm, but each series easy to tell apart.
  chartPaletteFills1Color: "#a3341f",
  chartPaletteFills2Color: "#e39b2d",
  chartPaletteFills3Color: "#2f7d5b",
  chartPaletteFills4Color: "#6b4e9b",
  chartPaletteFills5Color: "#d9653b",
  chartPaletteFills6Color: "#3d6e9e",
  chartPaletteFills7Color: "#8a6a3b",
  chartPaletteFills8Color: "#c2456b",
} as Record<string, unknown>);

const starters = {
  es: [
    { label: "¿Qué platillo me deja más?", prompt: "¿Qué platillo me dejó más dinero hoy y cuántos vendí? Dímelo corto." },
    { label: "¿Qué se me acaba?", prompt: "¿Qué ingredientes se me están acabando? Agrega una gráfica de lo que queda de cada uno." },
    { label: "Efectivo vs PayPal", prompt: "¿Cuánto cobré en efectivo, con tarjeta y con PayPal? Agrega una gráfica que lo compare." },
    { label: "Mi mejor hora", prompt: "¿A qué hora vendí más? Agrega un widget que la muestre." },
  ],
  en: [
    { label: "Which dish earns most?", prompt: "Which dish made me the most money today, and how many did I sell? Keep it short." },
    { label: "What's running out?", prompt: "Which ingredients are running low? Add a chart of what's left of each." },
    { label: "Cash vs PayPal", prompt: "How much did I take in cash, card and PayPal? Add a chart comparing them." },
    { label: "My best hour", prompt: "What hour did I sell the most? Add a widget that shows it." },
  ],
};

export default function StudioDashboard({
  tables,
  lang,
  stallName,
  dateLabel,
}: {
  tables: CashUpTables;
  lang: "es" | "en";
  stallName: string;
  dateLabel: string;
}) {
  // On a phone there is no room for the editing panels: just show the board.
  const [mode] = useState<"edit" | "view">(() => (window.innerWidth < 900 ? "view" : "edit"));
  const data = useMemo(() => dataSources(tables, lang), [tables, lang]);
  const initialState = useMemo(() => initialReport(lang), [lang]);
  const context = useMemo<TicketContext>(() => ({ stallName, dateLabel, lang }), [stallName, dateLabel, lang]);
  const widgets = useMemo(() => {
    const ticket = ticketWidget(lang);
    return (base: { widgets: readonly unknown[]; menu: { label: string; widgetIds: readonly string[] }[]; defaultType: string }) => ({
      ...base,
      widgets: [...base.widgets, ticket],
      menu: [{ label: lang === "es" ? "Del puesto" : "Stall", widgetIds: [ticket.id] }, ...base.menu],
    });
  }, [lang]);
  const ai = useMemo(() => {
    const adapter = geminiAdapter(lang);
    return ({ api }: { api: AgStudioApi }) => createAiHarness(api, { adapter, primary: "lead", promptStarters: starters[lang] });
  }, [lang]);

  return (
    <AgStudio
      style={{ height: "100%", width: "100%" }}
      data={data}
      initialState={initialState}
      mode={mode}
      theme={theme}
      context={context}
      widgets={widgets as never}
      modules={[AgStudioAiModule]}
      ai={ai}
      onApiReady={(e: { api: AgStudioApi }) => {
        (window as unknown as { studio: AgStudioApi }).studio = e.api;
      }}
    />
  );
}
