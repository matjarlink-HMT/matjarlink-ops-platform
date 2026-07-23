// Load i18n with the SAME ?v= build stamp this module was loaded with, so a new
// deploy always fetches the matching (fresh) translations, never a cached set.
const { LANGS, I18N } = await import("./i18n.js" + (new URL(import.meta.url).search || ""));

let S = null, A = null, mediaIdx = 0;
let lang = localStorage.getItem("ml_lang") || "ar";
let autoTimer = null;
let pf = { plat: "all", type: "all", status: "all", view: "carousel", focus: 0, cal: "2026-07" }; // pipeline state
const T = (k) => (I18N[lang] && I18N[lang][k]) || I18N.ar[k] || k;
const $ = (s) => document.querySelector(s);
const CH = { IG: "#C13584", FB: "#1877F2", WA: "#25D366", TT: "#111111", LI: "#0A66C2", TH: "#111111", AN: "#7A5A1A", AI: "#6E56CF" };
const GLYPH = {
  IG: `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="#fff" stroke-width="1.4"><rect x="2.3" y="2.3" width="11.4" height="11.4" rx="3.4"/><circle cx="8" cy="8" r="3"/><circle cx="11.4" cy="4.6" r=".85" fill="#fff" stroke="none"/></svg>`,
  FB: `<svg viewBox="0 0 16 16" width="11" height="11" fill="#fff"><path d="M9.6 16v-6h2l.35-2.4H9.6V6.05c0-.7.22-1.15 1.2-1.15H12V2.7C11.5 2.63 10.7 2.6 9.85 2.6 8 2.6 6.8 3.73 6.8 5.75V7.6H4.7V10h2.1v6z"/></svg>`,
  WA: `<svg viewBox="0 0 16 16" width="11" height="11" fill="#fff"><path d="M8 1.7A6.3 6.3 0 0 0 2.5 11.1L1.7 14l3-.8A6.3 6.3 0 1 0 8 1.7zm3 8.9c-.15.4-.75.75-1 .78-.28.03-.28.24-1.75-.37C6.4 10.2 5.5 8.6 5.42 8.5c-.07-.1-.6-.8-.6-1.5s.36-1.06.5-1.2c.13-.15.28-.18.37-.18h.27c.1 0 .2-.03.33.25l.5 1.2c.04.1.07.2 0 .3l-.15.24-.22.24c-.07.07-.15.15-.06.3.08.15.4.66.85 1.06.6.5 1.05.66 1.2.73.15.08.24.07.33-.04l.5-.58c.1-.15.22-.1.36-.06l1.13.53c.14.07.24.1.28.16.03.06.03.35-.12.74z"/></svg>`,
  TT: `<svg viewBox="0 0 16 16" width="11" height="11" fill="#fff"><path d="M9.8 2c.2 1.4 1 2.35 2.5 2.5v1.9c-.9 0-1.7-.25-2.5-.75v3.75A3.45 3.45 0 1 1 6.3 5.05v1.95a1.6 1.6 0 1 0 1.6 1.6V2z"/></svg>`,
  LI: `<svg viewBox="0 0 16 16" width="11" height="11" fill="#fff"><path d="M4.2 5.7H2.4V13h1.8zM3.3 2.6a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1zM7.1 5.7H5.4V13h1.7V9.1c0-1 .2-1.95 1.35-1.95S9.5 8.2 9.5 9.2V13h1.75V8.8c0-2-.45-3.35-2.7-3.35-1.05 0-1.55.6-1.8 1z"/></svg>`,
  TH: `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="#fff" stroke-width="1.2"><path d="M8 14c-3.3 0-5-2.4-5-6s1.9-6 5-6c2.4 0 3.9 1.3 4.4 3.1M8.2 10.7c1.4 0 2.4-.7 2.4-1.8 0-1-.9-1.6-2-1.6-1.4 0-2.2.8-2.2 1.7 0 1 .9 1.5 1.9 1.5 1.9 0 2.7-1.3 2.7-3.1"/></svg>`,
  AN: `<svg viewBox="0 0 16 16" width="11" height="11" fill="#fff"><rect x="2" y="9" width="2.6" height="5" rx=".5"/><rect x="6.7" y="5" width="2.6" height="9" rx=".5"/><rect x="11.4" y="7" width="2.6" height="7" rx=".5"/></svg>`,
  AI: `<svg viewBox="0 0 16 16" width="11" height="11" fill="#fff"><path d="M8 1.4l1.15 3.9 3.9 1.15-3.9 1.15L8 11.5 6.85 7.6 2.95 6.45l3.9-1.15zM12.6 10.4l.5 1.7 1.7.5-1.7.5-.5 1.7-.5-1.7-1.7-.5 1.7-.5z"/></svg>`
};
const chan = (k) => `<span class="chan" style="background:${CH[k] || "#888"}">${GLYPH[k] || k}</span>`;
const pill = (a) => a ? `<span class="pill ${a[1]}">${a[0]}</span>` : "";
const STMAP = { online: "p-ok", working: "p-info", scheduled: "p-info", idle: "p-idle", action: "p-bad", new: "p-new" };
const GROUPS = [
  { items: ["needs"] },
  { items: ["overview"] },
  { label: "g_manage", items: ["approvals", "agents"] },
  { label: "g_content", items: ["templates", "plan", "pipeline"] },
  { label: "g_engage", items: ["comments", "messages", "leads"] },
  { label: "g_perf", items: ["analytics", "camp"] },
  { label: "g_settings", items: ["settings"] }
];
const HAS_COUNT = { agents: "agents", needs: "needs", pipeline: "queue", comments: "comments", messages: "messages", leads: "leads" };
const escapeHtml = (s) => (s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/\n/g, "<br>");
let chatReady = false;

