// WhatsApp Cloud API adapter.
// Incoming messages arrive via webhook (see server.js /webhook/whatsapp) and are
// buffered in-memory; outgoing replies go through the Cloud API send endpoint.

const TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const V = process.env.META_GRAPH_VERSION || "v19.0";

export const whatsappReady = () => Boolean(TOKEN && PHONE_ID);

// simple in-memory inbox populated by the webhook
export const inbox = [];

export function ingestWebhook(body) {
  try {
    const msgs = body?.entry?.[0]?.changes?.[0]?.value?.messages || [];
    for (const m of msgs) {
      inbox.unshift({
        ch: "WA", id: m.id, who: "+" + (m.from || ""),
        tx: m.text?.body || "[وسائط]", tm: "الآن", sug: ""
      });
    }
    if (inbox.length > 50) inbox.length = 50;
  } catch (e) { /* ignore malformed */ }
}

export function getMessages() {
  return whatsappReady() ? inbox.slice(0, 25) : [];
}

export async function sendMessage(to, text) {
  if (!whatsappReady()) throw new Error("[whatsapp] not configured");
  const res = await fetch(`https://graph.facebook.com/${V}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } })
  });
  const json = await res.json();
  if (json.error) throw new Error(`[whatsapp] ${json.error.message}`);
  return json;
}
