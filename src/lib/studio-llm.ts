import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, jsonSchema, Output, tool, type ModelMessage, type ToolSet } from "ai";

// The model behind AG Studio's agents on the cash-up page. Studio runs the
// agent loop and its tools in the browser; it only needs one LLM turn at a
// time, which this file answers with Gemini so the API key stays on the server.
// The request and reply use Studio's own shapes (AgLlmRequest / AgLlmResponse).

type Text = { type: "text"; text: string };
export type StudioItem =
  | { type: "message"; kind?: "input"; role: "user" | "system"; content: (Text | { type: string })[] }
  | { type: "message"; kind?: "output"; role: "assistant"; content: ({ type: "text"; text: string } | { type: "refusal"; refusal: string })[] }
  | { type: "function_call"; callId: string; name: string; arguments: string }
  | { type: "function_call_output"; callId: string; output: string }
  | { type: "reasoning" };

export type StudioRequest = {
  input: StudioItem[];
  instructions?: string;
  tools?: { name: string; description: string; parameters: Record<string, unknown>; kind?: string }[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  responseFormat?: { type: "text" } | { type: "json"; name: string; description?: string; schema: Record<string, unknown> };
  lang: "es" | "en";
};

const google = createGoogleGenerativeAI({ baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL || undefined });
// Studio's tools are large; Flash follows them better than Flash-Lite, which
// stays as the fallback when Flash is busy.
const MODELS = [process.env.STUDIO_GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];

const domain = (lang: "es" | "en") =>
  [
    "",
    "## Context",
    "This dashboard is the end-of-day cash-up (corte de caja) of a small Mexican food stall (birria, tacos, consomé).",
    "Tables: `ventas` has one row per dish in each sale (importe is in MXN, `apartado` marks orders reserved and paid with PayPal ahead);",
    "`inventario` is the day's ingredient usage; `apartados` are the PayPal reservations of the day.",
    "The user is the stall owner, not an analyst: keep answers short and concrete, with amounts like $1,250 MXN.",
    lang === "es"
      ? "Always answer the user in Mexican Spanish, and write widget titles in Spanish."
      : "Answer the user in English, and write widget titles in English.",
  ].join("\n");

function textOf(content: { type: string; text?: string; refusal?: string }[]) {
  return content.map((c) => c.text ?? c.refusal ?? "").join("");
}

/** Studio's conversation items as AI SDK messages. */
export function toMessages(items: StudioItem[]): { system: string[]; messages: ModelMessage[] } {
  const system: string[] = [];
  const messages: ModelMessage[] = [];
  const names = new Map<string, string>();
  const push = (m: ModelMessage) => {
    const last = messages.at(-1);
    // Gemini wants one model turn with all its calls, then one turn of results.
    if (last && last.role === m.role && (m.role === "assistant" || m.role === "tool") && Array.isArray(last.content)) {
      (last.content as unknown[]).push(...(m.content as unknown[]));
    } else messages.push(m);
  };
  for (const it of items) {
    if (it.type === "message" && it.role === "system") system.push(textOf(it.content));
    else if (it.type === "message" && it.role === "user") push({ role: "user", content: textOf(it.content) });
    else if (it.type === "message" && it.role === "assistant") {
      const text = textOf(it.content);
      if (text) push({ role: "assistant", content: [{ type: "text", text }] });
    } else if (it.type === "function_call") {
      names.set(it.callId, it.name);
      let input: unknown = {};
      try {
        input = it.arguments ? JSON.parse(it.arguments) : {};
      } catch {}
      push({ role: "assistant", content: [{ type: "tool-call", toolCallId: it.callId, toolName: it.name, input }] });
    } else if (it.type === "function_call_output") {
      push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: it.callId,
            toolName: names.get(it.callId) ?? "tool",
            output: { type: "text", value: it.output },
          },
        ],
      });
    }
  }
  return { system, messages };
}

export async function studioTurn(req: StudioRequest, signal: AbortSignal) {
  const { system, messages } = toMessages(req.input);
  const tools: ToolSet = {};
  for (const t of req.tools ?? []) {
    if (t.kind && t.kind !== "client") continue;
    tools[t.name] = tool({ description: t.description, inputSchema: jsonSchema(t.parameters) });
  }
  const choice = req.toolChoice;
  const toolChoice =
    !choice || typeof choice === "string" ? choice : ({ type: "tool", toolName: choice.name } as const);
  const format = req.responseFormat;

  let lastError: unknown;
  for (const modelId of [...new Set(MODELS)]) {
    try {
      const r = await generateText({
        model: google(modelId),
        instructions: [req.instructions ?? "", ...system, domain(req.lang)].join("\n\n"),
        messages,
        tools: Object.keys(tools).length ? tools : undefined,
        toolChoice: Object.keys(tools).length ? toolChoice : undefined,
        output:
          format?.type === "json"
            ? Output.object({ schema: jsonSchema(format.schema), name: format.name, description: format.description })
            : undefined,
        temperature: 0.2,
        maxOutputTokens: 4000,
        maxRetries: 0,
        abortSignal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
      });
      console.log(`studio: ${modelId} ${r.toolCalls.length} call(s) ${r.usage.totalTokens ?? "?"} tokens`);
      return {
        model: modelId,
        text: r.text,
        toolCalls: r.toolCalls.map((c) => ({ callId: c.toolCallId, name: c.toolName, arguments: JSON.stringify(c.input ?? {}) })),
        usage: { inputTokens: r.usage.inputTokens ?? 0, outputTokens: r.usage.outputTokens ?? 0 },
        truncated: r.finishReason === "length",
      };
    } catch (e) {
      if (signal.aborted) throw e;
      lastError = e;
      const o = (e ?? {}) as { statusCode?: number; message?: string };
      console.error(`studio: ${modelId} failed: ${o.statusCode ?? ""} ${o.message ?? String(e)}`);
    }
  }
  throw lastError;
}
