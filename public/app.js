import { LANGS, I18N } from "./i18n.js";

let S = null, A = null, cur = 0, mediaIdx = 0;
let lang = localStorage.getItem("ml_lang") || "ar";
let autoTimer = null;
const T = (k) => (I18N[lang] && I18N[lang][k]) || I18N.ar[k] || k;
const $ = (s) => document.querySelector(s);
const CH = { IG: ["#C13584", "IG"], FB: ["#1877F2", "f"], WA: ["#25D366", "WA"], TT: ["#111", "TT"], LI: ["#0A66C2", "in"], TH: ["#111", "@"] };
const chan = (k) => { const c = CH[k] || ["#888", "?"]; return `<span class="chan" style="background:${c[0]}">${c[1]}</span>`; };
const pill = (a) => a ? `<span class="pill ${a[1]}">${a[0]}</span>` : "";
const STMAP = { online: "p-ok", working: "p-info", scheduled: "p-info", idle: "p-idle", action: "p-bad", new: "p-new" };
const NAV = ["overview", "agents", "needs", "queue", "prep", "analytics", "media", "calendar", "camp", "pub", "comments", "messages", "leads", "accounts"];
const HAS_COUNT = { agents: "agents", needs: "needs", queue: "queue", prep: "prep", pub: "published", comments: "comments", messages: "messages", leads: "leads", accounts: "accounts" };

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
  if (active && active !== "media") render(active);
}
function applyLang() {
  const L = LANGS[lang]; document.documentElement.lang = lang; document.documentElement.dir = L.dir;
}
function buildChrome() {
  $("#sub").textContent = T("sub");
  $("#brandsub").textContent = T("brand_sub");
  // language selector
  $("#langsel").innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === lang ? "selected" : ""}>${v.name}</option>`).join("");
  $("#langsel").onchange = (e) => { lang = e.target.value; localStorage.setItem("ml_lang", lang); applyLang(); buildChrome(); const a = document.querySelector("#nav button.on")?.dataset.go || "overview"; render(a); };
  // banner
  const c = S.connectivity || {};
  const b = $("#banner");
  if (S.mode === "live") { b.className = "banner live"; b.innerHTML = `<span class="dotlive"></span> <b>${T("mode_live")}</b> — Meta ${c.meta ? "✓" : "—"} · WhatsApp ${c.whatsapp ? "✓" : "—"} · Windsor ${c.windsor ? "✓" : "—"}`; }
  else { b.className = "banner mock"; b.innerHTML = `<b>${T("mode_mock")}</b> — ${T("mode_mock_hint")}`; }
  $("#conn").textContent = T("updated") + ": " + (S.generatedAt || "").slice(11, 16);
  buildNav();
}
function buildNav() {
  $("#nav").innerHTML = NAV.map((n, i) => {
    const cnt = HAS_COUNT[n] && S[HAS_COUNT[n]] ? S[HAS_COUNT[n]].length : "";
    const on = document.querySelector(`#nav button[data-go="${n}"]`)?.classList.contains("on") || (i === 0 && !document.querySelector("#nav button.on"));
    return `<button data-go="${n}" class="${on ? "on" : ""}"><span>${T("nav_" + n)}</span>${cnt !== "" ? `<span class="cnt">${cnt}</span>` : ""}</button>`;
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
  else if (p === "agents") C.innerHTML = `<div class="grid g3">${S.agents.map(agentCard).join("")}</div>`;
  else if (p === "needs") C.innerHTML = `<div class="grid g2">${S.needs.map(needCard).join("")}</div>`;
  else if (p === "queue") { C.innerHTML = `<div class="qwrap">${S.queue.map((q, i) => qCard(q, i)).join("")}</div>`; document.querySelectorAll(".qcard").forEach(c => c.onclick = () => openReview(+c.dataset.i)); }
  else if (p === "prep") C.innerHTML = prepTbl();
  else if (p === "analytics") renderAnalytics(C);
  else if (p === "media") { C.innerHTML = mediaGrid(); document.querySelectorAll(".mtile").forEach(t => t.onclick = () => openMedia(+t.dataset.i)); }
  else if (p === "calendar") C.innerHTML = calendarView();
  else if (p === "camp") C.innerHTML = campView();
  else if (p === "pub") C.innerHTML = pubTbl();
  else if (p === "comments") { C.innerHTML = feed(S.comments, "c", "comment"); bindReply(); }
  else if (p === "messages") { C.innerHTML = feed(S.messages, "m", "dm"); bindReply(); }
  else if (p === "leads") C.innerHTML = leadsView();
  else if (p === "accounts") C.innerHTML = `<div class="grid g2">${S.accounts.map(accCard).join("")}</div>`;
}

