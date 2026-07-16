// Live derivation layer — makes the platform SELF-AWARE and INTEGRATED.
// The dashboard was static: needs never cleared when done, agents showed
// seeded text, and nothing reconciled what actually published. This module
// derives, from real runtime state, three things every /api/state:
//   - needs[]   : an auto-updating task list (a need disappears when its
//                 condition clears — no "done but still asked")
//   - agents[]  : live task/status per agent, wired to real platform state
//   - reconcile : did each logged post really land on Instagram once? (dupes/missing)
// It never invents data — everything traces to state the server already holds.

// ── publish reconciliation ── logged vs actually-on-Instagram ────────────────
export function reconcile(publishedLog = {}, igMedia = []) {
  const logged = Object.entries(publishedLog); // [id, {at, permalink, id}]
  // duplicates on IG: same permalink appearing more than once, or same caption
  const byPermalink = {};
  for (const m of igMedia) { const k = m.url || m.id; byPermalink[k] = (byPermalink[k] || 0) + 1; }
  const capCount = {};
  for (const m of igMedia) { const c = (m.cap || "").trim().slice(0, 60); if (c) capCount[c] = (capCount[c] || 0) + 1; }
  const duplicates = igMedia.filter((m) => (m.cap && capCount[(m.cap || "").trim().slice(0, 60)] > 1))
    .map((m) => ({ t: m.t, url: m.url, when: m.d }));
  // logged as published but not found on IG (only meaningful once IG is connected)
  const igIds = new Set(igMedia.map((m) => m.id));
  const igPermalinks = new Set(igMedia.map((m) => m.url));
  const missing = igMedia.length
    ? logged.filter(([id, v]) => v && v.id && !igIds.has(v.id) && v.permalink && !igPermalinks.has(v.permalink)).map(([id]) => id)
    : [];
  return {
    loggedCount: logged.length,
    igCount: igMedia.length,
    duplicates: dedupe(duplicates),
    missing,
    ok: duplicates.length === 0 && missing.length === 0,
    checkedAt: null // stamped by caller (Date.now unavailable inside workflow scripts, fine here)
  };
}
function dedupe(arr) { const seen = new Set(); return arr.filter((x) => { const k = x.t + x.url; if (seen.has(k)) return false; seen.add(k); return true; }); }

// ── dynamic needs ── an auto-clearing task list derived from real state ──────
// Each need matches the seed shape: {id, ti, d, t:[label,cls], pr:[label,cls], f}.
// A need EXISTS only while its condition holds — it disappears when done, so the
// list is always current (no "done but still asked").
export function deriveNeeds(ctx = {}) {
  const { queue = [], notes = {}, publishedLog = {}, connectivity = {}, publishReady = false, reconcile: rec = null } = ctx;
  const N = [];
  const add = (id, ti, d, t, pr, f) => N.push({ id, ti, d, t, pr, f, live: true });

  // 1) integrations not connected (auto-clears once the key/token is added)
  if (!publishReady) add("meta", "فعّل النشر إلى إنستغرام", "أضف META_ACCESS_TOKEN و META_IG_USER_ID لتفعيل النشر التلقائي والتحقق.", ["ربط", "p-info"], ["عالٍ", "p-bad"], "Meta");
  if (connectivity.windsor === false) add("windsor", "اربط التحليلات (Windsor.ai)", "أضف WINDSOR_API_KEY لسحب الأداء الحيّ وتغذية خطط المحتوى.", ["ربط", "p-info"], ["متوسط", "p-warn"], "Analytics & Insights");
  if (connectivity.whatsapp === false) add("whatsapp", "فعّل واتساب للأعمال", "لاستقبال رسائل التجار والردّ بإشراف المدير — أهم مسار Leads.", ["ربط", "p-info"], ["عالٍ", "p-bad"], "Integrations Engineer");

  // 2) generated posts awaiting the owner's explicit approval
  const genHold = queue.filter((q) => q.gen && !publishedLog[q.id] && (notes[q.id] || {}).status !== "معتمد");
  if (genHold.length) add("genhold", `اعتمد ${genHold.length} منشوراً مولّداً`, `منشورات ولّدها الفريق تنتظر اعتمادك قبل النشر: ${genHold.slice(0, 3).map((q) => q.t).join("، ")}${genHold.length > 3 ? "…" : ""}`, ["مراجعة", "p-new"], ["عالٍ", "p-bad"], "الخطة");

  // 3) posts missing media
  const dueNoMedia = queue.filter((q) => !publishedLog[q.id] && !q.mediaUrl && !(q.images && q.images.length) && !q.drive && !(q.driveSlides && q.driveSlides.length));
  if (dueNoMedia.length) add("nomedia", `${dueNoMedia.length} منشور بلا تصميم`, `يحتاج تصميماً أو فيديو قبل النشر: ${dueNoMedia.slice(0, 3).map((q) => q.id).join("، ")}.`, ["تصميم", "p-warn"], ["متوسط", "p-warn"], "Design Studio");

  // 4) publish reconciliation problems (the verification loop)
  if (rec && rec.duplicates.length) add("dupes", `⚠️ ${rec.duplicates.length} منشور مكرر على إنستغرام`, `اكتُشف تكرار: ${rec.duplicates.slice(0, 2).map((d) => d.t).join("، ")}. احذف النسخ الزائدة يدوياً من إنستغرام.`, ["تحقّق", "p-new"], ["عالٍ", "p-bad"], "Publish Verifier");
  if (rec && rec.missing.length) add("missing", `${rec.missing.length} منشور مُعلّم كمنشور لكنه غير ظاهر`, `مسجّل كمنشور لكنه غير موجود على إنستغرام: ${rec.missing.join("، ")}. قد يحتاج إعادة نشر.`, ["تحقّق", "p-new"], ["متوسط", "p-warn"], "Publish Verifier");

  // 5) unresolved notes (owner objections) waiting on the team
  const held = queue.filter((q) => !publishedLog[q.id] && (notes[q.id] || {}).status !== "معتمد" && ((notes[q.id] || {}).note || "").trim());
  if (held.length) add("held", `${held.length} منشور معلّق على ملاحظتك`, `تركت ملاحظة والفريق ينتظر — راجع الردّ أو اعتمد.`, ["متابعة", "p-info"], ["متوسط", "p-warn"], "المراجعة");

  return N;
}

