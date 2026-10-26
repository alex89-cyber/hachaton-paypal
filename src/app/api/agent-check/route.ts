import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { connection } from "next/server";

// GET /api/agent-check  one tiny Gemini call, reported as JSON (always 200 so it
// can be read from a browser). Shows the model's error without the API key.
// Temporary: remove with /api/paypal-test before the submission.
export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const modelId = params.get("model") ?? process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const thinking = params.get("thinking");
  const google = createGoogleGenerativeAI({ baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL || undefined });
  const started = Date.now();
  try {
    const r = await generateText({
      model: google(modelId),
      prompt: "Responde solo: hola",
      maxOutputTokens: 1200,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20_000),
      providerOptions: thinking ? { google: { thinkingConfig: { thinkingLevel: thinking } } } : undefined,
    });
    return Response.json(
      { ok: true, model: modelId, thinking, ms: Date.now() - started, text: r.text, usage: r.usage },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const o = (e ?? {}) as { statusCode?: number; message?: string; responseBody?: string };
    return Response.json(
      {
        ok: false,
        model: modelId,
        thinking,
        ms: Date.now() - started,
        status: o.statusCode ?? null,
        message: o.message ?? String(e),
        body: o.responseBody?.slice(0, 800) ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
