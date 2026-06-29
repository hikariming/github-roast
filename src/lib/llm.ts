/**
 * Minimal OpenAI-compatible streaming chat client.
 *
 * Works against any `/chat/completions` endpoint: OpenRouter (default free
 * models), OpenAI, Groq, Gemini's OpenAI-compatible endpoint, or a local model.
 * The default provider is the operator's OpenRouter key; users may bring their
 * own (baseURL + apiKey + model) — those are passed through per request and are
 * never persisted server-side.
 */

import { SITE_URL } from "./site";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

/** Error thrown when the provider rejects us for quota/auth reasons. */
export class LlmQuotaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Default provider: StepFun (阶跃星辰) — OpenAI-compatible, strong Chinese.
const STEPFUN_BASE_URL = "https://api.stepfun.com/v1";
const STEPFUN_MODEL = "step-3.7-flash";

/**
 * Resolve the default (operator-funded) provider config, or null if unset.
 *
 * Provider-neutral `LLM_*` vars take precedence (StepFun by default). The legacy
 * `OPENROUTER_*` vars are kept as a self-consistent fallback so older deploys
 * keep working — each key is paired only with its own base URL/model so an
 * OpenRouter key is never sent to StepFun (or vice-versa).
 */
export function defaultLlmConfig(): LlmConfig | null {
  if (process.env.LLM_API_KEY) {
    return {
      baseURL: process.env.LLM_BASE_URL || STEPFUN_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || STEPFUN_MODEL,
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3-0324:free",
    };
  }
  return null;
}

/**
 * Stream a chat completion, yielding text deltas. Throws {@link LlmQuotaError}
 * on 401/402/429 so the caller can prompt the user for their own key.
 */
/** Thrown when the provider stalls past a timeout — distinct from a hard error
 *  so callers can treat it as a transient (retryable) failure, not a bad key. */
export class LlmTimeoutError extends Error {}

// Defaults: a slow flash model still returns its first byte well under 30s, and
// streams tokens far faster than 30s apart. These bound a stalled/queued upstream
// (the real prod failure mode) so the request fails fast instead of hanging the
// whole serverless function until the platform 504s it.
const CONNECT_TIMEOUT_MS = 30_000;
const IDLE_TIMEOUT_MS = 30_000;

export async function* chatStream(
  config: LlmConfig,
  messages: ChatMessage[],
  opts?: { temperature?: number; connectTimeoutMs?: number; idleTimeoutMs?: number },
): AsyncGenerator<string> {
  const base = config.baseURL.replace(/\/$/, "");
  const connectMs = opts?.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
  const idleMs = opts?.idleTimeoutMs ?? IDLE_TIMEOUT_MS;

  // One controller for the whole exchange; a single timer is re-armed before each
  // await so it measures only the provider's wait, not our own processing time.
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), ms);
  };
  const disarm = () => clearTimeout(timer);

  let res: Response;
  try {
    arm(connectMs);
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        // OpenRouter attribution headers (ignored by other providers).
        "HTTP-Referer": SITE_URL,
        "X-Title": "GitHub Roast",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: opts?.temperature ?? 0.85,
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    disarm();
    if (ctrl.signal.aborted) throw new LlmTimeoutError(`LLM connect timed out after ${connectMs}ms`);
    throw new Error(`LLM request failed: ${(e as Error).message}`);
  }

  if (res.status === 401 || res.status === 402 || res.status === 429) {
    disarm();
    const body = await res.text().catch(() => "");
    throw new LlmQuotaError(body || `Provider returned ${res.status}`, res.status);
  }
  if (!res.ok || !res.body) {
    disarm();
    const body = await res.text().catch(() => "");
    throw new Error(`LLM error ${res.status}: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      arm(idleMs);
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (ctrl.signal.aborted) throw new LlmTimeoutError(`LLM stream stalled (>${idleMs}ms)`);
        throw e;
      }
      disarm();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }
  } finally {
    disarm();
    // Abort the underlying connection if the consumer stops pulling early (client
    // disconnect) so we don't leak a half-read upstream stream.
    if (!ctrl.signal.aborted) ctrl.abort();
  }
}
