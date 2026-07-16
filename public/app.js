import { LANGS, I18N } from "./i18n.js";

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
  { items: ["overview"] },
  { label: "g_manage", items: ["manager", "agents", "needs"] },
  { label: "g_content", items: ["pipeline", "plan"] },
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
  if (active && !["pipeline", "manager", "settings", "comments", "messages", "leads", "plan"].includes(active)) render(active);
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
  else if (p === "agents") { C.innerHTML = `<div class="note-info">🚀 ${T("agent_improve_hint")}</div><div class="grid g3">${S.agents.map((a, i) => agentCard(a, i)).join("")}</div>`; bindAgents(); }
  else if (p === "needs") C.innerHTML = `<div class="grid g2">${S.needs.map(needCard).join("")}</div>`;
  else if (p === "pipeline") renderPipeline(C);
  else if (p === "plan") renderPlan(C);
  else if (p === "analytics") renderAnalytics(C);
  else if (p === "camp") C.innerHTML = campView();
  else if (p === "comments") { C.innerHTML = feed(S.comments, "c", "comment"); bindReply(); }
  else if (p === "messages") { C.innerHTML = feed(S.messages, "m", "dm"); bindReply(); }
  else if (p === "leads") C.innerHTML = leadsView();
  else if (p === "manager") renderManager(C);
  else if (p === "settings") renderSettings(C);
}

