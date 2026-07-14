import { LANGS, I18N } from "./i18n.js";

let S = null, A = null, mediaIdx = 0;
let lang = localStorage.getItem("ml_lang") || "ar";
let autoTimer = null;
let pf = { plat: "all", type: "all", status: "all" }; // pipeline filters
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
  { items: ["overview"] },
  { label: "g_manage", items: ["manager", "agents", "needs"] },
  { label: "g_content", items: ["pipeline"] },
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
  if (active && !["pipeline", "manager", "settings"].includes(active)) render(active);
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
  if (p === "overview") C.innerHTML = ovv();
  else if (p === "agents") { C.innerHTML = `<div class="note-info">🚀 ${T("agent_improve_hint")}</div><div class="grid g3">${S.agents.map((a, i) => agentCard(a, i)).join("")}</div>`; bindAgents(); }
  else if (p === "needs") C.innerHTML = `<div class="grid g2">${S.needs.map(needCard).join("")}</div>`;
  else if (p === "pipeline") renderPipeline(C);
  else if (p === "analytics") renderAnalytics(C);
  else if (p === "camp") C.innerHTML = campView();
  else if (p === "comments") { C.innerHTML = feed(S.comments, "c", "comment"); bindReply(); }
  else if (p === "messages") { C.innerHTML = feed(S.messages, "m", "dm"); bindReply(); }
  else if (p === "leads") C.innerHTML = leadsView();
  else if (p === "manager") renderManager(C);
  else if (p === "settings") renderSettings(C);
}

// ── manager chat (CAIMO) ──────────────────────────────────────────
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
  return `<div class="grid g4">${k}</div>
    <div class="grid g2" style="margin-top:1rem">${pipeHealth}${trend}</div>
    <div class="grid g2" style="margin-top:1rem">${sched}${ins}</div>
    <div style="margin-top:1rem">${cmp}</div>`;
}

