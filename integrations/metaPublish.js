// Instagram Content Publishing via the Meta Graph API.
// Needs META_ACCESS_TOKEN (page token with instagram_content_publish) + META_IG_USER_ID.
// Instagram PULLS the media from a PUBLIC url, so each post needs a public mediaUrl
// (single image/reel) or images[] (carousel). Nothing publishes unless explicitly
// triggered (/api/publish) or AUTO_PUBLISH=on — see server.js.
import { cfgGet } from "../store.js";

const V = () => cfgGet("META_GRAPH_VERSION") || "v21.0";
const TOKEN = () => cfgGet("META_ACCESS_TOKEN");
const IG = () => cfgGet("META_IG_USER_ID");
const BASE = () => `https://graph.facebook.com/${V()}`;

export const publishReady = () => Boolean(TOKEN() && IG());

async function post(pathSeg, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN() });
  const res = await fetch(`${BASE()}/${pathSeg}`, { method: "POST", body });
  const json = await res.json();
  if (json.error) throw new Error(`[metaPublish] ${json.error.message}`);
  return json;
}
async function get(pathSeg, fields) {
  const url = new URL(`${BASE()}/${pathSeg}`);
  url.search = new URLSearchParams({ fields, access_token: TOKEN() }).toString();
  const json = await (await fetch(url)).json();
  if (json.error) throw new Error(`[metaPublish] ${json.error.message}`);
  return json;
}

// Reels/videos process asynchronously — wait for the container to be FINISHED.
async function waitReady(creationId, tries = 24) {
  for (let i = 0; i < tries; i++) {
    const j = await get(creationId, "status_code,status");
    if (j.status_code === "FINISHED") return;
    if (j.status_code === "ERROR") throw new Error(`[metaPublish] media processing failed`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("[metaPublish] media processing timed out");
}

// item: { mediaUrl?, images?[], caption, kind: "image"|"reel"|"carousel" }
export async function publish(item) {
  if (!publishReady()) throw new Error("Meta publishing not configured (META_ACCESS_TOKEN / META_IG_USER_ID)");
  const caption = item.caption || "";
  let creationId;

  if ((item.images && item.images.length > 1) || item.kind === "carousel") {
    const imgs = item.images || (item.mediaUrl ? [item.mediaUrl] : []);
    if (imgs.length < 2) throw new Error("carousel needs 2+ image URLs (images[])");
    const children = [];
    for (const url of imgs) {
      const { id } = await post(`${IG()}/media`, { image_url: url, is_carousel_item: "true" });
      children.push(id);
    }
    ({ id: creationId } = await post(`${IG()}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }));
  } else if (item.kind === "reel") {
    const url = item.mediaUrl || (item.images && item.images[0]);
    if (!url) throw new Error("reel needs a public video URL (mediaUrl)");
    ({ id: creationId } = await post(`${IG()}/media`, { media_type: "REELS", video_url: url, caption }));
    await waitReady(creationId);
  } else {
    const url = item.mediaUrl || (item.images && item.images[0]);
    if (!url) throw new Error("post needs a public image URL (mediaUrl)");
    ({ id: creationId } = await post(`${IG()}/media`, { image_url: url, caption }));
  }

  const { id } = await post(`${IG()}/media_publish`, { creation_id: creationId });
  let permalink = null;
  try { permalink = (await get(id, "permalink")).permalink || null; } catch (e) { /* non-fatal */ }
  return { id, permalink, at: new Date().toISOString() };
}

// Publish a Story (image). Instagram pulls the public imageUrl. Requires the
// same content-publish permission; STORIES media type on the IG user node.
export async function publishStory(imageUrl) {
  if (!publishReady()) throw new Error("Meta publishing not configured");
  const { id: creationId } = await post(`${IG()}/media`, { image_url: imageUrl, media_type: "STORIES" });
  const { id } = await post(`${IG()}/media_publish`, { creation_id: creationId });
  return { id, at: new Date().toISOString() };
}

// Map a dashboard queue item to publish input; returns null if no public media yet.
export function fromQueueItem(q) {
  const media = q.images ? { images: q.images } : q.mediaUrl ? { mediaUrl: q.mediaUrl } : null;
  if (!media) return null;
  const kind = q.images && q.images.length > 1 ? "carousel" : (q.ty || "").includes("ريل") ? "reel" : "image";
  return { ...media, caption: q.cap || q.t || "", kind };
}