// ── content plan (خطة المحتوى) ── month tabs · editable table · one-click apply ──
const PLAN_TYPES = ["ريل تشويقي", "كاروسيل توعوي", "منشور علامة", "تفاعلي + استطلاع", "مجتمعي", "كاروسيل فاخر"];
const ARMONTHS_CLIENT = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
let planActiveKey = null; // which month tab is open
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
  const tabBar = `<div class="montabs">${tabs.map(t => `<button class="montab ${t.key === active.key ? "on" : ""}" data-mk="${t.key}">${escapeHtml(t.label)}${t.kind === "current" ? " • " + T("plan_this_month") : t.kind === "new" && !plans[t.key] ? " +" : ""}</button>`).join("")}</div>`;

  const bindTabs = () => C.querySelectorAll("[data-mk]").forEach(b => b.onclick = () => { planActiveKey = b.dataset.mk; renderPlan(C); });
  const fullDate = (p, it) => `${p.year}-${String(p.month).padStart(2, "0")}-${String(it.day).padStart(2, "0")} · ${it.time || ""}`;

  // ── current-month read-only schedule (real queue) ──
  if (active.kind === "current" && current) {
    const rows = current.items.map(it => `<tr>
        <td class="pdate">${escapeHtml(fullDate(current, it))}</td>
        <td>${escapeHtml(it.t)}</td><td><span class="pill p-idle">${escapeHtml(it.ty)}</span></td>
        <td class="pstat">${it.status === "published" ? (it.permalink ? `<a class="pill p-ok" target="_blank" href="${it.permalink}">📤 ${T("s_published")} ↗</a>` : `<span class="pill p-ok">📤 ${T("s_published")}</span>`) : `<span class="pill p-info">🗓 ${T("plan_scheduled")}</span>`}</td>
        <td>${it.cap ? `<button class="btn ghost sm pdet" data-cap="${attrSafe(it.cap)}">📄</button>` : ""}</td>
      </tr>`).join("");
    C.innerHTML = `<div class="planwrap">${tabBar}
      <div class="pcard nofloat planhead"><div><div class="ptitle">🗓 ${escapeHtml(current.label)}</div>
        <div class="mut" style="margin-top:.35rem">${escapeHtml(current.goal)}</div></div></div>
      <div class="tablewrap"><table class="plantable"><thead><tr>
        <th>${T("plan_date")}</th><th>${T("plan_title")}</th><th>${T("plan_type")}</th><th>${T("plan_status")}</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table></div></div>`;
    bindTabs();
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
  const rows = plan.items.map((it) => {
    const dis = it.status === "applied" ? "disabled" : "";
    const detail = (it.hook || it.cap) ? `<button class="btn ghost sm pdet" data-cap="${attrSafe([it.hook ? "🎣 " + it.hook : "", it.cap].filter(Boolean).join("\n\n"))}">📄</button>` : "";
    return `<tr data-key="${escapeHtml(it.key)}" class="${it.status === "applied" ? "applied" : ""}">
      <td class="pdate">${escapeHtml(fullDate(plan, it))}</td>
      <td><input class="pinput pday" type="number" min="1" max="28" value="${it.day}" ${dis}></td>
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
        <button class="btn ghost sm" id="plannew">♻️ ${T("plan_new")}</button>
        <button class="btn ghost sm" id="planslots" title="${T("plan_slots_hint")}">🪄 ${T("plan_slots")}</button>
        <button class="btn ghost sm" id="plansave">💾 ${T("plan_save")}</button>
        <button class="btn sm" id="planall">🚀 ${T("plan_apply_all")} (${plan.items.length - applied})</button></div></div>
    <div class="pcard nofloat" style="margin-bottom:1rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
      <span>💡</span><input class="pinput" id="ideain" placeholder="${T("idea_ph")}" style="flex:1;min-width:14rem" autocomplete="off">
      <button class="btn sm" id="ideago">${T("idea_add")}</button></div>
    <div class="tablewrap"><table class="plantable"><thead><tr>
      <th>${T("plan_date")}</th><th>${T("plan_day")}</th><th>${T("plan_time")}</th><th>${T("plan_title")}</th><th>${T("plan_type")}</th><th>${T("plan_pillar")}</th><th>${T("plan_status")}</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table></div>
    <div class="mut" id="planmsg" style="margin-top:.6rem"></div></div>`;
  bindTabs();
  C.querySelectorAll(".pdet").forEach(b => b.onclick = () => openCap(b.dataset.cap));

  const collect = () => ({ ...plan, items: [...C.querySelectorAll("tbody tr")].map(tr => {
    const key = tr.dataset.key, old = plan.items.find(i => i.key === key) || {};
    return { ...old, key, day: Math.min(Math.max(parseInt(tr.querySelector(".pday").value, 10) || old.day || 1, 1), 28),
      time: tr.querySelector(".ptime").value, t: tr.querySelector(".pt").value.trim(),
      ty: tr.querySelector(".pty").value, pillar: tr.querySelector(".ppl").value.trim() };
  }) });
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
      while (taken.has(day) && day < 28) day += 1;
      tr.querySelector(".pday").value = Math.min(day, 28);
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
  const threadHtml = thread.length ? `<div class="pthread">${thread.map(bubble).join("")}</div>` : "";
  const when = parseWhenClient(q.date);
  const cdHtml = pub ? `<span class="cd done">✓ ${T("published_ok")}</span>` : (when ? `<span class="cd" data-when="${when.getTime()}">${fmtCountdown(when)}</span>` : "");
  const hasNote = thread.some(m => m.role === "user");
  let pubBtn = "";
  if (pub) pubBtn = pub.permalink ? `<a class="link sm" target="_blank" href="${pub.permalink}">${T("published_ok")} ↗</a>` : "";
  else if (S.publishReady && !held) pubBtn = `<button class="btn sm pubbtn" data-pub="${q.id}">📤 ${T("publish_now")}</button>`;
  // one-tap emergency stop: writes a hold note so the scheduler skips this post
  const stopBtn = (!pub && !held && !q.gen) ? `<button class="btn ghost sm" data-stop="${q.id}" title="${T("stop_hint")}">⏸ ${T("stop_pub")}</button>` : "";
  return `<div class="pcard nofloat" data-id="${q.id}"><div class="pmain">
      <div class="ptitle">${escapeHtml(q.t)}</div>
      <div class="pmeta">${chan(q.ch)} ${q.ty} · <b>${q.date}</b></div>
      <div class="pcdrow">${cdHtml}<div class="pbadges">${badges}${q.regens ? `<span class="pill p-idle">♻️ ${q.regens}</span>` : ""}</div></div>
      <div class="pcap">${escapeHtml((q.cap || "").slice(0, 240))}${(q.cap || "").length > 240 ? "…" : ""}</div>
      ${(() => { const sl = slidesOf(q); return sl.length > 1 ? `<div class="slideshdr">${T("slides_label")} (${sl.length})</div><div class="slides">${sl.map((u, idx) => `<img class="slidethumb" src="${u}" loading="lazy" data-img="${u}" data-t="${idx === 0 ? T("cover") : T("slide") + " " + idx}" title="${idx === 0 ? T("cover") : T("slide") + " " + idx}">`).join("")}</div>` : ""; })()}
      ${threadHtml}
      <div class="pnotebar"><input class="pnote" data-id="${q.id}" placeholder="${T("note_ask_ph")}" autocomplete="off"><button class="btn sm askbtn" data-ask="${q.id}">${T("note_ask")}</button></div>
      <div class="pactions">
        ${pub ? "" : `<button class="btn ghost sm regenbtn ${hasNote ? "hot" : ""}" data-regen="${q.id}">♻️ ${T("regen")}</button>`}
        ${approved || pub ? "" : `<button class="btn ok sm" data-approve="${q.id}">✓ ${T("approve")}</button>`}
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

// ── leads (mini-CRM) ──────────────────────────────────────────────
function leadsView() {
  const stages = ["جديد", "مهتم", "تفاوض", "عميل", "معلّق"];
  return `<div class="kanban">${stages.map(s => {
    const items = S.leads.filter(l => l.stage === s);
    return `<div class="kcol"><div class="kh">${T("stage_" + s)} <span class="kc">${items.length}</span></div>
      ${items.map(l => `<div class="lcard"><div class="ln">${chan(l.ch)} ${escapeHtml(l.name)}</div><div class="mut">${escapeHtml(l.note)}</div><div class="lt">${escapeHtml(l.tm || "")}</div></div>`).join("") || `<div class="mut" style="padding:.5rem">—</div>`}</div>`;
  }).join("")}</div>`;
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