let gc = 0;
function chart(series, color, h = 70) {
  if (!series || !series.length) return "";
  const w = 300, max = Math.max(...series), min = Math.min(...series), rng = (max - min) || 1;
  const pts = series.map((v, i) => [i / (series.length - 1) * w, h - ((v - min) / rng) * (h - 10) - 5]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const id = "cg" + (gc++);
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".30"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L ${w} ${h} L 0 ${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2"/>
    <circle cx="${pts.at(-1)[0].toFixed(1)}" cy="${pts.at(-1)[1].toFixed(1)}" r="3.4" fill="${color}"/></svg>`;
}
const nf = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

// classify a queue item for filtering / status display
function postType(q) { const t = q.ty || ""; if (t.includes("ريل")) return "reel"; if (t.includes("كاروسيل")) return "carousel"; if (t.includes("استطلاع") || t.includes("تفاعلي")) return "poll"; if (t.includes("ستوري")) return "story"; return "post"; }
function postStatus(q) { const nt = (S.notes && S.notes[q.id]) || {}; if (S.publishedLog && S.publishedLog[q.id]) return "published"; if (nt.status === "معتمد") return "approved"; if (q.gen) return "generated"; return "pending"; }

// ── boot ──────────────────────────────────────────────────────────
async function boot() {
  applyLang();
  try {
    [S, A] = await Promise.all([
      fetch("/api/state").then(r => r.json()),
      fetch("/api/analytics?range=7d").then(r => r.json())
    ]);
  } catch (e) { $("#content").innerHTML = `<div class="loading">تعذّر الاتصال بالخادم.</div>`; return; }
  buildChrome();
  const active = document.querySelector("#nav button.on")?.dataset.go || "overview";
  render(active);
  updateNotif();
  if (!autoTimer) autoTimer = setInterval(refresh, 60000);
}
async function refresh() {
  try { S = await fetch("/api/state").then(r => r.json()); } catch (e) { return; }
  buildNav(); updateNotif();
  const active = document.querySelector("#nav button.on")?.dataset.go;
  // don't blow away pages holding live input / typed notes
  // pages with live text inputs must not be re-rendered under the user's fingers
  if (active && !["studio", "pipeline", "manager", "settings", "comments", "messages", "leads", "plan"].includes(active)) render(active);
}
function applyLang() {
  const L = LANGS[lang]; document.documentElement.lang = lang; document.documentElement.dir = L.dir;
}
function buildChrome() {
  $("#sub").textContent = T("sub");
  $("#brandsub").textContent = T("brand_sub");
  $("#langsel").innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === lang ? "selected" : ""}>${v.name}</option>`).join("");
  $("#langsel").onchange = (e) => { lang = e.target.value; localStorage.setItem("ml_lang", lang); applyLang(); buildChrome(); const a = document.querySelector("#nav button.on")?.dataset.go || "overview"; render(a); };
  const c = S.connectivity || {};
  const b = $("#banner");
  if (S.mode === "live") { b.className = "banner live"; b.innerHTML = `<span class="dotlive"></span> <b>${T("mode_live")}</b> — Meta ${c.meta ? "✓" : "—"} · WhatsApp ${c.whatsapp ? "✓" : "—"} · Windsor ${c.windsor ? "✓" : "—"}`; }
  else { b.className = "banner mock"; b.innerHTML = `<b>${T("mode_mock")}</b> — ${T("mode_mock_hint")}`; }
  $("#conn").textContent = T("updated") + ": " + (S.generatedAt || "").slice(11, 16);
  buildNav();
}
function buildNav() {
  const active = document.querySelector("#nav button.on")?.dataset.go || "overview";
  $("#nav").innerHTML = GROUPS.map(g => {
    const head = g.label ? `<div class="navgroup">${T("nav_" + g.label)}</div>` : "";
    return head + g.items.map(n => {
      const cnt = HAS_COUNT[n] && S[HAS_COUNT[n]] ? S[HAS_COUNT[n]].length : "";
      return `<button data-go="${n}" class="${n === active ? "on" : ""}"><span>${T("nav_" + n)}</span>${cnt !== "" ? `<span class="cnt">${cnt}</span>` : ""}</button>`;
    }).join("");
  }).join("");
  document.querySelectorAll("#nav button").forEach(b => b.onclick = () => {
    document.querySelectorAll("#nav button").forEach(x => x.classList.remove("on")); b.classList.add("on");
    $("#ptitle").textContent = T("nav_" + b.dataset.go); render(b.dataset.go); window.scrollTo(0, 0);
    if (window.innerWidth < 820) $("#sidebar").classList.remove("open");
  });
  $("#ptitle").textContent = T("nav_" + (document.querySelector("#nav button.on")?.dataset.go || "overview"));
}

// ── router ────────────────────────────────────────────────────────
function render(p) {
  const C = $("#content");
  if (p === "overview") {
    C.innerHTML = ovv();
    C.querySelectorAll("[data-goview]").forEach(b => b.onclick = () => {
      const t = document.querySelector(`#nav button[data-go="${b.dataset.goview}"]`); if (t) t.click();
    });
  }
  else if (p === "approvals") renderApprovals(C);
  else if (p === "agents") renderTeam(C);
  else if (p === "needs") renderNeeds(C);
  else if (p === "studio") renderStudio(C);
  else if (p === "pipeline") renderPipeline(C);
  else if (p === "plan") renderPlan(C);
  else if (p === "templates") renderTemplates(C);
  else if (p === "analytics") renderAnalytics(C);
  else if (p === "camp") C.innerHTML = campView();
  else if (p === "comments") { C.innerHTML = feed(S.comments, "c", "comment"); bindReply(); }
  else if (p === "messages") { C.innerHTML = feed(S.messages, "m", "dm"); bindReply(); }
  else if (p === "leads") renderLeads(C);
  else if (p === "manager") renderManager(C);
  else if (p === "settings") renderSettings(C);
}

// ── Studio ── create → adaptive preview → approve / regenerate → recent (publish/schedule/download) ──
const STUDIO_TYPE_LIST = [{ id: "post", e: "🖼" }, { id: "carousel", e: "🎠" }, { id: "reel", e: "🎬" }, { id: "story", e: "📲" }];
const STUDIO_PLATFORMS = ["instagram", "facebook", "tiktok", "snapchat", "x"];
let studioDraft = null;   // draft currently in the preview panel
let studioChar = "";      // selected character id (visual picker)
let studioChars = [];     // [{id,label}]

async function renderStudio(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  let meta = { characters: [], templates: ["classic", "luxe", "spotlight"], drafts: [] };
  try { meta = await fetch("/api/studio/drafts").then(r => r.json()); } catch (e) {}
  studioChars = meta.characters || [];
  const tpls = meta.templates || ["classic", "luxe", "spotlight"];
  const typeCards = STUDIO_TYPE_LIST.map((t, i) => `<button type="button" class="seg ${i === 0 ? "on" : ""}" data-stype="${t.id}">${t.e} ${T("studio_type_" + t.id)}</button>`).join("");
  const tplCards = tpls.map((t, i) => `<button type="button" class="seg ${i === 0 ? "on" : ""}" data-stpl="${t}">${T("tpl_" + t)}</button>`).join("");
  const platOpts = STUDIO_PLATFORMS.map((p, i) => `<option value="${p}" ${i === 0 ? "selected" : ""}>${T("plat_" + p)}</option>`).join("");
  const charCards = `<button type="button" class="charpick ${!studioChar ? "on" : ""}" data-char="" title="${T("studio_char_none")}">🚫</button>` +
    studioChars.map(c => `<button type="button" class="charpick ${studioChar === c.id ? "on" : ""}" data-char="${c.id}" title="${escapeHtml(c.label)}"><img src="/media/character/${c.id}" loading="lazy"></button>`).join("");
  const approved = (meta.drafts || []).filter(d => d.approved);
  C.innerHTML = `<div class="note-info">🎨 ${T("studio_hint")}</div>
    <div class="grid g2">
      <div class="pcard nofloat">
        <label class="slbl">${T("studio_type")}</label><div class="segrow" id="stypes">${typeCards}</div>
        <label class="slbl">${T("studio_template")}</label><div class="segrow" id="stpls">${tplCards}</div>
        <label class="slbl">${T("studio_platform")}</label><select id="splatform" class="sinput">${platOpts}</select>
        <label class="slbl">${T("studio_character")}</label><div class="charrow" id="scharrow">${charCards}</div>
        <label class="slbl">${T("studio_idea")}</label><input id="sidea" class="sinput" placeholder="${T("studio_idea_ph")}">
        <label class="slbl">${T("studio_headline")} <span class="mut">· ${T("studio_optional")}</span></label><input id="shead" class="sinput" placeholder="${T("studio_headline_ph")}">
        <label class="slbl">${T("studio_desc")} <span class="mut">· ${T("studio_optional")}</span></label><textarea id="sdesc" class="sinput" rows="2" placeholder="${T("studio_desc_ph")}"></textarea>
        <button class="btn" id="sgen" style="margin-top:.9rem;width:100%">✨ ${T("studio_generate")}</button>
        <div class="mut" id="smsg" style="margin-top:.5rem"></div>
      </div>
      <div class="pcard nofloat" id="spreview"><div class="mut" style="text-align:center;padding:2.5rem 0">${T("studio_preview_empty")}</div></div>
    </div>
    <h3 style="margin:1.4rem 0 .6rem">🗂 ${T("studio_recent")}</h3>
    <div class="grid g3" id="sdrafts">${approved.map(studioDraftCard).join("") || `<div class="mut">${T("studio_no_drafts")}</div>`}</div>`;
  C.querySelectorAll("[data-stype]").forEach(b => b.onclick = () => { C.querySelectorAll("[data-stype]").forEach(x => x.classList.remove("on")); b.classList.add("on"); });
  C.querySelectorAll("[data-stpl]").forEach(b => b.onclick = () => { C.querySelectorAll("[data-stpl]").forEach(x => x.classList.remove("on")); b.classList.add("on"); });
  C.querySelectorAll(".charpick").forEach(b => b.onclick = () => { C.querySelectorAll(".charpick").forEach(x => x.classList.remove("on")); b.classList.add("on"); studioChar = b.dataset.char; });
  $("#sgen").onclick = () => studioGenerate(C);
  bindStudioDrafts(C);
}
function studioSel(C) {
  return {
    type: C.querySelector("[data-stype].on")?.dataset.stype || "post",
    template: C.querySelector("[data-stpl].on")?.dataset.stpl || "classic",
    platform: $("#splatform")?.value || "instagram", character: studioChar || "",
    idea: $("#sidea")?.value || "", headline: $("#shead")?.value || "", description: $("#sdesc")?.value || "", lang,
  };
}
async function studioGenerate(C, notes) {
  const sel = studioSel(C);
  if (!sel.idea.trim() && !sel.headline.trim() && !(notes || "").trim()) { const m = $("#smsg"); if (m) m.textContent = "⚠ " + T("studio_need_idea"); return; }
  const btn = $("#sgen"); if (btn) btn.disabled = true;
  const pv = $("#spreview"); pv.innerHTML = `<div class="mut" style="text-align:center;padding:2.5rem 0"><span class="dots"><i></i><i></i><i></i></span><br>${T("studio_generating")}</div>`;
  try {
    const body = { ...sel, draftId: studioDraft?.id, notes: notes || "" };
    const r = await fetch("/api/studio/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(x => x.json());
    if (!r.ok) pv.innerHTML = `<div class="mut" style="padding:1rem">${escapeHtml(r.error || "failed")}</div>`;
    else { studioDraft = r.draft; renderStudioPreview(r.draft); }
  } catch (e) { pv.innerHTML = `<div class="mut">${escapeHtml(String(e))}</div>`; }
  if (btn) btn.disabled = false;
}
// Adaptive media: reel → player · carousel → nav arrows + dots · else → image.
function studioMediaHtml(d) {
  if ((d.mediaUrl || "").includes(".mp4")) return `<video src="${d.mediaUrl}" controls playsinline style="width:100%;border-radius:12px;background:#000"></video>`;
  const imgs = (d.images && d.images.length) ? d.images : [d.mediaUrl].filter(Boolean);
  if (imgs.length > 1) {
    return `<div class="carv" data-idx="0" data-imgs='${JSON.stringify(imgs)}'>
      <img class="carimg" src="${imgs[0]}">
      <button type="button" class="carnav cprev" aria-label="prev">‹</button>
      <button type="button" class="carnav cnext" aria-label="next">›</button>
      <div class="cardots">${imgs.map((_, i) => `<span class="${i === 0 ? "on" : ""}"></span>`).join("")}</div>
    </div>`;
  }
  return `<img src="${imgs[0] || ""}" style="width:100%;border-radius:12px">`;
}
function bindCarousels(root) {
  (root || document).querySelectorAll(".carv").forEach(v => {
    let imgs = []; try { imgs = JSON.parse(v.dataset.imgs || "[]"); } catch (e) {}
    if (imgs.length < 2) return;
    const img = v.querySelector(".carimg"), dots = [...v.querySelectorAll(".cardots span")];
    const go = (n) => { let i = (+v.dataset.idx || 0) + n; if (i < 0) i = imgs.length - 1; if (i >= imgs.length) i = 0; v.dataset.idx = i; img.src = imgs[i]; dots.forEach((d, k) => d.classList.toggle("on", k === i)); };
    v.querySelector(".cprev").onclick = () => go(-1); v.querySelector(".cnext").onclick = () => go(1);
  });
}
function renderStudioPreview(d) {
  const pv = $("#spreview"); if (!pv) return;
  const dl = (d.id || "design") + ((d.mediaUrl || "").includes(".mp4") ? ".mp4" : ".png");
  pv.innerHTML = `${studioMediaHtml(d)}
    <div style="margin-top:.7rem;display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn ok sm" id="sappr">✓ ${T("studio_approve")}</button>
      <button class="btn sm" id="sregen">↻ ${T("studio_regen")}</button>
      <a class="btn ghost sm" href="${d.mediaUrl}" download="${dl}" target="_blank">⬇ ${T("studio_download")}</a>
    </div>
    <div id="sregenbox" style="display:none;margin-top:.6rem">
      <textarea id="snotes" class="sinput" rows="2" placeholder="${T("studio_notes_ph")}"></textarea>
      <button class="btn sm" id="sregengo" style="margin-top:.4rem">↻ ${T("studio_regen_go")}</button>
    </div>
    <div class="mut" id="sactmsg" style="margin-top:.5rem"></div>`;
  bindCarousels(pv);
  $("#sappr").onclick = () => studioApprove(d);
  $("#sregen").onclick = () => { const b = $("#sregenbox"); b.style.display = b.style.display === "none" ? "block" : "none"; };
  $("#sregengo").onclick = () => studioGenerate($("#content"), $("#snotes")?.value || "");
}
async function studioApprove(d) {
  const m = $("#sactmsg"); if (m) m.textContent = "…";
  const r = await fetch("/api/studio/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id }) }).then(x => x.json()).catch(() => null);
  if (r && r.ok) {
    if (m) m.textContent = "✓ " + T("studio_approved");
    studioDraft = null;
    setTimeout(() => { const pv = $("#spreview"); if (pv) pv.innerHTML = `<div class="mut" style="text-align:center;padding:2.5rem 0">${T("studio_approved_hint")}</div>`; }, 700);
    refreshStudioDrafts();
  } else if (m) m.textContent = "⚠ " + ((r && r.error) || T("studio_failed"));
}
function studioDraftCard(d) {
  const dl = (d.id || "design") + ((d.mediaUrl || "").includes(".mp4") ? ".mp4" : ".png");
  return `<div class="tplcard">
    <div class="tplshots" style="grid-template-columns:1fr">${studioMediaHtml(d)}</div>
    <div class="tpldesc">${escapeHtml((d.t || "").slice(0, 50))}</div>
    <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.3rem">
      <button class="btn ok sm sdpub" data-draftid="${d.id}">🚀 ${T("studio_publish")}</button>
      <button class="btn sm sdsched" data-draftid="${d.id}">🗓 ${T("studio_schedule")}</button>
      <a class="btn ghost sm" href="${d.mediaUrl}" download="${dl}" target="_blank">⬇</a>
      <button class="btn ghost sm sddel" data-draftid="${d.id}">🗑</button>
    </div>
    <div class="sdschedbox" data-draftid="${d.id}" style="display:none;margin-top:.4rem">
      <input type="datetime-local" class="sinput sddate">
      <button class="btn sm sdschedgo" data-draftid="${d.id}" style="margin-top:.3rem">${T("studio_confirm_schedule")}</button>
    </div>
    <div class="mut sdmsg" data-draftid="${d.id}" style="margin-top:.3rem"></div>
  </div>`;
}
async function refreshStudioDrafts() {
  try { const m = await fetch("/api/studio/drafts").then(r => r.json()); const host = $("#sdrafts");
    if (host) { const ap = (m.drafts || []).filter(d => d.approved); host.innerHTML = ap.map(studioDraftCard).join("") || `<div class="mut">${T("studio_no_drafts")}</div>`; bindStudioDrafts(host); }
  } catch (e) {}
}
function bindStudioDrafts(C) {
  const R = C || document;
  R.querySelectorAll(".sdpub").forEach(b => b.onclick = async () => {
    if (!confirm(T("studio_publish_confirm"))) return;
    const id = b.dataset.draftid, m = R.querySelector(`.sdmsg[data-draftid="${id}"]`); if (m) m.textContent = "…";
    const r = await fetch("/api/studio/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) { if (m) m.textContent = "✓ " + T("studio_published"); refreshStudioDrafts(); } else if (m) m.textContent = "⚠ " + ((r && r.error) || T("studio_failed"));
  });
  R.querySelectorAll(".sdsched").forEach(b => b.onclick = () => { const box = R.querySelector(`.sdschedbox[data-draftid="${b.dataset.draftid}"]`); if (box) box.style.display = box.style.display === "none" ? "block" : "none"; });
  R.querySelectorAll(".sdschedgo").forEach(b => b.onclick = async () => {
    const id = b.dataset.draftid, box = R.querySelector(`.sdschedbox[data-draftid="${id}"]`), v = box?.querySelector(".sddate")?.value, m = R.querySelector(`.sdmsg[data-draftid="${id}"]`);
    if (!v) { if (m) m.textContent = "⚠ " + T("studio_pick_date"); return; }
    if (m) m.textContent = "…";
    const r = await fetch("/api/studio/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, date: v.replace("T", " ") }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) { if (m) m.textContent = "✓ " + T("studio_scheduled"); refreshStudioDrafts(); } else if (m) m.textContent = "⚠ " + ((r && r.error) || T("studio_failed"));
  });
  R.querySelectorAll(".sddel").forEach(b => b.onclick = async () => {
    await fetch("/api/studio/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.dataset.draftid }) }).catch(() => {});
    refreshStudioDrafts();
  });
  bindCarousels(R);
}

// ── content plan (خطة المحتوى) ── month tabs · editable table · one-click apply ──
const PLAN_TYPES = ["ريل تشويقي", "كاروسيل توعوي", "منشور علامة", "تفاعلي + استطلاع", "مجتمعي", "كاروسيل فاخر"];
const ARMONTHS_CLIENT = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const WEEKDAYS_CLIENT = { ar: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], fa: ["یک", "دو", "سه", "چهار", "پنج", "جمعه", "شنبه"] };
let planActiveKey = null; // which month tab is open
let planViewMode = "table"; // "table" | "calendar"
let researchOpen = false;   // market-research panel expanded?

// ── Market research panel (plan page) ── daily Apify scan of relevant IG accounts
// → top trends the owner can turn into content-plan ideas with one click.
async function loadResearchPanel() {
  const host = $("#mktresearch"); if (!host) return;
  let r = null;
  try { r = await fetch("/api/research").then(x => x.json()); } catch (e) {}
  if (!r) { host.innerHTML = ""; return; }
  const open = researchOpen;
  const accounts = (r.accounts || []).join("، ");
  const tags = (r.topTags || []).map(t => `<span class="pill p-idle">#${escapeHtml(t.tag)} ${t.n}</span>`).join(" ");
  const insights = (r.insights || []).map((it, i) => `<div class="rins" style="padding:.5rem 0;border-bottom:1px solid var(--line)">
    <div class="mut">@${escapeHtml(it.acc || "")} · ❤ ${it.likes || 0}${it.comments ? " · 💬 " + it.comments : ""}</div>
    <div style="margin:.2rem 0">${escapeHtml(it.text)}</div>
    <button class="btn ghost sm rIdea" data-i="${i}">💡 ${T("res_to_idea")}</button></div>`).join("");
  host.innerHTML = `<div class="pcard nofloat" style="margin:.2rem 0 .8rem">
    <div style="display:flex;align-items:center;gap:.5rem;cursor:pointer" id="rhead"><b>🔎 ${T("res_title")}</b>
      ${r.lastRun ? `<span class="mut">${T("res_last")}: ${r.lastRun}</span>` : `<span class="mut">${T("res_never")}</span>`}
      <span style="margin-inline-start:auto">${open ? "▲" : "▼"}</span></div>
    <div id="rbody" style="display:${open ? "block" : "none"};margin-top:.6rem">
      ${!r.apifyReady ? `<div class="note-warn" style="margin-bottom:.5rem">${T("res_need_apify")}</div>` : ""}
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem">
        <input class="pinput" id="racc" value="${escapeHtml(accounts)}" placeholder="${T("res_accounts_ph")}" style="flex:1;min-width:14rem" autocomplete="off">
        <button class="btn ghost sm" id="rsave">💾</button>
        <button class="btn sm" id="rrun">🔎 ${T("res_run")}</button><span class="ok-s" id="rmsg"></span></div>
      ${tags ? `<div style="margin:.4rem 0;display:flex;gap:.3rem;flex-wrap:wrap">${tags}</div>` : ""}
      <div class="rinsights">${insights || `<div class="mut">${T("res_empty")}</div>`}</div></div></div>`;
  $("#rhead").onclick = () => { researchOpen = !researchOpen; loadResearchPanel(); };
  if (!open) return;
  const saveAccts = () => fetch("/api/research/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accounts: $("#racc").value }) });
  $("#rsave").onclick = async () => { await saveAccts(); const m = $("#rmsg"); if (m) { m.textContent = "✓"; setTimeout(() => m.textContent = "", 1500); } };
  $("#rrun").onclick = async () => {
    const b = $("#rrun"); b.disabled = true; b.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    await saveAccts();
    const x = await fetch("/api/research/run", { method: "POST" }).then(z => z.json()).catch(() => null);
    if (x && x.ok) loadResearchPanel();
    else { const m = $("#rmsg"); if (m) m.textContent = "✗ " + ((x && x.error) || ""); b.disabled = false; b.innerHTML = "🔎 " + T("res_run"); }
  };
  document.querySelectorAll(".rIdea").forEach(btn => btn.onclick = async () => {
    const it = (r.insights || [])[+btn.dataset.i]; if (!it) return;
    btn.disabled = true; btn.textContent = "…";
    const rr = await fetch("/api/plan/idea", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: it.text, month: planActiveKey }) }).then(z => z.json()).catch(() => null);
    btn.textContent = rr && rr.ok ? "✓ " + T("res_added") : "✗";
  });
}

// Monthly calendar grid; each plan item is a draggable chip on its day.
function planCalendar(plan) {
  const y = plan.year, m = plan.month;
  const first = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const daysIn = new Date(y, m, 0).getDate(); // real length of the month (28–31)
  const byDay = {}; (plan.items || []).forEach(it => { (byDay[+it.day] = byDay[+it.day] || []).push(it); });
  const wd = WEEKDAYS_CLIENT[lang] || WEEKDAYS_CLIENT.ar;
  const head = wd.map(d => `<div class="calhd">${d}</div>`).join("");
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(`<div class="calcell empty"></div>`);
  for (let d = 1; d <= daysIn; d++) {
    const items = (byDay[d] || []).map(it => {
      const locked = it.status !== "draft"; // only draft (future-plan) chips are draggable
      const c = TYCOLOR(it.ty);
      const badge = it.status === "published" ? "📤 " : it.status === "applied" ? "🔒 " : "";
      return `<div class="calchip ${locked ? "locked" : ""}" ${locked ? "" : `draggable="true"`} data-key="${escapeHtml(it.key)}" style="background:${c}" title="${escapeHtml(it.t)}">${badge}${escapeHtml((it.t || "").slice(0, 22))}<span class="calct">${escapeHtml((it.time || ""))}</span></div>`;
    }).join("");
    cells.push(`<div class="calcell" data-day="${d}"><div class="caldn">${d}</div>${items}</div>`);
  }
  return `<div class="calwrap"><div class="calgrid calhead">${head}</div><div class="calgrid calbody">${cells.join("")}</div></div>`;
}
// Brand color per post type (for calendar chips).
function TYCOLOR(ty) {
  ty = ty || "";
  if (ty.includes("ريل")) return "#6E1444";
  if (ty.includes("كاروسيل")) return "#E8890F";
  if (ty.includes("استطلاع") || ty.includes("تفاعلي")) return "#2D6FB3";
  if (ty.includes("مجتمعي")) return "#0E8C6A";
  return "#9D1F60";
}
// Drag a chip onto another day → update its day, persist, re-render.
function bindCalendarDnD(C, plan, key) {
  let dragKey = null;
  C.querySelectorAll(".calchip[draggable=true]").forEach(ch => {
    ch.ondragstart = (e) => { dragKey = ch.dataset.key; e.dataTransfer.effectAllowed = "move"; ch.classList.add("dragging"); };
    ch.ondragend = () => { dragKey = null; ch.classList.remove("dragging"); };
  });
  C.querySelectorAll(".calcell[data-day]").forEach(cell => {
    cell.ondragover = (e) => { e.preventDefault(); cell.classList.add("over"); };
    cell.ondragleave = () => cell.classList.remove("over");
    cell.ondrop = async (e) => {
      e.preventDefault(); cell.classList.remove("over");
      const k = dragKey; if (!k) return;
      const it = plan.items.find(x => x.key === k); if (!it || it.status === "applied") return;
      const newDay = +cell.dataset.day; if (newDay === +it.day) return;
      it.day = newDay;
      // persist FIRST (source of truth), then re-render — avoids the chip
      // snapping back to the old day when renderPlan re-fetches from the server.
      cell.querySelector(".caldn")?.insertAdjacentHTML("afterend", `<div class="calchip" style="background:${TYCOLOR(it.ty)};opacity:.6">…</div>`);
      await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) }).then(x => x.json()).catch(() => null);
      renderPlan(C);
    };
  });
}
async function renderPlan(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  let plans = {}, current = null;
  try { const r = await fetch("/api/plan").then(r => r.json()); plans = r.plans || {}; current = r.current || null; } catch (e) {}

  // month tabs: current-month schedule (if any) + each stored plan + next month slot
  const now = new Date(); const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nm = now.getMonth() + 1 >= 12 ? 1 : now.getMonth() + 2; const ny = now.getMonth() + 1 >= 12 ? now.getFullYear() + 1 : now.getFullYear();
  const nextKey = `${ny}-${String(nm).padStart(2, "0")}`;
  const tabs = [];
  if (current) tabs.push({ key: curKey, label: current.label, kind: "current" });
  Object.keys(plans).sort().forEach(k => { if (!tabs.some(t => t.key === k)) tabs.push({ key: k, label: plans[k].label, kind: "plan" }); });
  if (!tabs.some(t => t.key === nextKey)) tabs.push({ key: nextKey, label: `${ARMONTHS_CLIENT[nm - 1]} ${ny}`, kind: "new" });
  if (!planActiveKey || !tabs.some(t => t.key === planActiveKey)) planActiveKey = plans[nextKey] ? nextKey : (tabs.find(t => t.kind === "plan")?.key || tabs[0]?.key);
  const active = tabs.find(t => t.key === planActiveKey) || tabs[0];
  const tabBar = `<div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap"><div class="montabs" style="margin:0">${tabs.map(t => `<button class="montab ${t.key === active.key ? "on" : ""}" data-mk="${t.key}">${escapeHtml(t.label)}${t.kind === "current" ? " • " + T("plan_this_month") : t.kind === "new" && !plans[t.key] ? " +" : ""}</button>`).join("")}</div><button class="btn sm" id="planregen">✨ ${T("plan_regen")}</button></div><div class="mut" id="planregmsg" style="margin:.2rem 0 .6rem"></div><div id="mktresearch"></div>`;

  const bindTabs = () => {
    C.querySelectorAll("[data-mk]").forEach(b => b.onclick = () => { planActiveKey = b.dataset.mk; renderPlan(C); });
    loadResearchPanel();
    const rg = $("#planregen");
    if (rg) rg.onclick = async () => {
      if (!confirm(T("plan_regen_confirm"))) return;
      rg.disabled = true; rg.innerHTML = `<span class="dots"><i></i><i></i><i></i></span> ${T("plan_regen_running")}`;
      const r = await fetch("/api/plan/regenerate", { method: "POST" }).then(x => x.json()).catch(() => null);
      const m = $("#planregmsg");
      if (r && r.ok) { if (m) m.textContent = `✓ ${r.posts || 0} ${T("plan_regen_done")}`; }
      else { if (m) m.textContent = "⚠ " + ((r && r.error) || ""); rg.disabled = false; rg.innerHTML = `✨ ${T("plan_regen")}`; }
    };
  };
  const fullDate = (p, it) => `${p.year}-${String(p.month).padStart(2, "0")}-${String(it.day).padStart(2, "0")}`;
  const weekdayOf = (p, it) => { const wd = WEEKDAYS_CLIENT[lang] || WEEKDAYS_CLIENT.ar; return wd[new Date(p.year, p.month - 1, it.day).getDay()]; };
  const statusPill = (it) => it.status === "published" ? (it.permalink ? `<a class="pill p-ok" target="_blank" href="${it.permalink}">📤 ${T("s_published")} ↗</a>` : `<span class="pill p-ok">📤 ${T("s_published")}</span>`) : it.status === "approved" ? `<span class="pill p-ok">✓ ${T("s_approved")}</span>` : it.status === "held" ? `<span class="pill p-warn">✎ ${T("held")}</span>` : `<span class="pill p-info">🗓 ${T("plan_scheduled")}</span>`;
  const detailData = (it) => [it.cap, it.brief ? "📐 " + it.brief : "", it.drive ? "🖼 Drive: " + it.drive : ""].filter(Boolean).join("\n\n");

  // ── current month: real scheduled queue as an Excel-like table + calendar ──
  if (active.kind === "current" && current) {
    const rows = current.items.map(it => `<tr>
        <td class="pdate">${escapeHtml(fullDate(current, it))}</td>
        <td>${escapeHtml(weekdayOf(current, it))}</td>
        <td>${escapeHtml(it.time || "")}</td>
        <td>${escapeHtml(it.id)}</td>
        <td style="font-weight:800;min-width:12rem">${escapeHtml(it.t)}</td>
        <td><span class="pill" style="background:${TYCOLOR(it.ty)}22;color:${TYCOLOR(it.ty)}">${escapeHtml(it.ty)}</span></td>
        <td class="pstat">${statusPill(it)}</td>
        <td>${(it.cap || it.brief) ? `<button class="btn ghost sm pdet" data-cap="${attrSafe(detailData(it))}">📄</button>` : ""}${it.drive ? ` <a class="link sm" target="_blank" href="https://drive.google.com/file/d/${it.drive}/view">🖼</a>` : ""}</td>
      </tr>`).join("");
    const table = `<div class="tablewrap"><table class="plantable"><thead><tr>
        <th>${T("plan_date")}</th><th>${T("plan_weekday")}</th><th>${T("plan_time")}</th><th>#</th><th>${T("plan_title")}</th><th>${T("plan_type")}</th><th>${T("plan_status")}</th><th>${T("plan_detail")}</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
    C.innerHTML = `<div class="planwrap">${tabBar}
      <div class="pcard nofloat planhead"><div><div class="ptitle">🗓 ${escapeHtml(current.label)}</div>
        <div class="mut" style="margin-top:.35rem">${escapeHtml(current.goal)}</div></div>
        <div class="planacts"><div class="viewtog"><button class="vtbtn ${planViewMode === "table" ? "on" : ""}" data-pv="table">▤ ${T("plan_v_table")}</button><button class="vtbtn ${planViewMode === "calendar" ? "on" : ""}" data-pv="calendar">🗓 ${T("plan_v_cal")}</button></div></div></div>
      ${planViewMode === "calendar" ? planCalendar(current) : table}</div>`;
    bindTabs();
    C.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => { planViewMode = b.dataset.pv; renderPlan(C); });
    C.querySelectorAll(".pdet").forEach(b => b.onclick = () => openCap(b.dataset.cap));
    return;
  }

  const plan = plans[active.key];
  // ── empty month → generate ──
  if (!plan) {
    C.innerHTML = `<div class="planwrap">${tabBar}
      <div class="pcard nofloat planempty"><div class="ptitle">🗓 ${escapeHtml(active.label)}</div>
      <div class="mut" style="margin:.5rem 0 1rem">${T("plan_empty_d")}</div>
      <button class="btn" id="plangen">✨ ${T("plan_gen")}</button></div></div>`;
    bindTabs();
    $("#plangen").onclick = async () => {
      const b = $("#plangen"); b.disabled = true; b.innerHTML = `${T("plan_gen_loading")} <span class="dots"><i></i><i></i><i></i></span>`;
      const [yy, mo] = active.key.split("-").map(Number);
      const r = await fetch("/api/plan/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: yy, month: mo }) }).then(x => x.json()).catch(() => null);
      if (r && r.ok) renderPlan(C); else { alert((r && r.error) || "!"); b.disabled = false; b.textContent = "✨ " + T("plan_gen"); }
    };
    return;
  }

  // ── editable draft plan ──
  const applied = plan.items.filter(i => i.status === "applied").length;
  const dim = new Date(plan.year, plan.month, 0).getDate(); // days in this month
  const rows = plan.items.map((it) => {
    const dis = it.status === "applied" ? "disabled" : "";
    const detail = (it.hook || it.cap) ? `<button class="btn ghost sm pdet" data-cap="${attrSafe([it.hook ? "🎣 " + it.hook : "", it.cap].filter(Boolean).join("\n\n"))}">📄</button>` : "";
    return `<tr data-key="${escapeHtml(it.key)}" class="${it.status === "applied" ? "applied" : ""}">
      <td class="pdate">${escapeHtml(fullDate(plan, it))}</td>
      <td><input class="pinput pday" type="number" min="1" max="${dim}" value="${it.day}" ${dis}></td>
      <td><select class="psel ptime" ${dis}>${["19:30", "20:00", "20:30", "21:00"].map(t => `<option ${t === (it.time || "20:00") ? "selected" : ""}>${t}</option>`).join("")}</select></td>
      <td><input class="pinput pt" value="${escapeHtml(it.t).replace(/"/g, "&quot;")}" ${dis}></td>
      <td><select class="psel pty" ${dis}>${PLAN_TYPES.map(t => `<option ${t === it.ty ? "selected" : ""}>${t}</option>`).join("")}</select></td>
      <td><input class="pinput ppl" value="${escapeHtml(it.pillar).replace(/"/g, "&quot;")}" ${dis}></td>
      <td class="pstat">${it.status === "applied" ? `<span class="pill p-ok">✓ ${escapeHtml(it.id || "")}</span>` : `<span class="pill p-idle">${T("plan_draft")}</span>`}</td>
      <td>${detail}${it.status === "applied" ? "" : `<button class="btn ghost sm applyone" data-key="${escapeHtml(it.key)}">⬆ ${T("plan_apply")}</button>`}</td>
    </tr>`;
  }).join("");
  C.innerHTML = `<div class="planwrap">${tabBar}
    <div class="pcard nofloat planhead"><div>
        <div class="ptitle">🗓 ${escapeHtml(plan.label)}</div>
        <div class="mut" style="margin-top:.35rem">🎯 ${escapeHtml(plan.goal || "")}</div>
        <div class="pillars">${(plan.pillars || []).map(p => `<span class="pill p-info">${escapeHtml(p)}</span>`).join(" ")}</div></div>
      <div class="planacts">
        <div class="viewtog" style="margin-inline-end:.3rem"><button class="vtbtn ${planViewMode === "table" ? "on" : ""}" data-pv="table">▤ ${T("plan_v_table")}</button><button class="vtbtn ${planViewMode === "calendar" ? "on" : ""}" data-pv="calendar">🗓 ${T("plan_v_cal")}</button></div>
        <button class="btn ghost sm" id="plannew">♻️ ${T("plan_new")}</button>
        <button class="btn ghost sm" id="planslots" title="${T("plan_slots_hint")}">🪄 ${T("plan_slots")}</button>
        <button class="btn ghost sm" id="plansave">💾 ${T("plan_save")}</button>
        <button class="btn sm" id="planall">🚀 ${T("plan_apply_all")} (${plan.items.length - applied})</button></div></div>
    <div class="pcard nofloat" style="margin-bottom:1rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
      <span>💡</span><input class="pinput" id="ideain" placeholder="${T("idea_ph")}" style="flex:1;min-width:14rem" autocomplete="off">
      <button class="btn sm" id="ideago">${T("idea_add")}</button></div>
    ${planViewMode === "calendar" ? planCalendar(plan) : `<div class="tablewrap"><table class="plantable"><thead><tr>
      <th>${T("plan_date")}</th><th>${T("plan_day")}</th><th>${T("plan_time")}</th><th>${T("plan_title")}</th><th>${T("plan_type")}</th><th>${T("plan_pillar")}</th><th>${T("plan_status")}</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table></div>`}
    <div class="mut" id="planmsg" style="margin-top:.6rem">${planViewMode === "calendar" ? T("plan_cal_hint") : ""}</div></div>`;
  C.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => { planViewMode = b.dataset.pv; renderPlan(C); });
  if (planViewMode === "calendar") bindCalendarDnD(C, plan, active.key);
  bindTabs();
  C.querySelectorAll(".pdet").forEach(b => b.onclick = () => openCap(b.dataset.cap));

  const collect = () => {
    // Calendar mode has no table rows — its edits already live on plan.items
    // (updated on drop). Reading the DOM there would wipe the month.
    if (planViewMode === "calendar") return { ...plan };
    return { ...plan, items: [...C.querySelectorAll("tbody tr")].map(tr => {
      const key = tr.dataset.key, old = plan.items.find(i => i.key === key) || {};
      return { ...old, key, day: Math.min(Math.max(parseInt(tr.querySelector(".pday").value, 10) || old.day || 1, 1), dim),
        time: tr.querySelector(".ptime").value, t: tr.querySelector(".pt").value.trim(),
        ty: tr.querySelector(".pty").value, pillar: tr.querySelector(".ppl").value.trim() };
    }) };
  };
  const save = async () => {
    const r = await fetch("/api/plan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: collect() }) }).then(x => x.json());
    if (r.ok) { plans[active.key] = r.plan; $("#planmsg").textContent = "✓ " + T("plan_saved"); setTimeout(() => { const m = $("#planmsg"); if (m) m.textContent = ""; }, 2500); }
    return r.ok;
  };
  $("#plansave").onclick = save;
  const addIdea = async () => {
    const inp = $("#ideain"), text = inp.value.trim(); if (!text) return;
    const b = $("#ideago"); b.disabled = true; b.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    const r = await fetch("/api/plan/idea", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, month: active.key }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) renderPlan(C); else { alert((r && r.error) || "!"); b.disabled = false; b.textContent = T("idea_add"); }
  };
  $("#ideago").onclick = addIdea;
  $("#ideain").onkeydown = (e) => { if (e.key === "Enter") addIdea(); };
  $("#planslots").onclick = () => {
    const TIME_BY_TYPE = { "ريل": "21:00", "كاروسيل": "20:30", "استطلاع": "19:30", "تفاعلي": "19:30", "مجتمعي": "19:30" };
    const taken = new Set(plan.items.filter(i => i.status === "applied").map(i => +i.day));
    (S.queue || []).forEach(p => { const m = (p.date || "").match(new RegExp(`^${active.key}-(\\d{2})`)); if (m) taken.add(+m[1]); });
    let day = 2;
    C.querySelectorAll("tbody tr").forEach(tr => {
      if (tr.classList.contains("applied")) return;
      while (taken.has(day) && day < dim) day += 1;
      tr.querySelector(".pday").value = Math.min(day, dim);
      taken.add(day); day += 2;
      const ty = tr.querySelector(".pty").value;
      const t = Object.entries(TIME_BY_TYPE).find(([k]) => ty.includes(k));
      tr.querySelector(".ptime").value = t ? t[1] : "20:00";
    });
    $("#planmsg").textContent = "🪄 " + T("plan_slots_done");
  };
  $("#plannew").onclick = async () => {
    if (!confirm(T("plan_new_confirm"))) return;
    const b = $("#plannew"); b.disabled = true; b.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    const [yy, mo] = active.key.split("-").map(Number);
    const r = await fetch("/api/plan/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: yy, month: mo }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) renderPlan(C); else { b.disabled = false; b.textContent = "♻️ " + T("plan_new"); }
  };
  const applyOne = async (key) => {
    const r = await fetch("/api/plan/apply-item", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) }).then(x => x.json());
    if (r.ok && r.plan) plans[active.key] = r.plan;
    return r;
  };
  C.querySelectorAll(".applyone").forEach(b => b.onclick = async () => {
    b.disabled = true; b.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    await save();
    const r = await applyOne(b.dataset.key);
    if (!r.ok) { alert(r.error || "!"); }
    try { S = await fetch("/api/state").then(x => x.json()); } catch (e) {}
    renderPlan(C);
  });
  $("#planall").onclick = async () => {
    const pending = plan.items.filter(i => i.status !== "applied");
    if (!pending.length) return;
    if (!confirm(T("plan_all_confirm").replace("{n}", pending.length))) return;
    const b = $("#planall"); b.disabled = true; $("#plansave").disabled = true;
    await save();
    let done = 0, fail = 0;
    for (const it of pending) {
      b.innerHTML = `🚀 ${T("plan_applying")} ${done + fail + 1}/${pending.length} <span class="dots"><i></i><i></i><i></i></span>`;
      const r = await applyOne(it.key).catch(() => null);
      if (r && r.ok) done++; else fail++;
    }
    try { S = await fetch("/api/state").then(x => x.json()); } catch (e) {}
    buildChrome();
    await renderPlan(C);
    const m = $("#planmsg"); if (m) m.textContent = `✓ ${T("plan_done")}: ${done}` + (fail ? ` · ✗ ${fail}` : "");
  };
}
// Attribute-safe escape that PRESERVES newlines (escapeHtml turns \n into <br>,
// which double-escapes inside a pre-wrap popup). Only neutralizes & " < >.
const attrSafe = (s) => (s || "").replace(/[&"<>]/g, c => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));
// caption/detail popup reusing the media lightbox frame (real newlines via pre-wrap)
function openCap(text) {
  $("#mvtitle").textContent = T("plan_caption");
  const f = $("#mvframe"); f.style.aspectRatio = ""; f.classList.add("imgfit");
  f.innerHTML = `<div class="capbox" style="background:#fff;color:#2b1622;padding:1.4rem;max-width:34rem;white-space:pre-wrap;line-height:1.7;text-align:start;border-radius:.6rem;max-height:80vh;overflow:auto"></div>`;
  f.querySelector(".capbox").textContent = text || ""; // textContent → no double-escape, no injection
  $("#mvhint").innerHTML = ""; $("#mv").classList.add("on");
}

// ── design templates (قوالب التصميم) ── choose the active brand template ──
const TEMPLATE_META = {
  classic: { emoji: "🤍", tag: "p-idle" },
  luxe: { emoji: "👑", tag: "p-new" },
  spotlight: { emoji: "🖼", tag: "p-info" },
};
// ── «التصميم» ── one page, tabbed: studio · templates · characters · brand kit · style.
let designTab = "studio";
function renderTemplates(C) {
  const tabs = [["studio", "🎨 " + T("dz_studio")], ["templates", "🖼 " + T("dz_templates")], ["characters", "🧑🏻 " + T("dz_characters")], ["brand", "🎯 " + T("dz_brand")], ["style", "✨ " + T("dz_style")]];
  C.innerHTML = `<div class="dztabs">${tabs.map(([k, l]) => `<button type="button" class="dztab ${k === designTab ? "on" : ""}" data-dz="${k}">${l}</button>`).join("")}</div><div id="dzbody"></div>`;
  C.querySelectorAll(".dztab").forEach(b => b.onclick = () => { designTab = b.dataset.dz; C.querySelectorAll(".dztab").forEach(x => x.classList.remove("on")); b.classList.add("on"); dzRender(); });
  dzRender();
}
function dzRender() {
  const body = $("#dzbody"); if (!body) return;
  if (designTab === "studio") renderStudio(body);
  else if (designTab === "characters") renderCharacters(body, "spotlight");
  else if (designTab === "brand") renderBrandKit(body);
  else if (designTab === "style") body.innerHTML = dzStyle();
  else renderTemplatesTab(body);
}
function bindDzDelete(C, refresh) {
  C.querySelectorAll(".dzdel").forEach(b => b.onclick = async () => {
    if (!confirm(T("dz_del_confirm"))) return;
    await fetch("/api/design/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: b.dataset.kind, id: b.dataset.id }) }).catch(() => {});
    refresh();
  });
}
// Select-then-delete: checkboxes on deletable cards + one "delete selected" button.
const dzBulkBar = () => `<div class="dzbulk" style="display:flex;gap:.6rem;align-items:center;margin:.2rem 0 .8rem;flex-wrap:wrap"><button class="btn ghost sm" id="delsel" disabled>🗑 ${T("dz_del_sel")} (<span id="selcount">0</span>)</button><span class="mut">${T("dz_del_sel_hint")}</span></div>`;
function bindBulkDelete(C, refresh) {
  const upd = () => { const n = C.querySelectorAll(".selchk:checked").length; const b = C.querySelector("#delsel"); if (b) { b.disabled = !n; } const c = C.querySelector("#selcount"); if (c) c.textContent = n; };
  C.querySelectorAll(".selchk").forEach(ch => ch.onchange = upd);
  const del = C.querySelector("#delsel");
  if (del) del.onclick = async () => {
    const sel = [...C.querySelectorAll(".selchk:checked")];
    if (!sel.length || !confirm(T("dz_del_confirm_n").replace("{n}", sel.length))) return;
    del.disabled = true; del.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    for (const ch of sel) await fetch("/api/design/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: ch.dataset.kind, id: ch.dataset.id }) }).catch(() => {});
    refresh();
  };
  upd();
}
async function renderTemplatesTab(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  let data = { templates: ["classic", "luxe", "spotlight"], active: "classic", custom: [] };
  try { data = await fetch("/api/templates").then(r => r.json()); } catch (e) {}
  const v = Date.now();
  const tcard = (id, name, on, del) => `<div class="tplcard ${on ? "on" : ""}">
      <div class="tplhd"><span class="tplname">${del ? `<input type="checkbox" class="selchk" data-kind="template" data-id="${id}" title="${T("dz_select")}"> ` : ""}${name}</span>${on ? `<span class="pill p-ok">✓ ${T("tpl_active")}</span>` : ""}</div>
      <div class="tplshots"><img loading="lazy" src="/media/template/${id}/cover?v=${v}"><img loading="lazy" src="/media/template/${id}/slide?v=${v}"></div>
      <div style="display:flex;gap:.35rem;margin-top:.3rem">
        ${on ? `<button class="btn ok sm" disabled>✓ ${T("tpl_active")}</button>` : `<button class="btn sm tplpick" data-tpl="${id}" data-tplname="${escapeHtml(name)}">${T("tpl_use")}</button>`}
      </div></div>`;
  const cards = data.templates.map(t => tcard(t, (TEMPLATE_META[t]?.emoji || "🎨") + " " + T("tpl_" + t), t === data.active, false)).join("")
    + (data.custom || []).map(c => tcard(c.id, "🌙 " + escapeHtml(c.name), c.id === data.active, true)).join("");
  const anyDel = (data.custom || []).length > 0;
  C.innerHTML = `<div class="note-info">🎨 ${T("tpl_hint")}</div>${anyDel ? dzBulkBar() : ""}<div class="grid g3 tplgrid">${cards}</div><div class="mut" id="tplmsg" style="margin-top:.8rem"></div>`;
  C.querySelectorAll(".tplpick").forEach(b => b.onclick = async () => {
    const t = b.dataset.tpl;
    if (!confirm(T("tpl_confirm").replace("{t}", b.dataset.tplname || t))) return;
    b.disabled = true; b.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    const r = await fetch("/api/templates/set", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: t }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) { renderTemplatesTab(C); const m = $("#tplmsg"); if (m) m.textContent = "✓ " + T("tpl_saved"); }
    else { b.disabled = false; b.textContent = T("tpl_use"); }
  });
  bindBulkDelete(C, () => renderTemplatesTab(C));
}
async function renderBrandKit(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  let d = { data: {} }; try { d = await fetch("/api/branddata").then(r => r.json()); } catch (e) {}
  const b = d.data || {};
  const colors = [["#2D081E", "عنابي"], ["#F5821F", "برتقالي"], ["#9D1F60", "ماجنتا"], ["#FBE3C8", "كريمي"]];
  C.innerHTML = `<div class="note-info">🎯 ${T("dz_brand_hint")}</div>
    <div class="grid g2">
      <div class="pcard nofloat"><h3 style="margin:.2rem 0 .6rem">🎨 ${T("dz_colors")}</h3>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap">${colors.map(([c, n]) => `<div style="text-align:center"><div style="width:3.4rem;height:3.4rem;border-radius:10px;background:${c};border:1px solid var(--line)"></div><div class="mut" style="font-size:.72rem;margin-top:.2rem">${n}<br>${c}</div></div>`).join("")}</div>
        <h3 style="margin:1rem 0 .6rem">🔤 ${T("dz_fonts")}</h3><div class="mut">Tajawal — ExtraBold · Bold · Regular</div>
        <h3 style="margin:1rem 0 .6rem">🛍 ${T("dz_logo")}</h3>
        <div style="display:flex;gap:.6rem;align-items:center"><span style="background:var(--brand);padding:.7rem 1rem;border-radius:10px"><img src="/logo-white.png" style="height:60px"></span><img src="/logo-full.png" style="height:74px;background:#fff;padding:.3rem;border-radius:10px"></div>
      </div>
      <div class="pcard nofloat"><h3 style="margin:.2rem 0 .6rem">📇 ${T("dz_bizdata")}</h3>
        <label class="slbl">Instagram</label><input id="bz_ig" class="sinput" value="${escapeHtml(b.instagram || "")}" placeholder="matjarlink">
        <label class="slbl">${T("dz_phone")}</label><input id="bz_ph" class="sinput" value="${escapeHtml(b.phone || "")}">
        <label class="slbl">${T("dz_wa")}</label><input id="bz_wa" class="sinput" value="${escapeHtml(b.whatsapp || "")}">
        <label class="slbl">${T("dz_email")}</label><input id="bz_em" class="sinput" value="${escapeHtml(b.email || "")}">
        <label class="slbl">${T("dz_web")}</label><input id="bz_web" class="sinput" value="${escapeHtml(b.website || "")}">
        <button class="btn" id="bzsave" style="margin-top:.8rem;width:100%">💾 ${T("dz_save")}</button>
        <div class="mut" id="bzmsg" style="margin-top:.5rem">${T("dz_biz_note")}</div></div>
    </div>`;
  $("#bzsave").onclick = async () => {
    const body = { instagram: $("#bz_ig").value, phone: $("#bz_ph").value, whatsapp: $("#bz_wa").value, email: $("#bz_em").value, website: $("#bz_web").value };
    const m = $("#bzmsg"); if (m) m.textContent = "…";
    const r = await fetch("/api/branddata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null);
    if (m) m.textContent = r && r.ok ? "✓ " + T("dz_saved") : "⚠";
  };
}
function dzStyle() {
  return `<div class="note-info">✨ ${T("dz_style_hint")}</div>
    <div class="pcard nofloat"><h2 style="margin:.2rem 0 .4rem">${T("dz_style_name")}</h2>
      <p class="mut" style="max-width:60ch">${T("dz_style_body")}</p>
      <h3 style="margin:.9rem 0 .3rem">${T("dz_style_how")}</h3>
      <ol class="mut" style="line-height:1.9;max-width:60ch">${["dz_style_s1", "dz_style_s2", "dz_style_s3", "dz_style_s4"].map(k => `<li>${T(k)}</li>`).join("")}</ol></div>`;
}

// ── «الاعتماد» ── one inbox for everything pending (post/reel/character/template).
// Approve → routes to its home (design→publish queue, template→التصميم, character→
// الشخصيات). Edit → note + regenerate. Reject → discard.
const APPR_ICON = { post: "🖼", template: "🌙", character: "🧑🏻" };
async function renderApprovals(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  let d = null;
  try { d = await fetch("/api/proposals").then(r => r.json()); } catch (e) {}
  if (!d || !d.ok) { C.innerHTML = `<div class="note-info">${T("appr_hint")}</div><div class="mut">${T("appr_empty")}</div>`; return; }
  const all = [
    ...(d.posts || []).map(p => ({ ...p, kind: "post" })),
    ...(d.characters || []).map(p => ({ ...p, kind: "character" })),
    ...(d.templates || []).map(p => ({ ...p, kind: "template" })),
  ];
  const card = (p) => `<div class="tplcard">
      <div class="tplhd"><span class="tplname">${APPR_ICON[p.kind]} ${escapeHtml(p.name || p.label || p.t || "")}</span><span class="pill p-idle">${T("appr_kind_" + p.kind)}</span></div>
      <div class="tplshots" style="grid-template-columns:1fr"><img loading="lazy" src="${p.previewUrl}"></div>
      <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.4rem">
        <button class="btn ok sm aappr" data-appr="${p.id}">✓ ${T("appr_approve")}</button>
        ${p.kind === "template" ? "" : `<button class="btn sm aedit" data-appr="${p.id}">✎ ${T("appr_edit")}</button>`}
        <button class="btn ghost sm arej" data-appr="${p.id}">✕ ${T("appr_reject")}</button>
      </div>
      <div class="aeditbox" data-appr="${p.id}" style="display:none;margin-top:.4rem">
        <textarea class="sinput anote" rows="2" placeholder="${T("appr_note_ph")}"></textarea>
        <button class="btn sm aregen" data-appr="${p.id}" style="margin-top:.3rem">↻ ${T("appr_regen")}</button>
      </div>
      <div class="mut amsg" data-appr="${p.id}" style="margin-top:.3rem"></div>
    </div>`;
  C.innerHTML = `<div class="note-info">🗳 ${T("appr_hint")}</div>
    <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin:.4rem 0 1rem">
      <button class="btn sm" id="apprrun">⚡ ${T("prop_run")}</button>
      <span class="mut">${T("appr_route_note")}</span>
    </div>
    ${all.length ? `<div class="grid g3">${all.map(card).join("")}</div>` : `<div class="mut" style="padding:1rem">${T("appr_empty")}</div>`}`;
  const run = $("#apprrun");
  if (run) run.onclick = async () => { run.disabled = true; run.innerHTML = `<span class="dots"><i></i><i></i><i></i></span> ${T("prop_running")}`; await fetch("/api/proposals/run-now", { method: "POST" }).catch(() => {}); renderApprovals(C); };
  const msg = (id) => C.querySelector(`.amsg[data-appr="${id}"]`);
  C.querySelectorAll(".aappr").forEach(b => b.onclick = async () => {
    const m = msg(b.dataset.appr); if (m) m.textContent = "…";
    const r = await fetch("/api/proposals/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.dataset.appr }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) {
      // Refresh state so the newly-approved design is immediately visible in قائمة النشر.
      try { S = await fetch("/api/state").then(x => x.json()); buildChrome(); } catch (e) {}
      if (m) m.textContent = "✓ " + T(r.routedTo === "pipeline" ? "appr_to_pipeline" : "appr_approved");
      setTimeout(() => renderApprovals(C), 900);
    } else if (m) m.textContent = "⚠ " + ((r && r.error) || "");
  });
  C.querySelectorAll(".arej").forEach(b => b.onclick = async () => {
    await fetch("/api/proposals/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.dataset.appr }) }).catch(() => {});
    renderApprovals(C);
  });
  C.querySelectorAll(".aedit").forEach(b => b.onclick = () => { const box = C.querySelector(`.aeditbox[data-appr="${b.dataset.appr}"]`); if (box) box.style.display = box.style.display === "none" ? "block" : "none"; });
  C.querySelectorAll(".aregen").forEach(b => b.onclick = async () => {
    const id = b.dataset.appr, note = C.querySelector(`.aeditbox[data-appr="${id}"] .anote`)?.value || "", m = msg(id);
    if (m) m.textContent = "↻ …"; b.disabled = true;
    const r = await fetch("/api/proposals/regenerate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, note }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) renderApprovals(C); else { if (m) m.textContent = "⚠ " + ((r && r.error) || ""); b.disabled = false; }
  });
}

// Nightly-invented proposals (templates + characters) awaiting the owner's approval.
async function renderProposals(host, C) {
  if (!host) return;
  let d = null;
  try { d = await fetch("/api/proposals").then(r => r.json()); } catch (e) {}
  if (!d || !d.ok) { host.innerHTML = ""; return; }
  const ICON = { post: "🖼 ", template: "🌙 ", character: "🧑🏻 " };
  const card = (p, kind) => `<div class="tplcard" data-prop="${p.id}">
      <div class="tplhd"><span class="tplname">${ICON[kind] || ""}${escapeHtml(p.name || p.label || "")}</span></div>
      <div class="tplshots" style="grid-template-columns:1fr"><img loading="lazy" src="${p.previewUrl}"></div>
      <div style="display:flex;gap:.4rem;margin-top:.3rem">
        <button class="btn ok sm papprove" data-prop="${p.id}">✓ ${T("prop_approve")}</button>
        <button class="btn ghost sm preject" data-prop="${p.id}">✕ ${T("prop_reject")}</button>
      </div></div>`;
  const posts = d.posts || [], tpls = d.templates || [], chars = d.characters || [];
  host.innerHTML = `<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.5rem">
      <h3 style="margin:0">🌙 ${T("prop_title")}</h3>
      <button class="btn sm" id="proprun">⚡ ${T("prop_run")}</button>
      <span class="mut">${T("prop_schedule_note")}${d.geminiReady ? "" : " · " + T("prop_no_gemini")}</span>
    </div>
    <div class="mut" id="propmsg" style="margin-bottom:.6rem"></div>
    ${posts.length ? `<div class="mut" style="margin:.3rem 0">${T("prop_posts")} (${posts.length})</div><div class="grid g3">${posts.map(p => card(p, "post")).join("")}</div>` : ""}
    ${tpls.length ? `<div class="mut" style="margin:.7rem 0 .3rem">${T("prop_templates")} (${tpls.length})</div><div class="grid g3">${tpls.map(p => card(p, "template")).join("")}</div>` : ""}
    ${chars.length ? `<div class="mut" style="margin:.7rem 0 .3rem">${T("prop_characters")} (${chars.length})</div><div class="grid g3">${chars.map(p => card(p, "character")).join("")}</div>` : ""}
    ${!posts.length && !tpls.length && !chars.length ? `<div class="mut">${T("prop_empty")}</div>` : ""}`;
  const run = $("#proprun");
  if (run) run.onclick = async () => {
    run.disabled = true; run.innerHTML = `<span class="dots"><i></i><i></i><i></i></span> ${T("prop_running")}`;
    const r = await fetch("/api/proposals/run-now", { method: "POST" }).then(x => x.json()).catch(() => null);
    const m = $("#propmsg"); if (m && r) m.textContent = `✓ ${r.posts || 0} ${T("prop_posts")} · ${r.characters || 0} ${T("prop_characters")}` + (r.errors?.length ? " · " + r.errors.join("; ") : "");
    renderProposals(host, C);
  };
  host.querySelectorAll(".papprove").forEach(b => b.onclick = async () => {
    await fetch("/api/proposals/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.dataset.prop }) }).catch(() => {});
    renderTemplates(C); // approved template/character now appears in the selectable lists
  });
  host.querySelectorAll(".preject").forEach(b => b.onclick = async () => {
    await fetch("/api/proposals/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.dataset.prop }) }).catch(() => {});
    renderProposals(host, C);
  });
}

// Brand characters — authentic Omani people (Gemini-generated, owner-adopted).
// Selecting one makes every "spotlight" design use it as the full-bleed hero.
const CLOTHING_TYPES = [["massar", "مصر عُماني"], ["kummah", "كُمّة"], ["dishdasha", "دشداشة"], ["furakha", "فراخة/شماغ"], ["abaya", "عباية سوداء"], ["hijab", "حجاب أسود"]];
async function renderCharacters(host, activeTpl) {
  if (!host) return;
  let d = null, cloth = { clothing: [] };
  try { [d, cloth] = await Promise.all([fetch("/api/characters").then(r => r.json()), fetch("/api/clothing").then(r => r.json()).catch(() => ({ clothing: [] }))]); } catch (e) {}
  if (!d || !d.ok || !d.characters.length) { host.innerHTML = ""; return; }
  const v = Date.now();
  const noneOn = !d.active;
  const cards = d.characters.map(c => {
    const on = c.id === d.active;
    return `<div class="tplcard ${on ? "on" : ""}" data-char="${c.id}">
      <div class="tplhd"><span class="tplname"><input type="checkbox" class="selchk" data-kind="character" data-id="${c.id}" title="${T("dz_select")}"> 🧑🏻 ${escapeHtml(c.label)}</span>${on ? `<span class="pill p-ok">✓ ${T("tpl_active")}</span>` : ""}</div>
      <div class="tpldesc">${escapeHtml(c.dress)}</div>
      <div class="tplshots"><img loading="lazy" src="${c.thumb}?v=${v}" alt="character" style="grid-column:span 2;object-fit:cover;max-height:16rem"></div>
      <div style="display:flex;gap:.35rem;margin-top:.3rem">
        ${on ? `<button class="btn ok sm" disabled>✓ ${T("tpl_active")}</button>` : `<button class="btn sm charpick" data-char="${c.id}">${T("char_use")}</button>`}
      </div>
    </div>`;
  }).join("");
  host.innerHTML = `
    <div class="sec-h" style="margin-top:.2rem"><h3>👕 ${T("cloth_title")}</h3></div>
    <div class="note-info">${T("cloth_hint")}</div>
    <div class="pcard nofloat" style="margin:.6rem 0">
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
        <select class="psel" id="cltype" style="max-width:12rem">${CLOTHING_TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
        <input class="pinput" id="cllabel" placeholder="${T("cloth_label")}" style="max-width:14rem" autocomplete="off">
        <input type="file" id="clfile" accept="image/*" style="max-width:16rem">
        <button class="btn sm" id="clup">⬆ ${T("cloth_upload")}</button>
        <span class="ok-s" id="clmsg"></span></div></div>
    <div class="grid g3 tplgrid" id="clgrid">${clothCards(cloth.clothing || [])}</div>

    <h3 style="margin:1.6rem 0 .5rem">🧑🏻 ${T("char_title")}</h3>
    <div class="note-info">${T("char_hint")}</div>
    ${dzBulkBar()}
    <div class="grid g3 tplgrid">${cards}
      <div class="tplcard ${noneOn ? "on" : ""}">
        <div class="tplhd"><span class="tplname">🚫 ${T("char_none")}</span>${noneOn ? `<span class="pill p-ok">✓</span>` : ""}</div>
        <div class="tpldesc">${T("char_none_d")}</div>
        <div class="tplshots" style="min-height:6rem;display:flex;align-items:center;justify-content:center;color:var(--mut)">—</div>
        ${noneOn ? `<button class="btn ok sm" disabled>✓ ${T("tpl_active")}</button>` : `<button class="btn sm charpick" data-char="">${T("char_use")}</button>`}
      </div>
    </div><div class="mut" id="charmsg" style="margin-top:.6rem"></div>`;
  host.querySelectorAll(".charpick").forEach(b => b.onclick = async () => {
    b.disabled = true; b.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    const r = await fetch("/api/characters/set", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ character: b.dataset.char }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) { renderCharacters(host, activeTpl); const m = $("#charmsg"); if (m) m.textContent = "✓ " + T("char_saved"); }
    else { b.disabled = false; b.textContent = T("char_use"); }
  });
  bindClothing(host, activeTpl);
  bindBulkDelete(host, () => renderCharacters(host, activeTpl));
}
const clothTypeLabel = (t) => (CLOTHING_TYPES.find(([v]) => v === t) || [, t])[1] || t;
function clothCards(list) {
  if (!list.length) return `<div class="mut" style="padding:.5rem">${T("cloth_empty")}</div>`;
  return list.map(c => `<div class="tplcard" data-clid="${c.id}">
    <div class="tplhd"><span class="tplname">👕 ${escapeHtml(c.label || clothTypeLabel(c.type))}</span><span class="pill p-info">${escapeHtml(clothTypeLabel(c.type))}</span></div>
    <div class="tplshots"><img loading="lazy" src="${c.thumb}?v=${Date.now()}" alt="clothing" style="grid-column:span 2;object-fit:cover;max-height:14rem"></div>
    <div style="margin-top:.3rem"><button class="btn ghost sm cldel" data-clid="${c.id}">🗑 ${T("del")}</button></div></div>`).join("");
}
function bindClothing(host, activeTpl) {
  const up = host.querySelector("#clup");
  if (up) up.onclick = async () => {
    const f = host.querySelector("#clfile").files[0], msg = host.querySelector("#clmsg");
    if (!f) { msg.textContent = "✗ " + T("cloth_pick"); return; }
    up.disabled = true; up.textContent = "…";
    try {
      const dataUrl = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(f); });
      const r = await fetch("/api/clothing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: host.querySelector("#cltype").value, label: host.querySelector("#cllabel").value.trim(), dataUrl }) }).then(x => x.json());
      if (r.ok) renderCharacters(host, activeTpl); else { msg.textContent = "✗ " + (r.error || ""); up.disabled = false; up.textContent = "⬆ " + T("cloth_upload"); }
    } catch (e) { msg.textContent = "✗"; up.disabled = false; up.textContent = "⬆ " + T("cloth_upload"); }
  };
  host.querySelectorAll(".cldel").forEach(b => b.onclick = async () => { await fetch("/api/clothing/" + b.dataset.clid, { method: "DELETE" }); renderCharacters(host, activeTpl); });
}

// Build a ready Canva "Magic Design" brief (Omani characters + brand colors),
// copy it to the clipboard, and open Canva so the owner pastes it in.
function canvaBrief(q) {
  const head = q ? q.t : "تجارتك كلها في مكان واحد";
  const kind = q ? (q.ty || "") : "منشور علامة";
  return `منشور إنستغرام لعلامة «متجرلينك» (منصة عُمانية للتجار: متجر إلكتروني + كاشير + محاسبة في تطبيق واحد).
الشخصية إلزامية: صورة فوتوغرافية واقعية عالية الجودة (photorealistic, DSLR) لشخص عُماني حقيقي بالزيّ العُماني الأصيل — الدشداشة العُمانية بالفراخة/الشرّابة، وعلى الرأس الكُمّة العُمانية المطرّزة أو المصر العُماني الملفوف. مهم: زيّ عُماني وليس خليجياً — لا غترة بيضاء ولا عقال أسود إطلاقاً.
النوع: ${kind}.
ألوان الهوية إلزامية: خلفية خمري غامق #6E1444 + لمسات وشريط برتقالي #E8890F. نص أبيض.
العنوان: «${head}».
شريط الميزات: متجر إلكتروني · كاشير ذكي · محاسبة تلقائية.
التذييل: «متجرلينك · قريبًا في سلطنة عُمان».
أسلوب حديث نظيف احترافي، إضاءة استوديو ناعمة.`;
}
async function openCanva(q) {
  const brief = canvaBrief(q);
  try { await navigator.clipboard.writeText(brief); alert(T("canva_copied")); }
  catch (e) { prompt(T("canva_manual"), brief); }
  window.open("https://www.canva.com/create/instagram-posts/", "_blank");
}

// ── manager chat (CAIMO) ──────────────────────────────────────────
// «الفريق» — the AI team: self-improving agents (auto-approved dev points + history)
// with the AI manager chat merged in (was a separate «المدير» page).
async function renderTeam(C) {
  C.innerHTML = `<div class="note-info">🚀 ${T("agent_improve_hint")}</div>
    <div class="grid g3" id="agentgrid">${S.agents.map((a, i) => agentCard(a, i)).join("")}</div>
    <div class="sec-h" style="margin-top:1.4rem"><h2>💬 ${T("team_manager")}</h2></div>
    <div class="mut" style="margin:-.3rem 0 .6rem">${T("team_manager_d")}</div>
    <div id="mgrhost"></div>`;
  bindAgents();
  renderManager($("#mgrhost"));
}
async function renderManager(C) {
  C.innerHTML = `<div class="chatwrap">
    <div class="chatscroll" id="chatscroll"><div class="loading">…</div></div>
    <div class="qchips" id="qchips"></div>
    <div class="chatbar"><button class="btn ghost sm" id="chatreset" title="${T("mgr_reset")}">↺</button><input id="chatinput" placeholder="${T("mgr_ph")}" autocomplete="off"><button class="btn" id="chatsend">${T("mgr_send")}</button></div>
    <div class="mut" id="chatnote" style="margin-top:.4rem"></div></div>`;
  const chips = T("mgr_chips") || [];
  $("#qchips").innerHTML = chips.map(c => `<button class="qchip">${c}</button>`).join("");
  document.querySelectorAll(".qchip").forEach(b => b.onclick = () => { $("#chatinput").value = b.textContent; $("#chatinput").focus(); });
  let data; try { data = await fetch("/api/chat").then(r => r.json()); } catch (e) { data = { history: [], ready: false }; }
  chatReady = data.ready; renderChat(data.history);
  if (!chatReady) $("#chatnote").innerHTML = T("mgr_needkey");
  $("#chatsend").onclick = sendChat;
  $("#chatreset").onclick = async () => { const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) }).then(r => r.json()); renderChat(r.history); };
  $("#chatinput").onkeydown = (e) => { if (e.key === "Enter") sendChat(); };
  $("#chatinput").focus();
}
function renderChat(history) {
  const box = $("#chatscroll"); if (!box) return;
  if (!history || !history.length) { box.innerHTML = `<div class="chatempty">${T("mgr_intro")}</div>`; return; }
  box.innerHTML = history.map(m => m.role === "manager"
    ? `<div class="cmsg mgr"><div class="cav">CA</div><div class="cbody">${escapeHtml(m.text)}</div></div>`
    : `<div class="cmsg me"><div class="cbody">${escapeHtml(m.text)}</div></div>`).join("");
  box.scrollTop = box.scrollHeight;
}
async function sendChat() {
  const inp = $("#chatinput"); if (!inp) return; const msg = inp.value.trim(); if (!msg) return;
  inp.value = ""; const box = $("#chatscroll"); box.querySelector(".chatempty")?.remove();
  box.insertAdjacentHTML("beforeend", `<div class="cmsg me"><div class="cbody">${escapeHtml(msg)}</div></div><div class="cmsg mgr typing" id="typing"><div class="cav">CA</div><div class="cbody">…</div></div>`);
  box.scrollTop = box.scrollHeight;
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, lang }) }).then(r => r.json());
    chatReady = r.ready; renderChat(r.history);
    if (!chatReady) $("#chatnote").innerHTML = T("mgr_needkey");
  } catch (e) { const t = document.querySelector("#typing .cbody"); if (t) t.textContent = "✗"; }
}

// ── settings hub (accounts + connections + preferences) ───────────
function renderSettings(C) {
  C.innerHTML = `<div class="sec-h"><h2>${T("set_accounts")}</h2></div>
    <div class="grid g2">${S.accounts.map(accCard).join("")}</div>
    <div class="sec-h" style="margin-top:1.3rem"><h2>${T("set_integrations")}</h2></div>
    <div id="connhost"><div class="loading">…</div></div>
    <div class="sec-h" style="margin-top:1.3rem"><h2>${T("set_prefs")}</h2></div>
    <div class="card">
      <div class="setrow"><span>${T("set_lang")}</span><select id="langsel2"></select></div>
      <div class="setrow"><span>${T("set_install")}</span><button class="btn ghost sm" id="installbtn2">⬇</button></div>
      <div class="mut" style="margin-top:.6rem">${T("set_pwnote")}</div></div>`;
  renderConnections($("#connhost"));
  const ls = $("#langsel2"); ls.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === lang ? "selected" : ""}>${v.name}</option>`).join("");
  ls.onchange = (e) => { lang = e.target.value; localStorage.setItem("ml_lang", lang); applyLang(); buildChrome(); render("settings"); };
  $("#installbtn2").onclick = () => { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } };
}

