// Claude adapter — powers the CAIMO manager chat. Key read dynamically (env or
// Connections page). SDK imported lazily so the app runs fine without it in
// mock mode; returns null when not configured so the server falls back cleanly.
import { cfgGet } from "../store.js";

const KEY = () => cfgGet("ANTHROPIC_API_KEY");
const MODEL = () => cfgGet("ANTHROPIC_MODEL") || "claude-opus-4-8";

export const claudeReady = () => Boolean(KEY());

// history: [{ role: "user"|"manager", text }]  →  assistant reply text (or null).
export async function chat(history, system) {
  if (!claudeReady()) return null;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: KEY() });
  const messages = (history || [])
    .filter((m) => m.text)
    .map((m) => ({ role: m.role === "manager" ? "assistant" : "user", content: m.text }));
  const resp = await client.messages.create({
    model: MODEL(),
    max_tokens: 1024,
    system,
    messages
  });
  return resp.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim() || null;
}