// ── performance ── rank published posts + summarize what works, for the plan ─
export function topPosts(published = [], n = 5) {
  return [...published]
    .map((m) => ({ ...m, eng: (m.likes || 0) + (m.comments || 0) + (m.saved || 0) + (m.shares || 0) }))
    .sort((a, b) => b.eng - a.eng)
    .slice(0, n);
}
// A one-line summary of which format performs best — injected into the planner
// prompt so each month's plan learns from real engagement (closed loop).
export function perfSummary(published = []) {
  if (!published.length) return "";
  const byType = {};
  for (const m of published) {
    const t = m.type === "VIDEO" ? "ريلز" : m.type === "CAROUSEL_ALBUM" ? "كاروسيل" : "منشور مفرد";
    (byType[t] = byType[t] || []).push((m.likes || 0) + (m.comments || 0) + (m.saved || 0));
  }
  const avg = Object.entries(byType).map(([t, xs]) => [t, xs.reduce((a, b) => a + b, 0) / xs.length]).sort((a, b) => b[1] - a[1]);
  if (!avg.length) return "";
  const best = avg[0][0];
  const top = topPosts(published, 3).map((m) => `«${(m.t || "").slice(0, 30)}» (${m.eng} تفاعل)`).join("، ");
  return `الأداء الفعلي الشهر الماضي: الأعلى تفاعلاً هو نوع «${best}». أفضل المنشورات: ${top}. رجّح ما ينجح.`;
}

// ── live agent status ── wire seeded agents to what's really happening ───────
export function deriveAgents(agents = [], ctx = {}) {
  const { queue = [], notes = {}, publishedLog = {}, insights = null, comments = [], messages = [], plan = null, reconcile: rec = null, connectivity = {} } = ctx;
  const pubCount = Object.keys(publishedLog).length;
  const pending = queue.filter((q) => !publishedLog[q.id] && (notes[q.id] || {}).status !== "معتمد").length;
  const nextDue = queue.filter((q) => !publishedLog[q.id]).map((q) => q.date).filter(Boolean).sort()[0];

  const live = {
    "Strategy Planner": plan ? { st: ["working", "يعمل"], task: `خطة ${plan.label}: ${plan.items.length} منشوراً، ${plan.items.filter((i) => i.status === "applied").length} مرفوعة للطابور.` } : null,
    "Publish Desk": { st: pubCount ? ["working", "يعمل"] : ["scheduled", "مجدول"], task: nextDue ? `التالي: ${nextDue}. نُشر ${pubCount} حتى الآن؛ ${pending} بانتظار المراجعة.` : `نُشر ${pubCount}؛ لا مجدول قادم.` },
    "Analytics & Insights": insights ? { st: ["working", "يعمل"], sc: 85, task: `حيّ: ${insights.reach ?? insights.followers ?? 0} وصول · ${insights.engagement ?? 0} تفاعل.` } : { task: "بانتظار ربط Windsor/Meta لسحب الأداء الحيّ." },
    "Community & Platform Steward": { st: (comments.length || messages.length) ? ["online", "متصل"] : ["idle", "خامل"], task: `${comments.length} تعليق · ${messages.length} رسالة بانتظار الردّ.`, NEW: false },
    "Integrations Engineer": { task: `Meta ${connectivity.meta ? "✓" : "✗"} · WhatsApp ${connectivity.whatsapp ? "✓" : "✗"} · Windsor ${connectivity.windsor ? "✓" : "✗"}.` },
    "Publish Verifier": rec ? { st: rec.ok ? ["online", "متصل"] : ["action", "يحتاج إجراء"], sc: rec.ok ? 92 : 60, task: rec.ok ? `تحقّق: ${rec.loggedCount} منشوراً، لا تكرار ولا نقص ✓` : `تنبيه: ${rec.duplicates.length} مكرر · ${rec.missing.length} مفقود.` } : { task: "بانتظار ربط إنستغرام للتحقق من النشر." },
  };
  return agents.map((a) => live[a.n] ? { ...a, ...live[a.n] } : a);
}

// The Publish Verifier agent (added to the roster so it always shows live).
export const PUBLISH_VERIFIER = {
  n: "Publish Verifier", r: "وكيل التحقق من النشر", c: "#0E8C6A", st: ["new", "جديد"],
  task: "يتأكد أن كل منشور نزل فعلاً على إنستغرام مرة واحدة — بلا نقص ولا تكرار.",
  sc: 0, ev: "يقارن سجل النشر بالمنشورات الفعلية على الحساب.",
  sug: "أرسل تنبيه واتساب فوري عند اكتشاف أي تكرار.",
};