// ── sections ──────────────────────────────────────────────────────
function ovv() {
  const labels = [T("kpi_agents"), T("kpi_queue"), T("kpi_assets"), T("kpi_followers")];
  const k = S.kpis.map((x, i) => `<div class="card kpi"><span class="n">${x[0]}</span><span class="l">${labels[i]}</span><span class="d">${pill([x[2], x[3]])}</span></div>`).join("");
  const ins = S.insights ? `<div class="card"><div class="sec-h"><h2>${T("perf")} (Windsor)</h2></div><div class="grid g4">
    <div class="kpi"><span class="n">${nf(S.insights.reach)}</span><span class="l">${T("reach")}</span></div>
    <div class="kpi"><span class="n">${nf(S.insights.impressions)}</span><span class="l">${T("impressions")}</span></div>
    <div class="kpi"><span class="n">${nf(S.insights.engagement)}</span><span class="l">${T("engagement")}</span></div>
    <div class="kpi"><span class="n">${nf(S.insights.clicks)}</span><span class="l">${T("clicks")}</span></div></div></div>`
    : `<div class="card"><b>${T("perf")}:</b> ${T("notConnected")}.</div>`;
  return `<div class="grid g4">${k}</div><div style="margin-top:1rem">${ins}</div>`;
}
const agentCard = (a) => `<div class="card agent"><div class="hd"><div class="av" style="background:${a.c}">${a.n.slice(0, 2).toUpperCase()}</div>
  <div><div class="nm">${a.n}${a.NEW ? ` <span class="pill p-new">${lang === "ar" ? "جديد" : lang === "en" ? "new" : "جدید"}</span>` : ""}</div><div class="rl">${a.r}</div></div></div>
  <div>${pill([a.st[1], STMAP[a.st[0]]])}</div><div class="task">${a.task}</div>
  ${a.sc > 0 ? `<div class="row"><span>${T("eval")}</span><span class="bar"><i style="width:${a.sc}%"></i></span><b>${a.sc}</b></div>` : `<div class="row">${pill([T("noScore"), "p-idle"])}</div>`}
  <div class="mut">${a.ev}</div><div class="sug"><b>${T("selfSug")}:</b> ${a.sug}</div></div>`;
const needCard = (n) => `<div class="card"><div style="display:flex;gap:.4rem;align-items:center;margin-bottom:.35rem">${pill(n.t)} ${pill(n.pr)}<span style="margin-inline-start:auto;font-size:.74rem;color:var(--muted)">${n.f}</span></div>
  <div style="font-weight:800">${n.ti}</div><div class="mut" style="margin-top:.25rem">${n.d}</div></div>`;
const qCard = (q, i) => { const nt = S.notes && S.notes[q.id]; return `<div class="qcard" data-i="${i}"><div class="thumb" style="background:linear-gradient(160deg,${q.tyc},${q.tyc}cc)"><span class="tp">${q.id}</span>${q.ty.includes("ريل") ? "▶" : ""}<div style="margin-top:.2rem">${q.t.slice(0, 20)}</div></div>
  <div class="qmeta"><div class="qt">${q.t}</div><div class="qi">${chan(q.ch)} ${q.ty} · ${q.date}</div><div>${nt && nt.status === "معتمد" ? pill([T("approve"), "p-ok"]) : pill(q.st)} ${nt && nt.note ? `<span class="pill p-idle">📝 ${T("noteBadge")}</span>` : ""}</div></div></div>`; };
const prepTbl = () => `<div class="tbl-wrap"><table><thead><tr><th>${T("cal_start")} ▲</th><th>${lang === "en" ? "Title" : "العنوان"}</th><th></th><th></th><th></th></tr></thead><tbody>
  ${S.prep.slice().sort((a, b) => a.d < b.d ? -1 : 1).map(p => `<tr><td style="font-weight:700">${p.d}</td><td>${p.t}</td><td>${chan(p.ch)} ${p.ch}</td><td style="color:var(--muted)">${p.ag}</td><td>${pill(p.st)}</td></tr>`).join("")}</tbody></table></div>`;
const campView = () => `<div class="card" style="text-align:center;padding:1.4rem"><div style="font-weight:800;color:var(--plum)">${T("campNone")}</div>
  <p class="mut">${T("campPolicy")}</p><div class="grid g2" style="max-width:34rem;margin:auto;text-align:start">
  ${S.campaigns.map(c => `<div class="card" style="box-shadow:none"><div style="font-weight:800;font-size:.88rem">${c.name}</div><div class="mut">${c.meta}</div><div style="margin-top:.4rem">${pill(c.st)}</div></div>`).join("")}</div></div>`;