// ── connections (activation center) ───────────────────────────────
async function renderConnections(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  let data; try { data = await fetch("/api/connections").then(r => r.json()); } catch (e) { C.innerHTML = `<div class="loading">—</div>`; return; }
  C.innerHTML = `<div class="note-info">🔒 ${T("conn_hint")}</div><div class="grid g2">${data.integrations.map(connCard).join("")}</div>`;
  document.querySelectorAll("[data-conn]").forEach(b => b.onclick = () => activateConn(b.dataset.conn));
}
function connCard(it) {
  return `<div class="card" id="cc-${it.key}"><div class="acc" style="margin-bottom:.5rem">${chan(it.icon)}<div style="flex:1"><div style="font-weight:800">${it.name}</div><div class="mut">${it.desc}</div></div>${pill([it.connected ? T("conn_on") : T("conn_off"), it.connected ? "p-ok" : "p-idle"])}</div>
    ${it.fields.map(f => `<label class="clabel">${f.label}${f.secret ? " 🔑" : ""}</label><input class="cinput" data-k="${f.k}" type="${f.secret ? "password" : "text"}" placeholder="${f.set ? "•••••• " + T("conn_set") : ""}" autocomplete="off">`).join("")}
    <div style="display:flex;gap:.6rem;margin-top:.7rem;align-items:center;flex-wrap:wrap"><button class="btn sm" data-conn="${it.key}">${T("conn_activate")}</button><a class="link" href="${it.help}" target="_blank">${T("conn_open")}</a><span class="ok-s" id="cm-${it.key}"></span></div></div>`;
}
async function activateConn(key) {
  const card = document.querySelector("#cc-" + key), map = {};
  card.querySelectorAll(".cinput").forEach(i => { if (i.value.trim()) map[i.dataset.k] = i.value.trim(); });
  try {
    await fetch("/api/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(map) });
    document.querySelector("#cm-" + key).textContent = "✓ " + T("conn_saved");
    S = await fetch("/api/state").then(r => r.json()); buildChrome(); updateNotif();
    setTimeout(() => renderConnections($("#content")), 700);
  } catch (e) { document.querySelector("#cm-" + key).textContent = "✗"; }
}

// ── dashboard (overview) ──────────────────────────────────────────
// Morning brief — the one card that answers "what happens today, what needs me?"
function briefCard() {
  const q = S.queue || [], notes = S.notes || {}, pubLog = S.publishedLog || {};
  const omanNow = new Date(Date.now() + (4 * 60 + new Date().getTimezoneOffset()) * 60000);
  const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = dstr(omanNow), yesterday = dstr(new Date(omanNow.getTime() - 86400000));
  const todays = q.filter(p => (p.date || "").startsWith(today) && !pubLog[p.id]);
  const pubYest = q.filter(p => pubLog[p.id] && (pubLog[p.id].at || "").slice(0, 10) === yesterday);
  const genHold = q.filter(p => p.gen && !pubLog[p.id] && (notes[p.id] || {}).status !== "معتمد").length;
  const held = q.filter(p => !pubLog[p.id] && (notes[p.id] || {}).status !== "معتمد" && ((notes[p.id] || {}).note || "").trim()).length;
  const newC = (S.comments || []).length, newM = (S.messages || []).filter(m => m.sug !== "").length;
  const lines = [];
  if (todays.length) lines.push(`📤 ${T("brief_today")}: ${todays.map(p => `<b>${escapeHtml(p.t)}</b> (${p.date.split("·")[1] || ""})`).join("، ")}`);
  else lines.push(`🍃 ${T("brief_none")}`);
  if (pubYest.length) lines.push(`✅ ${T("brief_yest")}: ${pubYest.map(p => pubLog[p.id].permalink ? `<a class="link" target="_blank" href="${pubLog[p.id].permalink}">${escapeHtml(p.t)} ↗</a>` : escapeHtml(p.t)).join("، ")}`);
  if (genHold) lines.push(`✋ <b>${genHold}</b> ${T("brief_genhold")}`);
  if (held) lines.push(`✎ <b>${held}</b> ${T("brief_held")}`);
  if (newC || newM) lines.push(`💬 ${newC} ${T("nav_comments")} · ✉ ${newM} ${T("nav_messages")}`);
  return `<div class="card brief"><div class="sec-h"><h2>☀️ ${T("brief_title")}</h2><span class="hint">${today}</span></div>
    <div class="brieflines">${lines.map(l => `<div class="bl">${l}</div>`).join("")}</div>
    <div style="display:flex;gap:.5rem;margin-top:.7rem;flex-wrap:wrap">
      <button class="btn sm" data-goview="pipeline">📋 ${T("brief_review")}</button>
      <button class="btn ghost sm" data-goview="plan">🗓 ${T("nav_plan")}</button></div></div>`;
}
function ovv() {
  const labels = [T("kpi_agents"), T("kpi_queue"), T("kpi_assets"), T("kpi_followers")];
  const k = S.kpis.map((x, i) => `<div class="card kpi"><span class="n">${x[0]}</span><span class="l">${labels[i]}</span><span class="d">${pill([x[2], x[3]])}</span></div>`).join("");
  // pipeline health breakdown
  const q = S.queue || []; let pub = 0, appr = 0, rev = 0;
  q.forEach(x => { if (S.publishedLog && S.publishedLog[x.id]) pub++; else if (((S.notes && S.notes[x.id]) || {}).status === "معتمد") appr++; else rev++; });
  const tot = q.length || 1;
  const seg = (n, c) => n ? `<span style="width:${(n / tot * 100).toFixed(1)}%;background:${c}"></span>` : "";
  const pipeHealth = `<div class="card"><div class="sec-h"><h2>${T("dash_pipeline")}</h2><span class="hint">${q.length} ${T("dash_posts")}</span></div>
    <div class="segbar">${seg(rev, "var(--warn)")}${seg(appr, "var(--info)")}${seg(pub, "var(--ok)")}</div>
    <div class="seglegend"><span><i style="background:var(--warn)"></i>${T("s_review")} <b>${rev}</b></span><span><i style="background:var(--info)"></i>${T("s_approved")} <b>${appr}</b></span><span><i style="background:var(--ok)"></i>${T("s_published")} <b>${pub}</b></span></div></div>`;
  // trend charts
  const ig = ((A && A.platforms) || []).find(p => p.active);
  const trend = ig ? `<div class="card"><div class="sec-h"><h2>${T("dash_trend")}</h2><span class="pill ${A.live ? "p-ok" : "p-idle"}">${A.live ? "live" : "demo"}</span></div>
    <div class="mut" style="margin:.2rem 0">${T("reach")} · ${ig.name} · ${A.days} ${lang === "en" ? "days" : "يوم"}</div>${chart(ig.metrics.reach.series, ig.color, 60)}
    <div class="mut" style="margin:.5rem 0 .2rem">${T("engagement")}</div>${chart(ig.metrics.engagement.series, "#E8890F", 60)}</div>` : "";
  // windsor insights
  const st = (kk, v) => `<div class="astat"><span class="an">${nf(v)}</span><span class="al">${T(kk)}</span></div>`;
  const ins = S.insights ? `<div class="card"><div class="sec-h"><h2>${T("perf")} (Windsor)</h2><span class="pill p-ok">${T("conn_on")}</span></div>
    <div class="astats">${st("followers", S.insights.followers)}${st("reach", S.insights.reach)}${st("impressions", S.insights.impressions)}${st("engagement", S.insights.engagement)}${st("clicks", S.insights.clicks)}</div></div>`
    : `<div class="card"><div class="sec-h"><h2>${T("perf")}</h2></div><div class="mut">${T("notConnected")}</div></div>`;
  // upcoming schedule
  const up = q.filter(x => !(S.publishedLog && S.publishedLog[x.id])).slice().sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 6);
  const sched = `<div class="card"><div class="sec-h"><h2>${T("dash_upcoming")}</h2></div>
    <div class="agenda">${up.map(x => `<div class="agrow"><span class="agd">${x.date}</span><span class="agc">${chan(x.ch)}</span><span class="agt">${escapeHtml(x.t)}</span>${((S.notes && S.notes[x.id]) || {}).status === "معتمد" ? `<span class="pill p-ok">✓</span>` : `<span class="pill p-warn">${T("s_review")}</span>`}</div>`).join("") || `<div class="mut">—</div>`}</div></div>`;
  const cmp = (A && A.platforms) ? `<div class="card"><div class="sec-h"><h2>${T("comparison")}</h2></div>${compareBars()}</div>` : "";
  // 🏆 top performing posts (live, from real Instagram engagement)
  const tp = S.topPosts || [];
  const topCard = tp.length ? `<div class="card"><div class="sec-h"><h2>🏆 ${T("dash_top")}</h2><span class="pill p-ok">live</span></div>
    <div class="toplist">${tp.map((m, i) => `<div class="toprow"><span class="topr">${i + 1}</span>
      <span class="topt">${m.url ? `<a class="link" target="_blank" href="${m.url}">${escapeHtml((m.t || "").slice(0, 42))} ↗</a>` : escapeHtml((m.t || "").slice(0, 42))}</span>
      <span class="topm">❤ ${nf(m.likes)} · 💬 ${nf(m.comments)}${m.saved ? ` · 🔖 ${nf(m.saved)}` : ""}${m.reach != null ? ` · 👁 ${nf(m.reach)}` : ""}</span></div>`).join("")}</div></div>` : "";
  return `${briefCard()}<div class="grid g4" style="margin-top:1rem">${k}</div>
    <div class="grid g2" style="margin-top:1rem">${pipeHealth}${trend}</div>
    <div class="grid g2" style="margin-top:1rem">${ins}${topCard || sched}</div>
    ${topCard ? `<div style="margin-top:1rem">${sched}</div>` : ""}
    <div style="margin-top:1rem">${cmp}</div>`;
}