// ── agents (with self-improvement approval) ───────────────────────
function agentCard(a, i) {
  return `<div class="card agent"><div class="hd"><div class="av" style="background:${a.c}">${a.n.slice(0, 2).toUpperCase()}</div>
  <div><div class="nm">${a.n}${a.NEW ? ` <span class="pill p-new">${lang === "ar" ? "جديد" : lang === "en" ? "new" : "جدید"}</span>` : ""}${a.improved ? ` <span class="pill p-ok" title="${T("agent_improved")}">↑${a.improvements || ""}</span>` : ""}</div><div class="rl">${a.r}</div></div></div>
  <div>${pill([a.st[1], STMAP[a.st[0]]])}</div><div class="task">${escapeHtml(a.task)}</div>
  ${a.sc > 0 ? `<div class="row"><span>${T("eval")}</span><span class="bar"><i style="width:${a.sc}%"></i></span><b>${a.sc}</b></div>` : `<div class="row">${pill([T("noScore"), "p-idle"])}</div>`}
  <div class="mut">${escapeHtml(a.ev)}</div>
  <div class="sug"><div class="sugh"><b>${T("selfSug")}</b>${a.sug ? `<button class="sugok" data-improve="${i}" title="${T("agent_approve")}">✓</button>` : ""}</div><div class="sugt">${escapeHtml(a.sug)}</div></div></div>`;
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
      S.agents[i] = { ...a, task: r.agent.task, ev: r.agent.ev, sug: r.agent.sug, sc: r.agent.sc, improved: true, improvements: r.agent.improvements };
      render("agents");
    } else { btn.textContent = "✓"; btn.disabled = false; }
  } catch (e) { btn.textContent = "✗"; setTimeout(() => { btn.textContent = "✓"; btn.disabled = false; }, 1200); }
}
const needCard = (n) => `<div class="card"><div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.35rem">${pill(n.t)} ${pill(n.pr)}<span style="margin-inline-start:auto;font-size:.74rem;color:var(--muted)">${n.f}</span></div>
  <div style="font-weight:800">${n.ti}</div><div class="mut" style="margin-top:.25rem">${n.d}</div></div>`;

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
  const batch = S.contentBatch ? `<div class="note-info">✨ ${T("genBatch")}: <b>${S.contentBatch}</b> — ${T("genBy")}</div>` : "";
  const list = filtered.length ? filtered.map(pipeCard).join("") : `<div class="loading">${T("f_none")}</div>`;
  C.innerHTML = `${batch}<div class="pipehead"><b>${T("nav_pipeline")}</b><span class="mut">${filtered.length} / ${q.length}</span></div>${bar}<div class="pipefeed">${list}</div>`;
  bindPipeline();
}
function pipeCard(q) {
  const nt = (S.notes && S.notes[q.id]) || {};
  const pub = S.publishedLog && S.publishedLog[q.id];
  const approved = nt.status === "معتمد";
  const thread = nt.thread || [];
  const isReel = (q.ty || "").includes("ريل");
  const badges = [
    pub ? `<span class="pill p-ok">📤 ${T("published_ok")}</span>` : approved ? `<span class="pill p-ok">✓ ${T("approve")}</span>` : pill(q.st),
    q.gen ? `<span class="pill p-new">✨ ${T("gen")}</span>` : ""
  ].filter(Boolean).join(" ");
  const threadHtml = thread.length ? `<div class="pthread">${thread.map(bubble).join("")}</div>` : "";
  let pubBtn = "";
  if (pub) pubBtn = pub.permalink ? `<a class="link sm" target="_blank" href="${pub.permalink}">${T("published_ok")} ↗</a>` : "";
  else if (S.publishReady && approved) pubBtn = `<button class="btn sm pubbtn" data-pub="${q.id}">📤 ${T("publish_now")}</button>`;
  return `<div class="pcard" data-id="${q.id}">
    <div class="pthumb" style="background:linear-gradient(160deg,${q.tyc},${q.tyc}bb)" ${q.drive ? `data-play="${q.drive}"` : ""}>
      <span class="tp">${q.id}</span>${q.drive ? `<span class="pplay">${isReel ? "▶" : "🖼"}</span>` : `<span class="pplay dim">✎</span>`}
      <div class="pthumbt">${escapeHtml(q.t.slice(0, 26))}</div></div>
    <div class="pmain">
      <div class="ptitle">${escapeHtml(q.t)}</div>
      <div class="pmeta">${chan(q.ch)} ${q.ty} · <b>${q.date}</b></div>
      <div class="pbadges">${badges}</div>
      <div class="pcap">${escapeHtml((q.cap || "").slice(0, 170))}${(q.cap || "").length > 170 ? "…" : ""}</div>
      ${threadHtml}
      <div class="pnotebar"><input class="pnote" data-id="${q.id}" placeholder="${T("note_ask_ph")}" autocomplete="off"><button class="btn sm askbtn" data-ask="${q.id}">${T("note_ask")}</button></div>
      <div class="pactions">
        ${approved || pub ? "" : `<button class="btn ok sm" data-approve="${q.id}">✓ ${T("approve")}</button>`}
        ${pubBtn}
        ${q.drive ? `<a class="link sm" target="_blank" href="https://drive.google.com/file/d/${q.drive}/view">${T("openDrive")}</a>` : ""}
      </div>
    </div></div>`;
}
const bubble = (m) => `<div class="pbub ${m.role}">${m.role === "manager" ? '<span class="pba">CA</span>' : ""}<span>${escapeHtml(m.text)}</span></div>`;
function bindPipeline() {
  document.querySelectorAll(".fchip").forEach(b => b.onclick = () => { pf[b.dataset.f] = b.dataset.v; renderPipeline($("#content")); });
  document.querySelectorAll(".pthumb[data-play]").forEach(t => t.onclick = () => openDrivePlay(t.dataset.play, t.closest(".pcard").querySelector(".ptitle").textContent));
  document.querySelectorAll("[data-ask]").forEach(b => b.onclick = () => askManager(b.dataset.ask));
  document.querySelectorAll(".pnote").forEach(i => i.onkeydown = e => { if (e.key === "Enter") askManager(i.dataset.id); });
  document.querySelectorAll("[data-approve]").forEach(b => b.onclick = async () => { b.disabled = true; await postNote(b.dataset.approve, { id: b.dataset.approve, action: "approve" }); renderPipeline($("#content")); });
  document.querySelectorAll("[data-pub]").forEach(b => b.onclick = () => publishPost(b.dataset.pub, b));
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
  if (!confirm(T("publish_confirm"))) return;
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
function openDrivePlay(driveId, title) {
  $("#mvtitle").textContent = title || "";
  $("#mvframe").innerHTML = `<iframe src="https://drive.google.com/file/d/${driveId}/preview" allow="autoplay" allowfullscreen></iframe>`;
  $("#mvhint").innerHTML = `<a class="link" target="_blank" href="https://drive.google.com/file/d/${driveId}/view">${T("openDrive")}</a>`;
  $("#mv").classList.add("on");
}

// ── campaigns ─────────────────────────────────────────────────────
const campView = () => `<div class="card" style="text-align:center;padding:1.4rem"><div style="font-weight:800;color:var(--plum)">${T("campNone")}</div>
  <p class="mut">${T("campPolicy")}</p><div class="grid g2" style="max-width:34rem;margin:auto;text-align:start">
  ${S.campaigns.map(c => `<div class="card" style="box-shadow:none"><div style="font-weight:800;font-size:.88rem">${c.name}</div><div class="mut">${c.meta}</div><div style="margin-top:.4rem">${pill(c.st)}</div></div>`).join("")}</div></div>`;
const accCard = (a) => `<div class="card acc"><div class="ic" style="background:${CH[a.ch] || "#888"}">${GLYPH[a.ch] || a.ch}</div><div style="flex:1"><div style="font-weight:800">${a.h}</div><div class="mut">${a.s}</div></div>${pill(a.st)}</div>`;

// ── leads (mini-CRM) ──────────────────────────────────────────────
function leadsView() {
  const stages = ["جديد", "مهتم", "تفاوض", "عميل", "معلّق"];
  return `<div class="kanban">${stages.map(s => {
    const items = S.leads.filter(l => l.stage === s);
    return `<div class="kcol"><div class="kh">${T("stage_" + s)} <span class="kc">${items.length}</span></div>
      ${items.map(l => `<div class="lcard"><div class="ln">${chan(l.ch)} ${l.name}</div><div class="mut">${l.note}</div><div class="lt">${l.tm}</div></div>`).join("") || `<div class="mut" style="padding:.5rem">—</div>`}</div>`;
  }).join("")}</div>`;
}

// ── feeds + reply ─────────────────────────────────────────────────
function feed(list, kind, replyKind) {
  return `<div class="feed">${list.map((m, i) => `<div class="msg"><div class="mh">${chan(m.ch)} <span class="who">${m.who}</span> <span style="font-size:.72rem;color:var(--faint)">${m.ref || ""}</span><span class="tm">${m.tm}</span></div>
    <div class="mt">${m.tx}</div>${m.sug !== "" ? `<div class="reply"><input value="${(m.sug || "").replace(/"/g, "&quot;")}" id="${kind}${i}"><button class="btn sm" data-r="${kind}${i}" data-ch="${m.ch}" data-id="${m.id || ""}" data-kind="${replyKind}">${T("reply")}</button></div><div id="s${kind}${i}" class="ok-s"></div>` : `<div style="font-size:.76rem;color:var(--warn)">${T("waitingChannel")}</div>`}</div>`).join("")}</div>`;
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
$("#mvx").onclick = () => { $("#mv").classList.remove("on"); $("#mvframe").innerHTML = ""; };
$("#mv").onclick = (e) => { if (e.target.id === "mv") { $("#mv").classList.remove("on"); $("#mvframe").innerHTML = ""; } };

// ── notifications ─────────────────────────────────────────────────
function updateNotif() {
  const items = [];
  (S.comments || []).forEach(c => items.push(`${chan(c.ch)} ${c.who}: ${c.tx.slice(0, 40)}`));
  (S.messages || []).filter(m => m.sug !== "").forEach(m => items.push(`✉ ${m.who}: ${m.tx.slice(0, 40)}`));
  (S.leads || []).filter(l => l.stage === "جديد").forEach(l => items.push(`🔥 ${lang === "en" ? "New lead" : "عميل جديد"}: ${l.name}`));
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