const pubTbl = () => `<div class="tbl-wrap"><table><thead><tr><th>${lang === "en" ? "Content" : "المحتوى"}</th><th></th><th>${T("updated")}</th><th></th></tr></thead><tbody>
  ${S.published.map(p => `<tr><td style="font-weight:700">${p.url ? `<a class="link" target="_blank" href="${p.url}">${p.t}</a>` : p.t}</td><td>${chan(p.ch)} ${p.ch}</td><td>${p.d}</td><td class="mut">${p.m}</td></tr>`).join("")}</tbody></table></div>`;
const accCard = (a) => { const c = CH[a.ch]; return `<div class="card acc"><div class="ic" style="background:${c[0]}">${c[1]}</div><div style="flex:1"><div style="font-weight:800">${a.h}</div><div class="mut">${a.s}</div></div>${pill(a.st)}</div>`; };

// ── analytics ─────────────────────────────────────────────────────
async function renderAnalytics(C) {
  const range = A?.range || "7d";
  C.innerHTML = `<div class="rangebar"><button data-r="7d" class="rbtn ${range === "7d" ? "on" : ""}">${T("range7")}</button><button data-r="30d" class="rbtn ${range === "30d" ? "on" : ""}">${T("range30")}</button></div>
    <div class="grid g2" id="anwrap">${A.platforms.map(anCard).join("")}</div>
    <div class="card" style="margin-top:1rem"><div class="sec-h"><h2>${T("comparison")}</h2></div>${compareBars()}</div>`;
  document.querySelectorAll(".rbtn").forEach(b => b.onclick = async () => { A = await fetch("/api/analytics?range=" + b.dataset.r).then(r => r.json()); renderAnalytics(C); });
}
function anCard(p) {
  if (!p.active) return `<div class="card" style="opacity:.75"><div class="acc"><div class="ic" style="background:${p.color}">${CH[p.key][1]}</div><div style="flex:1"><div style="font-weight:800">${p.name}</div><div class="mut">${p.note || T("inactive")}</div></div>${pill([T("inactive"), "p-idle"])}</div></div>`;
  const m = p.metrics;
  const stat = (key, val) => `<div class="astat"><span class="an">${nf(val)}</span><span class="al">${T(key)}</span></div>`;
  return `<div class="card"><div class="acc" style="margin-bottom:.5rem"><div class="ic" style="background:${p.color}">${CH[p.key][1]}</div><div style="flex:1"><div style="font-weight:800">${p.name}</div><div class="mut">${T("engRate")}: ${p.engagementRate}%</div></div>${pill([T("mode_live") && A.live ? "live" : "demo", A.live ? "p-ok" : "p-idle"])}</div>
    <div class="astats">${stat("followers", m.followers.total)}${stat("reach", m.reach.total)}${stat("impressions", m.impressions.total)}${stat("engagement", m.engagement.total)}${stat("clicks", m.clicks.total)}</div>
    <div class="mut" style="margin:.5rem 0 .2rem">${T("reach")} · ${A.days} ${lang === "en" ? "days" : "يوم"}</div>${chart(m.reach.series, p.color)}
    <div class="mut" style="margin:.5rem 0 .2rem">${T("engagement")}</div>${chart(m.engagement.series, "#E8890F")}</div>`;
}
function compareBars() {
  const act = A.platforms.filter(p => p.active);
  const max = Math.max(...act.map(p => p.metrics.reach.total), 1);
  return act.map(p => `<div class="cbar"><span class="cbl">${chan(p.key)} ${p.name}</span><span class="ctrack"><i style="width:${p.metrics.reach.total / max * 100}%;background:${p.color}"></i></span><b>${nf(p.metrics.reach.total)}</b></div>`).join("");
}

// ── media gallery + player ────────────────────────────────────────
function mediaGrid() {
  return `<div class="note-info">${T("mediaShare")}</div><div class="grid g4">${S.queue.map((q, i) => `<div class="mtile" data-i="${i}"><div class="mthumb" style="background:linear-gradient(160deg,${q.tyc},${q.tyc}bb)">${q.ty.includes("ريل") ? '<span class="play">▶</span>' : "🖼"}<span class="tp">${q.id}</span></div><div class="mcap">${q.t}</div></div>`).join("")}</div>`;
}
function openMedia(i) {
  mediaIdx = i; const q = S.queue[i];
  $("#mvtitle").textContent = q.id + " · " + q.t;
  $("#mvframe").innerHTML = `<iframe src="https://drive.google.com/file/d/${q.drive}/preview" allow="autoplay" allowfullscreen></iframe>`;
  $("#mvhint").innerHTML = `${q.ty} · ${q.date} — <a class="link" target="_blank" href="https://drive.google.com/file/d/${q.drive}/view">${T("openDrive")}</a>`;
  $("#mv").classList.add("on");
}