// ── agents (with self-improvement approval) ───────────────────────
function agentCard(a, i) {
  return `<div class="card agent"><div class="hd"><div class="av" style="background:${a.c}">${a.n.slice(0, 2).toUpperCase()}</div>
  <div><div class="nm">${a.n}${a.NEW ? ` <span class="pill p-new">${lang === "ar" ? "جديد" : lang === "en" ? "new" : "جدید"}</span>` : ""}${a.improved ? ` <span class="pill p-ok" title="${T("agent_improved")}">↑${a.improvements || ""}</span>` : ""}</div><div class="rl">${a.r}</div></div></div>
  <div>${pill([a.st[1], STMAP[a.st[0]]])}</div><div class="task">${escapeHtml(a.task)}</div>
  ${a.sc > 0 ? `<div class="row"><span>${T("eval")}</span><span class="bar"><i style="width:${a.sc}%"></i></span><b>${a.sc}</b></div>` : `<div class="row">${pill([T("noScore"), "p-idle"])}</div>`}
  <div class="mut">${escapeHtml(a.ev)}</div>
  <div class="sug"><div class="sugh"><b>${T("selfSug")}</b>${a.sug ? `<button class="sugok" data-improve="${i}" title="${T("agent_approve")}">✓</button>` : ""}</div><div class="sugt">${escapeHtml(a.sug)}</div></div>
  ${(a.changelog && a.changelog.length) ? `<details class="chlog"><summary>${T("agent_changelog")} (${a.changelog.length})</summary>${a.changelog.map(c => `<div class="chrow"><span class="chd">${(c.at || "").slice(5, 10)}</span> ${escapeHtml(c.became || c.applied || "")}</div>`).join("")}</details>` : ""}</div>`;
}
function bindAgents() {
  document.querySelectorAll("[data-improve]").forEach(b => b.onclick = () => improveAgent(+b.dataset.improve, b));
}
async function improveAgent(i, btn) {
  const a = S.agents[i]; if (!a) return;
  btn.textContent = "…"; btn.disabled = true;
  try {
    const r = await fetch("/api/agent-improve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: a.n, lang }) }).then(r => r.json());
    if (r.ok && r.agent) {
      S.agents[i] = { ...a, task: r.agent.task, ev: r.agent.ev, sug: r.agent.sug, sc: r.agent.sc, improved: true, improvements: r.agent.improvements, changelog: r.agent.changelog || [] };
      render("agents");
    } else { btn.textContent = "✓"; btn.disabled = false; }
  } catch (e) { btn.textContent = "✗"; setTimeout(() => { btn.textContent = "✓"; btn.disabled = false; }, 1200); }
}
const needCard = (n) => `<div class="card"><div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.35rem">${pill(n.t)} ${pill(n.pr)}<span style="margin-inline-start:auto;font-size:.74rem;color:var(--muted)">${n.f}</span></div>
  <div style="font-weight:800">${n.ti}</div><div class="mut" style="margin-top:.25rem">${n.d}</div></div>`;

// ── «مهامي» ── one place that turns platform state into actionable steps,
// each with a ready-to-paste prompt the owner can hand to Claude to execute.
async function renderNeeds(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  let props = { posts: [], characters: [], templates: [] }, conns = { integrations: [] };
  try { [props, conns] = await Promise.all([fetch("/api/proposals").then(r => r.json()), fetch("/api/connections").then(r => r.json())]); } catch (e) {}
  const q = S.queue || [], notes = S.notes || {}, pub = S.publishedLog || {};
  const pendAppr = (props.posts || []).length + (props.characters || []).length + (props.templates || []).length;
  const held = q.filter(p => !pub[p.id] && (notes[p.id] || {}).status !== "معتمد" && ((notes[p.id] || {}).note || "").trim()).length;
  const off = (conns.integrations || []).filter(i => !i.connected);
  const geminiOff = off.some(i => /gemini/i.test(i.key));
  const pillars = (S.needs || []);

  const tasks = [];
  if (pendAppr) tasks.push({ icon: "🖼", pr: T("pr_high"), title: T("task_appr_t").replace("{n}", pendAppr), desc: T("task_appr_d"), view: "approvals", prompt: T("task_appr_prompt") });
  if (held) tasks.push({ icon: "✎", pr: T("pr_med"), title: T("task_held_t").replace("{n}", held), desc: T("task_held_d"), view: "pipeline", prompt: T("task_held_prompt") });
  if (geminiOff) tasks.push({ icon: "🔌", pr: T("pr_high"), title: T("task_gemini_t"), desc: T("task_gemini_d"), view: "settings", prompt: T("task_gemini_prompt") });
  off.filter(i => !/gemini/i.test(i.key)).forEach(i => tasks.push({ icon: "🔌", pr: T("pr_low"), title: T("task_conn_t").replace("{n}", i.name), desc: i.desc || "", view: "settings", prompt: T("task_conn_prompt").replace("{n}", i.name) }));
  // developer / platform-improvement needs → each becomes a Claude-ready prompt
  pillars.forEach(n => tasks.push({ icon: "🛠", pr: (Array.isArray(n.pr) ? n.pr[0] : n.pr) || T("pr_med"), title: n.ti, desc: n.d, prompt: `${n.ti}\n\n${n.d}` }));

  if (!tasks.length) { C.innerHTML = `<div class="note-info">✅ ${T("tasks_empty")}</div>`; return; }
  const prCls = (p) => (p === T("pr_high") || /عاجل|عالي|مرتفع|urgent|high/i.test(p)) ? "p-warn" : (p === T("pr_low") || /منخفض|low/i.test(p)) ? "p-idle" : "p-info";
  const card = (t, i) => `<div class="card taskcard">
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem"><span style="font-size:1.2rem">${t.icon}</span>
      <div style="font-weight:800;flex:1">${escapeHtml(t.title)}</div>${pill([t.pr, prCls(t.pr)])}</div>
    <div class="mut" style="margin-bottom:.6rem">${escapeHtml(t.desc)}</div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
      ${t.view ? `<button class="btn sm" data-goview="${t.view}">↪ ${T("task_open")}</button>` : ""}
      <button class="btn ghost sm" data-copyp="${i}">📋 ${T("task_copy_prompt")}</button>
      <span class="ok-s" id="tcp-${i}"></span></div>
    <details class="chlog" style="margin-top:.55rem"><summary>${T("task_show_prompt")}</summary><div class="taskprompt" id="tp-${i}">${escapeHtml(t.prompt)}</div></details></div>`;
  C.innerHTML = `<div class="note-info">🧭 ${T("tasks_hint")}</div><div class="grid g2">${tasks.map(card).join("")}</div>`;
  C.querySelectorAll("[data-goview]").forEach(b => b.onclick = () => { const t = document.querySelector(`#nav button[data-go="${b.dataset.goview}"]`); if (t) t.click(); });
  C.querySelectorAll("[data-copyp]").forEach(b => b.onclick = async () => {
    const i = +b.dataset.copyp; try { await navigator.clipboard.writeText(tasks[i].prompt); const m = $("#tcp-" + i); if (m) { m.textContent = "✓ " + T("task_copied"); setTimeout(() => m.textContent = "", 2000); } } catch (e) {}
  });
}

// ── unified Pipeline (merges queue + prep + media + published) ─────
function renderPipeline(C) {
  const q = S.queue || [];
  const plats = [...new Set(q.map(x => x.ch))];
  const types = [["all", T("f_all")], ["post", T("t_post")], ["reel", T("t_reel")], ["carousel", T("t_carousel")], ["poll", T("t_poll")]];
  const stats = [["all", T("f_all")], ["pending", T("s_pending")], ["approved", T("s_approved")], ["published", T("s_published")], ["generated", T("s_generated")]];
  const chip = (active, val, label, key) => `<button class="fchip ${active ? "on" : ""}" data-f="${key}" data-v="${val}">${label}</button>`;
  const filtered = q.filter(x => (pf.plat === "all" || x.ch === pf.plat) && (pf.type === "all" || postType(x) === pf.type) && (pf.status === "all" || postStatus(x) === pf.status));
  const bar = `<div class="filterbar">
    <div class="frow"><span class="flabel">${T("f_platform")}</span>${chip(pf.plat === "all", "all", T("f_all"), "plat")}${plats.map(p => chip(pf.plat === p, p, `${chan(p)} ${p}`, "plat")).join("")}</div>
    <div class="frow"><span class="flabel">${T("f_type")}</span>${types.map(([v, l]) => chip(pf.type === v, v, l, "type")).join("")}</div>
    <div class="frow"><span class="flabel">${T("f_status")}</span>${stats.map(([v, l]) => chip(pf.status === v, v, l, "status")).join("")}</div>
  </div>`;
  if (pf.focus >= filtered.length) pf.focus = Math.max(0, filtered.length - 1);
  const batch = S.contentBatch ? `<div class="note-info">✨ ${T("genBatch")}: <b>${S.contentBatch}</b> — ${T("genBy")}</div>` : "";
  const toggle = `<div class="viewtog"><button class="vtbtn ${pf.view === "carousel" ? "on" : ""}" data-view="carousel">▦ ${T("view_carousel")}</button><button class="vtbtn ${pf.view === "calendar" ? "on" : ""}" data-view="calendar">🗓 ${T("view_calendar")}</button></div>`;
  const body = pf.view === "calendar" ? pipeCalendar(filtered) : pipeCarousel(filtered);
  C.innerHTML = `${batch}<div class="pipehead"><b>${T("nav_pipeline")}</b><span class="mut">${filtered.length} / ${q.length}</span><button class="btn sm" id="gennew">➕ ${T("gennew")}</button>${toggle}</div>${bar}<div id="pipebody">${body}</div>`;
  bindPipeline(filtered);
}
// horizontal image carousel (focused center card + ‹ › nav) + detail panel
function pipeCarousel(list) {
  if (!list.length) return `<div class="loading">${T("f_none")}</div>`;
  const cards = list.map((q, i) => carouselCard(q, i)).join("");
  return `<div class="carousel" id="carousel">${cards}</div>
    <div class="carnav"><button class="carbtn" data-nav="-1">‹</button><span class="cardot">${pf.focus + 1} / ${list.length}</span><button class="carbtn" data-nav="1">›</button></div>
    <div class="cdetail" id="cdetail">${carouselDetail(list[pf.focus])}</div>`;
}
// Authoritative slide list for a post. Original professional Drive carousels
// (driveSlides) win — unless the owner explicitly regenerated the post
// (regenerated + fresh images[]), in which case the new design is shown.
function slidesOf(q) {
  const gen = q.images && q.images.length ? q.images : null;
  if (q.regenerated && gen) return gen;
  if (q.driveSlides && q.driveSlides.length) return q.driveSlides.map((id) => `/media/drive/${id}`);
  return gen || [];
}
const isVideoUrl = (u) => typeof u === "string" && u.split("?")[0].endsWith(".mp4");
function carouselCard(q, i) {
  const isReel = (q.ty || "").includes("ريل");
  const grad = `linear-gradient(160deg,${q.tyc},${q.tyc}bb)`;
  const slides = slidesOf(q);
  let inner;
  if (slides.length) inner = `<img class="cmedia" loading="lazy" src="${slides[0]}" alt="" onerror="this.remove()">`;
  else if (isVideoUrl(q.mediaUrl)) inner = `<video class="cmedia" src="${q.mediaUrl}" muted loop autoplay playsinline></video><span class="cplay">▶</span>`;
  else if (q.mediaUrl) inner = `<img class="cmedia" loading="lazy" src="${q.mediaUrl}" alt="" onerror="this.remove()">`;
  else if (q.drive && !isReel) inner = `<img class="cmedia" loading="lazy" src="/media/drive/${q.drive}" alt="" onerror="this.remove()">`;
  else if (q.drive && isReel) inner = `<span class="cplay">▶</span>`;
  else inner = `<span class="cph">✎</span>`;
  return `<div class="ccard ${i === pf.focus ? "focus" : ""}" data-idx="${i}" style="background:${grad}">
    ${inner}<span class="ctag">${q.id}${q.gen ? " ✨" : ""}</span>${slides.length > 1 ? `<span class="cslides">▦ ${slides.length}</span>` : ""}
    <div class="cclabel"><div class="cct">${escapeHtml(q.t.slice(0, 34))}</div><div class="ccm">${chan(q.ch)} ${q.ty} · ${q.date}</div></div></div>`;
}
const carouselDetail = (q) => q ? pdetailMain(q) : "";
function pdetailMain(q) {
  const nt = (S.notes && S.notes[q.id]) || {};
  const pub = S.publishedLog && S.publishedLog[q.id];
  const approved = nt.status === "معتمد";
  const held = !approved && !!(nt.note && nt.note.trim()); // an unresolved note = objection → won't auto-publish
  const thread = nt.thread || [];
  const badges = [
    pub ? `<span class="pill p-ok">📤 ${T("published_ok")}</span>` : approved ? `<span class="pill p-ok">✓ ${T("approve")}</span>` : held ? `<span class="pill p-warn">✎ ${T("held")}</span>` : q.gen ? `<span class="pill p-warn">✋ ${T("gen_hold")}</span>` : `<span class="pill p-info">🔕 ${T("silent_ok")}</span>`,
    q.gen ? `<span class="pill p-new">✨ ${T("gen")}</span>` : ""
  ].filter(Boolean).join(" ");
  const when = parseWhenClient(q.date);
  const cdHtml = pub ? `<span class="cd done">✓ ${T("published_ok")}</span>` : (when ? `<span class="cd" data-when="${when.getTime()}">${fmtCountdown(when)}</span>` : "");
  let pubBtn = "";
  if (pub) pubBtn = pub.permalink ? `<a class="link sm" target="_blank" href="${pub.permalink}">${T("published_ok")} ↗</a>` : "";
  else if (S.publishReady && !held) pubBtn = `<button class="btn sm pubbtn" data-pub="${q.id}">📤 ${T("publish_now")}</button>`;
  // one-tap emergency stop: writes a hold note so the scheduler skips this post
  const stopBtn = (!pub && !held) ? `<button class="btn ghost sm" data-stop="${q.id}" title="${T("stop_hint")}">⏸ ${T("stop_pub")}</button>` : "";
  // Editing / commenting / regenerating a design now lives on the الاعتماد page —
  // the publish queue is a clean schedule view: preview, publish, hold, delete.
  return `<div class="pcard nofloat" data-id="${q.id}"><div class="pmain">
      <div class="ptitle">${escapeHtml(q.t)}</div>
      <div class="pmeta">${chan(q.ch)} ${q.ty} · <b>${q.date}</b></div>
      <div class="pcdrow">${cdHtml}<div class="pbadges">${badges}</div></div>
      <div class="pcap">${escapeHtml((q.cap || "").slice(0, 240))}${(q.cap || "").length > 240 ? "…" : ""}</div>
      ${(() => { const sl = slidesOf(q); return sl.length > 1 ? `<div class="slideshdr">${T("slides_label")} (${sl.length})</div><div class="slides">${sl.map((u, idx) => `<img class="slidethumb" src="${u}" loading="lazy" data-img="${u}" data-t="${idx === 0 ? T("cover") : T("slide") + " " + idx}" title="${idx === 0 ? T("cover") : T("slide") + " " + idx}">`).join("")}</div>` : ""; })()}
      ${held ? `<div class="note-warn" style="margin:.5rem 0">✎ ${T("held")} — ${T("pipe_edit_at_appr")}</div>` : ""}
      <div class="pactions">
        ${pubBtn}${stopBtn}
        ${isVideoUrl(q.mediaUrl) ? `<button class="btn ghost sm" data-playvid="${q.mediaUrl}">▶ ${lang === "en" ? "Preview" : lang === "fa" ? "پیش‌نمایش" : "معاينة"}</button>` : q.drive ? `<button class="btn ghost sm" data-play2="${q.drive}" data-reel="${(q.ty || "").includes("ريل") ? "1" : "0"}">▶ ${lang === "en" ? "Preview" : lang === "fa" ? "پیش‌نمایش" : "معاينة"}</button>` : ""}${q.drive ? `<a class="link sm" target="_blank" href="https://drive.google.com/file/d/${q.drive}/view">${T("openDrive")}</a>` : ""}
        <button class="btn ghost sm delbtn" data-del="${q.id}" title="${T("del")}" style="margin-inline-start:auto">🗑</button>
      </div></div></div>`;
}
function setFocus(i, list) {
  pf.focus = Math.max(0, Math.min(list.length - 1, i));
  document.querySelectorAll(".ccard").forEach(c => c.classList.toggle("focus", +c.dataset.idx === pf.focus));
  const dot = document.querySelector(".cardot"); if (dot) dot.textContent = `${pf.focus + 1} / ${list.length}`;
  const d = $("#cdetail"); if (d) { d.innerHTML = carouselDetail(list[pf.focus]); bindDetail(list); }
  centerFocused();
}
function centerFocused() { const el = document.querySelector(".ccard.focus"); if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }
// month-grid calendar view of the pipeline
function pipeCalendar(list) {
  const [y, m] = pf.cal.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const ev = {};
  list.forEach(q => { if ((q.date || "").startsWith(pf.cal)) { const d = +q.date.slice(8, 10); (ev[d] = ev[d] || []).push(q); } });
  const wd = lang === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  const monthName = new Intl.DateTimeFormat(lang === "en" ? "en-US" : lang === "fa" ? "fa-IR" : "ar", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  let cells = "";
  for (let i = 0; i < first; i++) cells += `<div class="ccell empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const e = ev[d] || [];
    cells += `<div class="ccell ${e.length ? "has" : ""}"><span class="cd">${d}</span>${e.map(q => { const ok = (S.publishedLog && S.publishedLog[q.id]) || ((S.notes && S.notes[q.id]) || {}).status === "معتمد"; return `<span class="cev ${ok ? "ok" : ""}" title="${q.id} · ${escapeHtml(q.t)}">${chan(q.ch)} ${q.id.replace("MJ-", "")}</span>`; }).join("")}</div>`;
  }
  return `<div class="card pcal"><div class="calhead"><button class="carbtn" data-mon="-1">‹</button><b>${monthName}</b><button class="carbtn" data-mon="1">›</button></div>
    <div class="cgrid head">${wd.map(w => `<div class="cwd">${w}</div>`).join("")}</div><div class="cgrid">${cells}</div></div>`;
}
const bubble = (m) => `<div class="pbub ${m.role}">${m.role === "manager" ? '<span class="pba">CA</span>' : ""}<span>${escapeHtml(m.text)}</span></div>`;
function bindPipeline(list) {
  document.querySelectorAll(".fchip").forEach(b => b.onclick = () => { pf[b.dataset.f] = b.dataset.v; pf.focus = 0; renderPipeline($("#content")); });
  document.querySelectorAll(".vtbtn").forEach(b => b.onclick = () => { pf.view = b.dataset.view; renderPipeline($("#content")); });
  const gn = document.getElementById("gennew"); if (gn) gn.onclick = genNew;
  if (pf.view === "calendar") { bindCalendar(list); return; }
  if (!list || !list.length) return;
  document.querySelectorAll(".ccard").forEach(c => c.onclick = () => {
    const idx = +c.dataset.idx;
    if (idx === pf.focus) {
      const q = list[idx];
      // open the SAME design shown on the card (carousel gallery / video / image / Drive)
      const slides = slidesOf(q);
      if (slides.length) openGallery(slides, 0, q.t);
      else if (isVideoUrl(q.mediaUrl)) openVideo(q.mediaUrl, q.t);
      else if (q.mediaUrl) openImage(q.mediaUrl, q.t);
      else if (q.drive) openDrivePlay(q.drive, q.t, (q.ty || "").includes("ريل"));
    } else setFocus(idx, list);
  });
  document.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => setFocus(pf.focus + (+b.dataset.nav), list));
  bindDetail(list);
  centerFocused();
}
function bindDetail(list) {
  const host = $("#cdetail") || document;
  host.querySelectorAll("[data-ask]").forEach(b => b.onclick = () => askManager(b.dataset.ask));
  host.querySelectorAll(".pnote").forEach(i => i.onkeydown = e => { if (e.key === "Enter") askManager(i.dataset.id); });
  host.querySelectorAll("[data-approve]").forEach(b => b.onclick = async () => { b.disabled = true; await postNote(b.dataset.approve, { id: b.dataset.approve, action: "approve" }); renderPipeline($("#content")); });
  host.querySelectorAll("[data-stop]").forEach(b => b.onclick = async () => { b.disabled = true; await postNote(b.dataset.stop, { id: b.dataset.stop, note: T("stop_note") }); renderPipeline($("#content")); });
  host.querySelectorAll("[data-pub]").forEach(b => b.onclick = () => publishPost(b.dataset.pub, b));
  host.querySelectorAll("[data-play2]").forEach(b => b.onclick = () => openDrivePlay(b.dataset.play2, host.querySelector(".ptitle")?.textContent || "", b.dataset.reel === "1"));
  host.querySelectorAll("[data-playvid]").forEach(b => b.onclick = () => openVideo(b.dataset.playvid, host.querySelector(".ptitle")?.textContent || ""));
  host.querySelectorAll("[data-canva]").forEach(b => b.onclick = () => openCanva((list || S.queue || []).find(x => x.id === b.dataset.canva)));
  host.querySelectorAll("[data-livereel]").forEach(b => b.onclick = async () => {
    const url = prompt(T("live_reel_ask"));
    if (!url || !/^https?:\/\//.test(url)) { if (url) alert(T("live_reel_url")); return; }
    b.disabled = true; b.innerHTML = `🎬 <span class="dots"><i></i><i></i><i></i></span>`;
    const r = await fetch("/api/live-reel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.dataset.livereel, footageUrl: url }) }).then(x => x.json()).catch(() => null);
    if (r && r.ok) { try { S = await fetch("/api/state").then(x => x.json()); } catch (e) {} renderPipeline($("#content")); }
    else { alert((r && r.error) || "!"); b.disabled = false; b.innerHTML = `🎬 ${T("live_reel")}`; }
  });
  host.querySelectorAll("[data-restore]").forEach(b => b.onclick = async () => {
    if (!confirm(T("restore_confirm"))) return;
    b.disabled = true; b.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    await fetch("/api/restore-original", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.dataset.restore }) }).then(x => x.json()).catch(() => null);
    try { S = await fetch("/api/state").then(x => x.json()); } catch (e) {}
    renderPipeline($("#content"));
  });
  host.querySelectorAll("[data-alt]").forEach(b => b.onclick = async () => {
    const id = b.dataset.alt, box = host.querySelector(`[data-althost="${id}"]`);
    b.disabled = true; b.innerHTML = `🅰🅱 <span class="dots"><i></i><i></i><i></i></span>`;
    const r = await fetch("/api/alt-hooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(x => x.json()).catch(() => null);
    b.disabled = false; b.innerHTML = `🅰🅱 ${T("alt_hooks")}`;
    if (!r || !r.ok) { if (box) box.innerHTML = `<div class="mut">${(r && r.error) || "!"}</div>`; return; }
    if (box) box.innerHTML = `<div class="altwrap"><div class="mut" style="width:100%">${T("alt_pick")}</div>${r.hooks.map(h => `<button class="altchip" data-pick="${escapeHtml(h).replace(/"/g, "&quot;")}" data-pid="${id}">${escapeHtml(h)}</button>`).join("")}</div>`;
    box.querySelectorAll("[data-pick]").forEach(c => c.onclick = async () => {
      c.disabled = true; c.classList.add("picking");
      const rr = await fetch("/api/apply-hook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.dataset.pid, hook: c.dataset.pick }) }).then(x => x.json()).catch(() => null);
      if (rr && rr.ok) { try { S = await fetch("/api/state").then(x => x.json()); } catch (e) {} renderPipeline($("#content")); }
      else { c.disabled = false; c.classList.remove("picking"); }
    });
  });
  host.querySelectorAll(".slidethumb").forEach((b, i) => b.onclick = () => {
    const imgs = [...host.querySelectorAll(".slidethumb")].map(x => x.dataset.img);
    openGallery(imgs, i, host.querySelector(".ptitle")?.textContent || "");
  });
  host.querySelectorAll("[data-regen]").forEach(b => b.onclick = () => regenPost(b.dataset.regen, b));
  host.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (b.dataset.armed) return delPost(b.dataset.del);
    b.dataset.armed = "1"; b.textContent = "🗑 " + T("del_confirm"); b.classList.add("danger");
    setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "🗑"; b.classList.remove("danger"); } }, 3000);
  });
}
async function delPost(id) {
  try { await fetch("/api/delete-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); } catch (e) {}
  S = await fetch("/api/state").then(x => x.json()); pf.focus = 0; renderPipeline($("#content"));
}
// ── live publish countdown ────────────────────────────────────────
// Oman time (+04:00) — must match the server's parseWhen, or countdowns lie when traveling.
function parseWhenClient(date) { const m = (date || "").match(/(\d{4})-(\d{2})-(\d{2})[^\d]+(\d{2}):(\d{2})/); return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+04:00`) : null; }
function fmtCountdown(when) {
  let ms = when.getTime() - Date.now();
  if (ms <= 0) return "⚠️ " + T("cd_passed");
  const d = Math.floor(ms / 86400000); ms -= d * 86400000;
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const mi = Math.floor(ms / 60000);
  const parts = [];
  if (d) parts.push(d + T("cd_d"));
  if (d || h) parts.push(h + T("cd_h"));
  parts.push(mi + T("cd_m"));
  return "⏳ " + T("cd_in") + " " + parts.join(" ");
}
setInterval(() => {
  document.querySelectorAll(".cd[data-when]").forEach(el => {
    const w = +el.dataset.when, ms = w - Date.now();
    el.textContent = fmtCountdown(new Date(w));
    el.classList.toggle("urgent", ms > 0 && ms < 86400000);
  });
}, 1000);
// ── regenerate a post from its note (Claude) ──────────────────────
const dotsHtml = `<span class="dots"><span></span><span></span><span></span></span>`;
async function regenPost(id, btn) {
  // live loading: dots over the focused card + a bar in the detail
  const card = document.querySelector(`.ccard[data-idx="${pf.focus}"]`);
  if (card) card.insertAdjacentHTML("beforeend", `<div class="genov">${dotsHtml}</div>`);
  const host = $("#cdetail");
  if (host) host.insertAdjacentHTML("afterbegin", `<div class="genbar">${dotsHtml}<span>${T("regen_working")}</span></div>`);
  if (btn) { btn.disabled = true; btn.textContent = "⏳ " + T("regenerating"); }
  try {
    const r = await fetch("/api/regenerate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, lang }) }).then(r => r.json());
    S = await fetch("/api/state").then(x => x.json());
    renderPipeline($("#content"));
    if (!r.ok) alert("✗ " + (r.error || ""));
  } catch (e) { renderPipeline($("#content")); }
}
// ── generate a brand-new post (Claude) ────────────────────────────
async function genNew() {
  const prompt = window.prompt(T("gennew_prompt"), "");
  if (prompt === null) return;
  const gn = document.getElementById("gennew"); if (gn) { gn.disabled = true; gn.textContent = "⏳ " + T("generating"); }
  try {
    const r = await fetch("/api/generate-post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, lang }) }).then(r => r.json());
    if (r.ok) { pf.plat = "all"; pf.type = "all"; pf.status = "all"; S = await fetch("/api/state").then(x => x.json()); const idx = (S.queue || []).findIndex(q => q.id === r.post.id); pf.focus = idx < 0 ? 0 : idx; renderPipeline($("#content")); }
    else { if (gn) { gn.disabled = false; gn.textContent = "➕ " + T("gennew"); } alert("✗ " + (r.error || "")); }
  } catch (e) { if (gn) { gn.disabled = false; gn.textContent = "➕ " + T("gennew"); } }
}
function bindCalendar() {
  document.querySelectorAll("[data-mon]").forEach(b => b.onclick = () => {
    let [y, m] = pf.cal.split("-").map(Number); m += +b.dataset.mon;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    pf.cal = `${y}-${String(m).padStart(2, "0")}`; renderPipeline($("#content"));
  });
}
async function askManager(id) {
  const inp = document.querySelector(`.pnote[data-id="${id}"]`); if (!inp) return;
  const note = inp.value.trim(); if (!note) return;
  inp.value = ""; inp.disabled = true;
  const card = document.querySelector(`.pcard[data-id="${id}"]`);
  let th = card.querySelector(".pthread");
  if (!th) { th = document.createElement("div"); th.className = "pthread"; card.querySelector(".pcap").after(th); }
  th.insertAdjacentHTML("beforeend", `${bubble({ role: "user", text: note })}<div class="pbub manager typing"><span class="pba">CA</span><span>…</span></div>`);
  th.scrollTop = th.scrollHeight;
  try {
    const r = await fetch("/api/post-note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, note, lang }) }).then(r => r.json());
    if (r.notes) S.notes = r.notes;
    th.innerHTML = (r.thread || []).map(bubble).join("");
    th.scrollTop = th.scrollHeight;
  } catch (e) { const t = card.querySelector(".pbub.typing span:last-child"); if (t) t.textContent = "✗"; }
  inp.disabled = false; inp.focus();
}
async function publishPost(id, btn) {
  btn.disabled = true; btn.textContent = T("publishing");
  try {
    const r = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json());
    if (r.ok) { S = await fetch("/api/state").then(x => x.json()); renderPipeline($("#content")); }
    else { btn.disabled = false; btn.textContent = "📤 " + T("publish_now"); alert("✗ " + (r.error || "")); }
  } catch (e) { btn.disabled = false; btn.textContent = "📤 " + T("publish_now"); }
}

// ── analytics ─────────────────────────────────────────────────────
async function renderAnalytics(C) {
  const range = A?.range || "7d";
  C.innerHTML = `<div class="rangebar"><button data-r="7d" class="rbtn ${range === "7d" ? "on" : ""}">${T("range7")}</button><button data-r="30d" class="rbtn ${range === "30d" ? "on" : ""}">${T("range30")}</button></div>
    <div class="grid g2" id="anwrap">${A.platforms.map(anCard).join("")}</div>
    <div class="card" style="margin-top:1rem"><div class="sec-h"><h2>${T("comparison")}</h2></div>${compareBars()}</div>`;
  document.querySelectorAll(".rbtn").forEach(b => b.onclick = async () => { A = await fetch("/api/analytics?range=" + b.dataset.r).then(r => r.json()); renderAnalytics(C); });
}
function anCard(p) {
  if (!p.active) return `<div class="card" style="opacity:.75"><div class="acc"><div class="ic" style="background:${p.color}">${GLYPH[p.key] || p.key}</div><div style="flex:1"><div style="font-weight:800">${p.name}</div><div class="mut">${p.note || T("inactive")}</div></div>${pill([T("inactive"), "p-idle"])}</div></div>`;
  const m = p.metrics;
  const stat = (key, val) => `<div class="astat"><span class="an">${nf(val)}</span><span class="al">${T(key)}</span></div>`;
  return `<div class="card"><div class="acc" style="margin-bottom:.5rem"><div class="ic" style="background:${p.color}">${GLYPH[p.key] || p.key}</div><div style="flex:1"><div style="font-weight:800">${p.name}</div><div class="mut">${T("engRate")}: ${p.engagementRate}%</div></div>${pill([A.live ? "live" : "demo", A.live ? "p-ok" : "p-idle"])}</div>
    <div class="astats">${stat("followers", m.followers.total)}${stat("reach", m.reach.total)}${stat("impressions", m.impressions.total)}${stat("engagement", m.engagement.total)}${stat("clicks", m.clicks.total)}</div>
    <div class="mut" style="margin:.5rem 0 .2rem">${T("reach")} · ${A.days} ${lang === "en" ? "days" : "يوم"}</div>${chart(m.reach.series, p.color)}
    <div class="mut" style="margin:.5rem 0 .2rem">${T("engagement")}</div>${chart(m.engagement.series, "#E8890F")}</div>`;
}
function compareBars() {
  const act = A.platforms.filter(p => p.active);
  const max = Math.max(...act.map(p => p.metrics.reach.total), 1);
  return act.map(p => `<div class="cbar"><span class="cbl">${chan(p.key)} ${p.name}</span><span class="ctrack"><i style="width:${p.metrics.reach.total / max * 100}%;background:${p.color}"></i></span><b>${nf(p.metrics.reach.total)}</b></div>`).join("");
}

// ── media player (Drive preview) ──────────────────────────────────
function openDrivePlay(driveId, title, isReel) {
  $("#mvtitle").textContent = title || "";
  const f = $("#mvframe"); f.classList.remove("imgfit"); f.style.aspectRatio = isReel ? "9 / 16" : "4 / 5";
  f.innerHTML = `<iframe src="https://drive.google.com/file/d/${driveId}/preview" allow="autoplay" allowfullscreen></iframe>`;
  $("#mvhint").innerHTML = `<a class="link" target="_blank" href="https://drive.google.com/file/d/${driveId}/view">${T("openDrive")}</a>`;
  $("#mv").classList.add("on");
}
// Image lightbox / carousel gallery with ‹ › navigation between slides.
let galImgs = [], galIdx = 0, galTitle = "";
function openImage(url, title) { openGallery([url], 0, title); }
function openGallery(images, idx, title) {
  galImgs = (images || []).filter(Boolean); galIdx = idx || 0; galTitle = title || "";
  if (!galImgs.length) return;
  renderGallery(); $("#mv").classList.add("on");
}
function renderGallery() {
  const f = $("#mvframe"); f.style.aspectRatio = ""; f.classList.add("imgfit");
  const multi = galImgs.length > 1;
  $("#mvtitle").textContent = galTitle + (multi ? ` — ${galIdx + 1}/${galImgs.length}` : "");
  f.innerHTML = `<img src="${galImgs[galIdx]}">` + (multi ? `<button class="galnav gprev" aria-label="prev">‹</button><button class="galnav gnext" aria-label="next">›</button>` : "");
  $("#mvhint").innerHTML = "";
  if (multi) {
    f.querySelector(".gprev").onclick = (e) => { e.stopPropagation(); galStep(-1); };
    f.querySelector(".gnext").onclick = (e) => { e.stopPropagation(); galStep(1); };
  }
}
function galStep(d) { galIdx = (galIdx + d + galImgs.length) % galImgs.length; renderGallery(); }
// Generated reel player (9:16 MP4 served from /media/design/)
function openVideo(url, title) {
  $("#mvtitle").textContent = title || "";
  const f = $("#mvframe"); f.classList.remove("imgfit"); f.style.aspectRatio = "9 / 16";
  f.innerHTML = `<video src="${url}" controls autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>`;
  $("#mvhint").innerHTML = "";
  $("#mv").classList.add("on");
}
function closeMv() { $("#mv").classList.remove("on"); const f = $("#mvframe"); f.innerHTML = ""; f.classList.remove("imgfit"); f.style.aspectRatio = ""; galImgs = []; }
document.addEventListener("keydown", (e) => {
  if (!$("#mv").classList.contains("on")) return;
  if (e.key === "Escape") closeMv();
  else if (galImgs.length > 1 && e.key === "ArrowRight") galStep(1);
  else if (galImgs.length > 1 && e.key === "ArrowLeft") galStep(-1);
});

// ── campaigns ─────────────────────────────────────────────────────
const campView = () => `<div class="card" style="text-align:center;padding:1.4rem"><div style="font-weight:800;color:var(--plum)">${T("campNone")}</div>
  <p class="mut">${T("campPolicy")}</p><div class="grid g2" style="max-width:34rem;margin:auto;text-align:start">
  ${S.campaigns.map(c => `<div class="card" style="box-shadow:none"><div style="font-weight:800;font-size:.88rem">${c.name}</div><div class="mut">${c.meta}</div><div style="margin-top:.4rem">${pill(c.st)}</div></div>`).join("")}</div></div>`;
const accCard = (a) => `<div class="card acc"><div class="ic" style="background:${CH[a.ch] || "#888"}">${GLYPH[a.ch] || a.ch}</div><div style="flex:1"><div style="font-weight:800">${a.h}</div><div class="mut">${a.s}</div></div>${pill(a.st)}</div>`;

// ── leads (full CRM) ── search · import · auto-classify · WA/DM outreach ──
const LEAD_STAGES = ["جديد", "مهتم", "تفاوض", "عميل", "معلّق"];
let leadState = { q: "", stage: "all", source: "all", field: "all" };
let leadPanel = "";        // "" | "add" | "import"
let leadOutreachId = "";   // id whose inline composer is open

async function renderLeads(C) {
  C.innerHTML = `<div class="loading">…</div>`;
  const params = new URLSearchParams();
  if (leadState.q) params.set("q", leadState.q);
  ["stage", "source", "field"].forEach(k => { if (leadState[k] && leadState[k] !== "all") params.set(k, leadState[k]); });
  let data = { leads: [], total: 0 };
  try { data = await fetch("/api/leads?" + params.toString()).then(r => r.json()); } catch (e) {}
  const shown = data.leads || [];
  const allForOpts = S.leads || [];
  const sources = [...new Set(allForOpts.map(l => l.source).filter(Boolean))];
  const fields = [...new Set(allForOpts.map(l => l.field).filter(Boolean))];
  const sel = (id, val, opts, allLabel) => `<select class="psel" id="${id}" style="max-width:11rem"><option value="all">${allLabel}</option>${opts.map(o => `<option value="${o}" ${o === val ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}</select>`;

  const toolbar = `<div class="pcard nofloat" style="margin-bottom:1rem">
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
      <input class="pinput" id="lq" placeholder="🔍 ${T("crm_search")}" value="${escapeHtml(leadState.q)}" style="flex:1;min-width:12rem" autocomplete="off">
      ${sel("lstage", leadState.stage, LEAD_STAGES.map(s => s), T("f_all"))}
      ${sel("lsource", leadState.source, sources, T("crm_all_sources"))}
      ${sel("lfield", leadState.field, fields, T("crm_all_fields"))}
      <button class="btn sm" id="ladd">➕ ${T("crm_add")}</button>
      <button class="btn ghost sm" id="limport">📥 ${T("crm_import")}</button>
      <button class="btn ghost sm" id="lclassify">🏷 ${T("crm_classify")}</button>
      <span class="mut">${data.total || 0} ${T("crm_leads")}</span>
    </div>
    <div id="lpanel"></div></div>`;

  const kanban = `<div class="kanban">${LEAD_STAGES.map(s => {
    const items = shown.filter(l => l.stage === s);
    return `<div class="kcol"><div class="kh">${T("stage_" + s)} <span class="kc">${items.length}</span></div>
      ${items.map(leadCard).join("") || `<div class="mut" style="padding:.5rem">—</div>`}</div>`;
  }).join("")}</div>`;

  C.innerHTML = `<div class="note-info">📇 ${T("crm_hint")}</div>${toolbar}${shown.length || leadState.q || leadState.stage !== "all" ? kanban : `<div class="card" style="text-align:center;padding:1.6rem"><div style="font-weight:800">${T("crm_empty")}</div><div class="mut" style="margin-top:.4rem">${T("crm_empty_d")}</div></div>`}`;
  bindLeads(C);
}
function leadCard(l) {
  const act = l.activity || "", actCls = act === "نشِط" ? "p-ok" : act === "خامل" ? "p-idle" : "p-info";
  const isWA = /wa|whats/i.test(l.ch);
  const lastOut = (l.outreach || [])[0];
  return `<div class="lcard" data-lid="${l.id}">
    <div class="ln">${chan(l.ch)} ${escapeHtml(l.name || l.contact || "—")}</div>
    <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin:.3rem 0">
      ${l.field ? `<span class="pill p-info">${escapeHtml(l.field)}</span>` : ""}
      ${act ? `<span class="pill ${actCls}">${escapeHtml(act)}</span>` : ""}
      ${l.source ? `<span class="pill p-idle">🏷 ${escapeHtml(l.source)}</span>` : ""}</div>
    ${l.note ? `<div class="mut">${escapeHtml(l.note)}</div>` : ""}
    ${l.contact ? `<div class="lt">${escapeHtml(l.contact)}</div>` : ""}
    ${lastOut ? `<div class="lt" style="color:var(--ok)">✓ ${T("crm_last_out")}: ${escapeHtml((lastOut.message || "").slice(0, 30))}${lastOut.simulated ? ` (${T("sent_sim")})` : ""}</div>` : ""}
    <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.5rem;align-items:center">
      <select class="psel sm lstagesel" data-lid="${l.id}" title="${T("crm_stage")}">${LEAD_STAGES.map(s => `<option ${s === l.stage ? "selected" : ""}>${s}</option>`).join("")}</select>
      <button class="btn ghost sm loutbtn" data-lid="${l.id}">${isWA ? "🟢" : "✉"} ${T("crm_reach")}</button>
      <button class="btn ghost sm ldelbtn" data-lid="${l.id}" title="${T("del")}" style="margin-inline-start:auto">🗑</button>
    </div>
    <div class="loutcomposer" data-lid="${l.id}"></div></div>`;
}
function bindLeads(C) {
  const rerender = () => renderLeads(C);
  const q = $("#lq");
  if (q) { let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { leadState.q = q.value.trim(); rerender(); }, 350); }; }
  ["stage", "source", "field"].forEach(k => { const el = $("#l" + k); if (el) el.onchange = () => { leadState[k] = el.value; rerender(); }; });
  const panel = $("#lpanel");
  $("#ladd").onclick = () => { leadPanel = leadPanel === "add" ? "" : "add"; drawLeadPanel(panel, rerender); };
  $("#limport").onclick = () => { leadPanel = leadPanel === "import" ? "" : "import"; drawLeadPanel(panel, rerender); };
  $("#lclassify").onclick = async (e) => { e.target.disabled = true; e.target.textContent = "…"; await fetch("/api/leads/classify", { method: "POST" }); try { S = await fetch("/api/state").then(r => r.json()); } catch (x) {} rerender(); };
  if (leadPanel) drawLeadPanel(panel, rerender);
  C.querySelectorAll(".lstagesel").forEach(s => s.onchange = async () => { await fetch("/api/leads/" + s.dataset.lid, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: s.value }) }); try { S = await fetch("/api/state").then(r => r.json()); } catch (x) {} rerender(); });
  C.querySelectorAll(".ldelbtn").forEach(b => b.onclick = async () => { if (!confirm(T("crm_del_confirm"))) return; await fetch("/api/leads/" + b.dataset.lid, { method: "DELETE" }); try { S = await fetch("/api/state").then(r => r.json()); } catch (x) {} rerender(); });
  C.querySelectorAll(".loutbtn").forEach(b => b.onclick = () => {
    const host = C.querySelector(`.loutcomposer[data-lid="${b.dataset.lid}"]`);
    if (host.dataset.open === "1") { host.dataset.open = "0"; host.innerHTML = ""; return; }
    host.dataset.open = "1";
    host.innerHTML = `<div style="display:flex;gap:.4rem;margin-top:.5rem"><input class="pinput sm loutmsg" placeholder="${T("crm_msg_ph")}" autocomplete="off" style="flex:1"><button class="btn sm loutsend">${T("crm_send")}</button></div><div class="ok-s loutmsgr"></div>`;
    const inp = host.querySelector(".loutmsg"); inp.focus();
    const send = async () => {
      const msg = inp.value.trim(); if (!msg) return;
      const btn = host.querySelector(".loutsend"); btn.disabled = true; btn.textContent = "…";
      const r = await fetch("/api/leads/" + b.dataset.lid + "/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) }).then(x => x.json()).catch(() => null);
      const m = host.querySelector(".loutmsgr");
      if (r && r.ok) { m.textContent = r.simulated ? "✓ " + T("sent_sim") : "✓ " + T("sent"); setTimeout(() => renderLeads(C), 900); }
      else { m.textContent = "✗ " + ((r && r.error) || ""); btn.disabled = false; btn.textContent = T("crm_send"); }
    };
    host.querySelector(".loutsend").onclick = send;
    inp.onkeydown = (e) => { if (e.key === "Enter") send(); };
  });
}
function drawLeadPanel(host, rerender) {
  if (!host) return;
  if (leadPanel === "add") {
    host.innerHTML = `<div class="lformgrid" style="margin-top:.8rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.5rem">
      <input class="pinput" id="lf_name" placeholder="${T("crm_name")}" autocomplete="off">
      <input class="pinput" id="lf_contact" placeholder="${T("crm_contact")}" autocomplete="off">
      <select class="psel" id="lf_ch"><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option></select>
      <input class="pinput" id="lf_source" placeholder="${T("crm_source")}" autocomplete="off">
      <input class="pinput" id="lf_field" placeholder="${T("crm_field")}" autocomplete="off">
      <input class="pinput" id="lf_note" placeholder="${T("crm_note")}" autocomplete="off" style="grid-column:1/-1">
    </div><div style="margin-top:.6rem"><button class="btn sm" id="lf_save">💾 ${T("crm_save")}</button> <span class="ok-s" id="lf_msg"></span></div>`;
    $("#lf_save").onclick = async () => {
      const body = { name: $("#lf_name").value.trim(), contact: $("#lf_contact").value.trim(), ch: $("#lf_ch").value, source: $("#lf_source").value.trim(), field: $("#lf_field").value.trim(), note: $("#lf_note").value.trim() };
      if (!body.name && !body.contact) { $("#lf_msg").textContent = "✗ " + T("crm_need_name"); return; }
      const r = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null);
      if (r && r.ok) { leadPanel = ""; try { S = await fetch("/api/state").then(x => x.json()); } catch (e) {} rerender(); }
      else $("#lf_msg").textContent = "✗";
    };
  } else if (leadPanel === "import") {
    host.innerHTML = `<div style="margin-top:.8rem"><div class="mut" style="margin-bottom:.4rem">${T("crm_import_hint")}</div>
      <textarea class="pinput" id="lf_text" rows="5" placeholder="${T("crm_import_ph")}" style="width:100%;resize:vertical"></textarea>
      <div style="display:flex;gap:.5rem;align-items:center;margin-top:.5rem"><input class="pinput sm" id="lf_isrc" placeholder="${T("crm_source")}" style="max-width:12rem"><button class="btn sm" id="lf_imp">📥 ${T("crm_import")}</button> <span class="ok-s" id="lf_imsg"></span></div></div>`;
    $("#lf_imp").onclick = async () => {
      const text = $("#lf_text").value.trim(); if (!text) return;
      const b = $("#lf_imp"); b.disabled = true; b.textContent = "…";
      const r = await fetch("/api/leads/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, source: $("#lf_isrc").value.trim() || "استيراد" }) }).then(x => x.json()).catch(() => null);
      if (r && r.ok) { $("#lf_imsg").textContent = `✓ ${r.added}`; leadPanel = ""; try { S = await fetch("/api/state").then(x => x.json()); } catch (e) {} setTimeout(rerender, 500); }
      else { $("#lf_imsg").textContent = "✗"; b.disabled = false; b.textContent = "📥"; }
    };
  } else host.innerHTML = "";
}

// ── feeds + reply ─────────────────────────────────────────────────
function feed(list, kind, replyKind) {
  return `<div class="feed">${list.map((m, i) => `<div class="msg"><div class="mh">${chan(m.ch)} <span class="who">${escapeHtml(m.who)}</span> <span style="font-size:.72rem;color:var(--faint)">${escapeHtml(m.ref || "")}</span><span class="tm">${escapeHtml(m.tm || "")}</span></div>
    <div class="mt">${escapeHtml(m.tx)}</div>${m.sug !== "" ? `<div class="reply"><input value="${escapeHtml(m.sug || "").replace(/"/g, "&quot;")}" id="${kind}${i}"><button class="btn sm" data-r="${kind}${i}" data-ch="${m.ch}" data-id="${m.id || ""}" data-kind="${replyKind}">${T("reply")}</button></div><div id="s${kind}${i}" class="ok-s"></div>` : `<div style="font-size:.76rem;color:var(--warn)">${T("waitingChannel")}</div>`}</div>`).join("")}</div>`;
}
function bindReply() {
  document.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
    const k = b.dataset.r, msg = $("#" + k).value.trim(); if (!msg) return; b.textContent = "…";
    try {
      const r = await fetch("/api/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: b.dataset.ch, target: b.dataset.id, message: msg, kind: b.dataset.kind }) }).then(r => r.json());
      $("#s" + k).textContent = r.simulated ? "✓ " + T("sent_sim") : r.ok ? "✓ " + T("sent") : "✗ " + (r.error || ""); b.textContent = T("reply");
    } catch (e) { $("#s" + k).textContent = "✗"; b.textContent = T("reply"); }
  });
}

// ── shared: save/approve note ─────────────────────────────────────
async function postNote(id, body) { const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()); if (r.notes) S.notes = r.notes; return r; }

// ── media player close ────────────────────────────────────────────
$("#mvx").onclick = () => closeMv();
$("#mv").onclick = (e) => { if (e.target.id === "mv") closeMv(); };

// ── notifications ─────────────────────────────────────────────────
function updateNotif() {
  const items = [];
  (S.comments || []).forEach(c => items.push(`${chan(c.ch)} ${escapeHtml(c.who)}: ${escapeHtml(c.tx.slice(0, 40))}`));
  (S.messages || []).filter(m => m.sug !== "").forEach(m => items.push(`✉ ${escapeHtml(m.who)}: ${escapeHtml(m.tx.slice(0, 40))}`));
  (S.leads || []).filter(l => l.stage === "جديد").forEach(l => items.push(`🔥 ${lang === "en" ? "New lead" : "عميل جديد"}: ${escapeHtml(l.name)}`));
  $("#notifcount").textContent = items.length || "";
  $("#notifcount").style.display = items.length ? "grid" : "none";
  $("#notiflist").innerHTML = items.length ? items.map(t => `<div class="ni">${t}</div>`).join("") : `<div class="ni mut">${T("notif_none")}</div>`;
}
$("#notifbtn").onclick = () => $("#notifpop").classList.toggle("on");
document.addEventListener("click", e => { if (!e.target.closest(".notifwrap")) $("#notifpop").classList.remove("on"); });
$("#menubtn").onclick = () => $("#sidebar").classList.toggle("open");

// ── PWA ───────────────────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("#installbtn").style.display = "inline-flex"; });
$("#installbtn").onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt = null; $("#installbtn").style.display = "none"; };
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

boot();
