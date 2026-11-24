// Free LLM providers in fallback order. Model names live here (overridable via .env), never in engine code.
// Checked against official docs on 2026-11-24:
//  - Groq: llama-3.1-8b-instant moved to Enterprise; gpt-oss-20b is on the free plan.
//  - Gemini: gemini-3.5-flash-lite answered in ~1 s; the "gemini-flash-latest" alias returned 503 (high demand) on 2026-11-24.
//  - OpenRouter: "openrouter/free" routes to whichever ":free" model is available.

export type ProviderConfig = {
  name: "groq" | "gemini" | "openrouter" | "ollama";
  baseUrl: string;
  apiKey: string | null;
  model: string;
  enabled: boolean;
  signup: string;
  extra?: Record<string, unknown>;
};

export function providerConfigs(env: Record<string, string | undefined> = process.env): ProviderConfig[] {
  const key = (k: string) => env[k]?.trim() || null;
  return [
    {
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: key("GROQ_API_KEY"),
      model: env.GROQ_MODEL || "openai/gpt-oss-20b",
      enabled: !!key("GROQ_API_KEY"),
      signup: "https://console.groq.com/keys",
      extra: { reasoning_effort: env.GROQ_REASONING_EFFORT || "low" },
    },
    {
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: key("GEMINI_API_KEY"),
      model: env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      enabled: !!key("GEMINI_API_KEY"),
      signup: "https://aistudio.google.com/apikey",
      extra: { reasoning_effort: env.GEMINI_REASONING_EFFORT || "low" }, // less "thinking" = faster first word
    },
    {
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: key("OPENROUTER_API_KEY"),
      model: env.OPENROUTER_MODEL || "openrouter/free",
      enabled: !!key("OPENROUTER_API_KEY"),
      signup: "https://openrouter.ai/keys",
    },
    {
      name: "ollama",
      baseUrl: `${(env.OLLAMA_URL || "").replace(/\/$/, "")}/v1`,
      apiKey: null,
      model: env.OLLAMA_MODEL || "llama3.2:1b",
      enabled: !!env.OLLAMA_URL,
      signup: "https://ollama.com/download",
    },
  ];
}

export const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 8000);
