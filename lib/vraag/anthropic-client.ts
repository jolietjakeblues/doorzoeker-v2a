// Kale fetch() naar de Anthropic Messages API - geen SDK-dependency, zelfde
// stijl als hoe de rest van Doorzoeker met externe diensten praat
// (sparql-client.ts). Vereist de Cloudflare Workers-secret
// ANTHROPIC_API_KEY (door de eigenaar zelf gezet via `wrangler secret put`,
// nooit hier hardcoded).
const ANTHROPIC_MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";

// MCP-connector (bèta): laat de Anthropic API zelf een remote MCP-server
// aanroepen tijdens het genereren, in plaats van dat Doorzoeker de vraag
// alleen met een statische systeemprompt beantwoordt. Live geverifieerd
// (28-08-2026) tegen de eigenaars eigen rce-cho-mcp-server op Render: één
// API-aanroep met dit beta-request-type resulteerde in een echte
// resolve_concept_label-toolaanroep en het juiste antwoord (o.a. de
// gedisambigueerde Utrecht_(gemeente)-URI, niet de provincie of de
// kadastrale gemeente) - de volledige tool-loop wordt server-side door
// Anthropic afgehandeld, één HTTP-aanroep voor Doorzoeker.
const MCP_BETA_HEADER = "mcp-client-2025-04-04";

export class AnthropicConfigError extends Error {}

// Live geconstateerd (28-08-2026): bij het diep geneste functie/type-UNION-
// patroon liep de generatie soms tegen max_tokens aan, wat een afgekapte
// (syntactisch onvolledige) SPARQL-query oplevert - géén onbalans die
// balanceBraces kan repareren, want er ontbreken ook hele UNION-takken en
// sluithaken van FILTER/CONTAINS. Zo'n afkapping moet gedetecteerd en
// opnieuw geprobeerd worden met meer budget, niet stilzwijgend doorgezet.
export class AnthropicTruncatedError extends Error {}

export type McpServerConfig = { url: string; name: string };

type CallClaudeOptions = {
  system?: string;
  maxTokens: number;
  signal?: AbortSignal;
  mcpServers?: McpServerConfig[];
};

type ContentBlock = { type: string; text?: string };

// Live geconstateerd (28-08-2026): een onbereikbare MCP-server (bv. de
// eigenaars eigen rce-cho-mcp op een gratis Render-laag, die in slaap kan
// vallen) laat de HELE aanroep mislukken met HTTP 400
// invalid_request_error, ook als de vraag de tool niet eens nodig had -
// niet een gedeeltelijke degradatie. Zonder terugval zou dat de complete
// /vraag-functie platleggen zodra die ene externe dienst hapert.
function isMcpConnectionError(status: number, body: string): boolean {
  return status === 400 && /MCP server/i.test(body);
}

async function callClaudeOnce(userMessage: string, options: CallClaudeOptions, apiKey: string, model: string): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const response = await fetch(ANTHROPIC_MESSAGES_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      ...(options.mcpServers?.length ? { "anthropic-beta": MCP_BETA_HEADER } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens,
      ...(options.system ? { system: options.system } : {}),
      ...(options.mcpServers?.length ? { mcp_servers: options.mcpServers.map((server) => ({ type: "url", url: server.url, name: server.name })) } : {}),
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    return { ok: false, status: response.status, body: await response.text() };
  }
  const document = (await response.json()) as { content?: ContentBlock[]; stop_reason?: string };
  // Bij een MCP-toolaanroep bevat content ook mcp_tool_use/mcp_tool_result-
  // blokken vóór het uiteindelijke tekstblok - de API handelt de hele
  // tool-loop server-side af binnen dit ene antwoord. Het laatste
  // tekstblok is de definitieve synthese; eerdere tekstblokken (zeldzaam)
  // zijn tussentijdse toelichting, niet het eindresultaat.
  const textBlocks = document.content?.filter((block) => block.type === "text" && block.text);
  const text = textBlocks?.at(-1)?.text;
  if (!text) throw new Error("Anthropic API gaf geen tekstantwoord terug.");
  if (document.stop_reason === "max_tokens") {
    throw new AnthropicTruncatedError("Anthropic API kapte het antwoord af (max_tokens bereikt).");
  }
  return { ok: true, text };
}

export async function callClaude(userMessage: string, options: CallClaudeOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicConfigError("ANTHROPIC_API_KEY ontbreekt - zet deze als Cloudflare Workers-secret.");
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const result = await callClaudeOnce(userMessage, options, apiKey, model);
  if (result.ok) return result.text;
  if (options.mcpServers?.length && isMcpConnectionError(result.status, result.body)) {
    console.info(JSON.stringify({ event: "vraag.mcp-onbereikbaar", message: "rce-cho MCP-server niet bereikbaar, terugval zonder MCP-tools" }));
    const fallback = await callClaudeOnce(userMessage, { ...options, mcpServers: undefined }, apiKey, model);
    if (fallback.ok) return fallback.text;
    throw new Error(`Anthropic API antwoordde met ${fallback.status}`, { cause: fallback.status });
  }
  throw new Error(`Anthropic API antwoordde met ${result.status}`, { cause: result.status });
}
