type GeminiRole = "system" | "user" | "assistant";

export type GeminiMessage = {
  role: GeminiRole;
  content: string;
};

export type GeminiRequestOptions = {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
};

export class GeminiServiceError extends Error {
  code:
    | "MISSING_API_KEY"
    | "REQUEST_FAILED"
    | "INVALID_RESPONSE"
    | "RATE_LIMITED"
    | "MODEL_BLOCKED";

  constructor(
    code:
      | "MISSING_API_KEY"
      | "REQUEST_FAILED"
      | "INVALID_RESPONSE"
      | "RATE_LIMITED"
      | "MODEL_BLOCKED",
    message: string
  ) {
    super(message);
    this.name = "GeminiServiceError";
    this.code = code;
  }
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

function getGeminiApiKey() {
  // Keep compatibility with existing env naming while preferring canonical key.
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_Key?.trim();
  if (!key) {
    throw new GeminiServiceError(
      "MISSING_API_KEY",
      "Missing Gemini API key. Set GEMINI_API_KEY in Vercel environment variables."
    );
  }
  return key;
}

function toGeminiContents(messages: GeminiMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

function extractTextPayload(data: unknown): string {
  if (!data || typeof data !== "object") {
    throw new GeminiServiceError("INVALID_RESPONSE", "Gemini returned an empty response.");
  }

  const maybeObj = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: unknown;
  };

  const candidate = maybeObj.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  if (text) return text;

  if (candidate?.finishReason === "SAFETY") {
    throw new GeminiServiceError(
      "MODEL_BLOCKED",
      "Gemini blocked the response for safety reasons."
    );
  }

  throw new GeminiServiceError(
    "INVALID_RESPONSE",
    "Gemini did not return usable text output."
  );
}

export function sanitizeAiText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function requestGeminiText(
  messages: GeminiMessage[],
  options: GeminiRequestOptions = {}
) {
  const apiKey = getGeminiApiKey();
  const model = DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join("\n\n");

  const body = {
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: options.temperature ?? 0.8,
      maxOutputTokens: options.maxOutputTokens ?? 220,
      responseMimeType: options.responseMimeType ?? "text/plain",
    },
    ...(systemText
      ? {
          systemInstruction: {
            parts: [{ text: systemText }],
          },
        }
      : {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new GeminiServiceError(
      "REQUEST_FAILED",
      `Gemini request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    if (response.status === 429) {
      throw new GeminiServiceError("RATE_LIMITED", "Gemini rate limit reached.");
    }
    const fallback = `Gemini API request failed with status ${response.status}.`;
    const msg =
      json && typeof json === "object" && "error" in json
        ? JSON.stringify((json as { error: unknown }).error)
        : fallback;
    throw new GeminiServiceError("REQUEST_FAILED", msg);
  }

  return sanitizeAiText(extractTextPayload(json));
}

export async function requestGeminiJson<T>(
  messages: GeminiMessage[],
  options: GeminiRequestOptions = {}
): Promise<T> {
  const text = await requestGeminiText(messages, {
    ...options,
    responseMimeType: "application/json",
  });

  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) {
      try {
        return JSON.parse(fenced) as T;
      } catch {
        // handled by terminal throw below
      }
    }
    throw new GeminiServiceError("INVALID_RESPONSE", "Gemini returned non-JSON output.");
  }
}

