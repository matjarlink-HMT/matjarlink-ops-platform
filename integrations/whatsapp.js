// WhatsApp Cloud API adapter. Token/phone read dynamically (env or Connections page).
// Incoming messages arrive via webhook (server /webhook/whatsapp) and buffer in memory.
import { cfgGet } from "../store.js";

const TOKEN = () => cfgGet("WHATSAPP_TOKEN");
const PHONE_ID = () => cfgGet("WHATSAPP_PHONE_ID");
const V = () => cfgGet("META_GRAPH_VERSION") || "v19.0";

export const whatsappReady = () => Boolean(TOKEN() && PHONE_ID());
export const inbox = [];

export function ingestWebhook(body) {
  try {
    const msgs = body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const m of msgs) inbox.unshift({ ch: "WA", id: m.id, who: "+" + (m.from || ""), tx: m.text?.body || "[وسائط]", tm: "الآن", sug: "" });
    if (inbox.length > 50) inbox.length = 50;
  } catch (e) {}
}
export function getMessages() { return whatsappReady() ? inbox.slice(0, 25) : []; }
export async function sendMessage(to, text) {
  if (!whatsappReady()) throw new Error("[whatsapp] not configured");
  const res = await fetch(`https://graph.facebook.com/${V()}/${PHONE_ID()}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } })
  });
  const json = await res.json();
  if (json.error) throw new Error(`[whatsapp] ${json.error.message}`);
  return json;
}