// ── calendar ──────────────────────────────────────────────────────
function calendarView() {
  const y = 2026, mo = 6; // July 2026
  const first = new Date(y, mo, 1).getDay(); const days = new Date(y, mo + 1, 0).getDate();
  const ev = {};
  S.queue.forEach(q => { const d = +q.date.slice(8, 10); (ev[d] = ev[d] || []).push({ t: "pub", q }); });
  S.prep.forEach(p => { if (p.d.startsWith("2026-07")) { const d = +p.d.slice(8, 10); (ev[d] = ev[d] || []).push({ t: "start", p }); } });
  const wd = lang === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  let cells = "";
  for (let i = 0; i < first; i++) cells += `<div class="ccell empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const e = ev[d] || [];
    const dots = e.map(x => `<span class="cdot ${x.t}"></span>`).join("");
    const tip = e.map(x => x.t === "pub" ? `▲ ${T("cal_pub")}: ${x.q.id}` : `● ${T("cal_start")}: ${x.p.t}`).join(" · ");
    cells += `<div class="ccell ${e.length ? "has" : ""}" title="${tip}"><span class="cd">${d}</span><span class="cdots">${dots}</span></div>`;
  }
  return `<div class="card"><div class="sec-h"><h2>${lang === "en" ? "July 2026" : "يوليو ٢٠٢٦"}</h2>
    <span class="hint"><span class="cdot pub"></span> ${T("cal_pub")} &nbsp; <span class="cdot start"></span> ${T("cal_start")}</span></div>
    <div class="cgrid head">${wd.map(w => `<div class="cwd">${w}</div>`).join("")}</div><div class="cgrid">${cells}</div></div>`;
}

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

// ── review modal (shared notes) ───────────────────────────────────
function openReview(i) {
  cur = i; const q = S.queue[i]; const nt = (S.notes && S.notes[q.id]) || {};
  $("#mbig").style.background = `linear-gradient(160deg,${q.tyc},${q.tyc}bb)`;
  $("#mbig").innerHTML = `<div><div style="font-size:.8rem;opacity:.85">${q.id}</div><div style="font-size:1.05rem;margin-top:.4rem">${q.t}</div><div style="font-size:.72rem;opacity:.8;margin-top:.6rem">${q.ty.includes("ريل") ? "▶" : "🖼"}</div></div>`;
  $("#mtitle").textContent = q.t; $("#mchan").innerHTML = `${chan(q.ch)} ${q.ch} · ${q.ty} · ${q.date}`;
  $("#mcap").textContent = q.cap;
  $("#mplaybtn").onclick = () => { $("#ov").classList.remove("on"); document.querySelector('#nav button[data-go="media"]').click(); setTimeout(() => openMedia(i), 60); };
  $("#mdrive").href = "https://drive.google.com/file/d/" + q.drive + "/view"; $("#mdrive").textContent = T("openDrive");
  $("#mnote").placeholder = T("note_ph"); $("#mnote").value = nt.note || "";
  $("#msave").textContent = T("save"); $("#mapprove").textContent = "✓ " + T("approve"); $("#mnext").textContent = T("next") + " ↩";
  $("#msaved").textContent = nt.status === "معتمد" ? "✓ " + T("approvedMsg") : nt.note ? "📝 " + nt.note : "";
  $("#ov").classList.add("on");
}
async function postNote(id, body) { const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()); if (r.notes) S.notes = r.notes; return r; }
$("#mx").onclick = () => $("#ov").classList.remove("on");
$("#ov").onclick = (e) => { if (e.target.id === "ov") $("#ov").classList.remove("on"); };
$("#msave").onclick = async () => { const q = S.queue[cur]; await postNote(q.id, { id: q.id, note: $("#mnote").value }); $("#msaved").textContent = $("#mnote").value.trim() ? T("noteSaved") : ""; };
$("#mapprove").onclick = async () => { const q = S.queue[cur]; await postNote(q.id, { id: q.id, action: "approve" }); $("#msaved").textContent = "✓ " + T("approvedMsg"); };
$("#mnext").onclick = () => openReview((cur + 1) % S.queue.length);
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
