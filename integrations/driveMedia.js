// Fetches a PUBLIC Google Drive file (shared "Anyone with the link — Viewer")
// and returns its bytes, so the server can re-serve it as a clean public media
// URL that Instagram's publishing API can pull. Handles Drive's large-file
// "confirm" interstitial. No Google auth needed — the file must be public.
const DL = "https://drive.usercontent.google.com/download";

export async function fetchDrive(id) {
  let res = await fetch(`${DL}?id=${encodeURIComponent(id)}&export=download&confirm=t`, { redirect: "follow" });
  let ct = res.headers.get("content-type") || "";
  // Large files return an HTML confirm page — parse it and re-request.
  if (ct.includes("text/html")) {
    const html = await res.text();
    const p = {};
    for (const m of html.matchAll(/name="([^"]+)"\s+value="([^"]*)"/g)) p[m[1]] = m[2];
    const qs = new URLSearchParams({ id, export: "download", confirm: p.confirm || "t" });
    if (p.uuid) qs.set("uuid", p.uuid);
    res = await fetch(`${DL}?${qs.toString()}`, { redirect: "follow" });
    ct = res.headers.get("content-type") || "";
  }
  if (!res.ok) throw new Error(`drive ${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), contentType: ct };
}
