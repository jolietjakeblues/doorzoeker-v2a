// Kale fetch() naar de Anthropic Messages API - geen SDK-dependency, zelfde
// stijl als hoe de rest van Doorzoeker met externe diensten praat
// (sparql-client.ts). Vereist de Cloudflare Workers-secret
// ANTHROPIC_API_KEY (door de eigenaar zelf gezet via `wrangler secret put`,
// nooit hier hardcoded).
const ANTHROPIC_MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

export class AnthropicConfigError extends Error {}

type CallClaudeOptions = {
  system?: string;
  maxTokens: number;
  signal?: AbortSignal;
};

export async function callClaude(userMessage: string, options: CallClaudeOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicConfigError("ANTHROPIC_API_KEY ontbreekt - zet deze als Cloudflare Workers-secret.");
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const response = await fetch(ANTHROPIC_MESSAGES_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`Anthropic API antwoordde met ${response.status}`, { cause: response.status });
  }
  const document = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = document.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic API gaf geen tekstantwoord terug.");
  return text;
}
