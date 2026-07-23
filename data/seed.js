// Seed / base state for the ops dashboard.
// In MODE=mock this is served as-is. In MODE=live the comments/messages/insights
// sections are replaced by real API data (see integrations/*), the rest (agents,
// queue, prep, campaigns, accounts) stays here as the team's operating record.

export const agents = [
  { n: "CAIMO", r: "المدير — المشرف العام", c: "#6E1444", st: ["online", "متصل"], task: "يشرف على دفعة يوليو ويوجّه معيار «الطاقة البصرية»", sc: 92, ev: "قيادة متسقة؛ فعّل نموذج الصمت-موافقة ووحّد المعايير.", sug: "أتمتة تقرير يومي موحّد يجمع حالة كل الوكلاء." },
  { n: "Strategy Planner", r: "وكيل التخطيط", c: "#9D1F60", st: ["working", "يعمل"], task: "خطة محتوى الأسبوعين + أعمدة المحتوى ونسبها", sc: 88, ev: "أعمدة واضحة ونِسب متوازنة.", sug: "ابدأ تخطيط دفعة أغسطس مبكرًا." },
  { n: "Content Studio", r: "وكيل المحتوى", c: "#B83B76", st: ["working", "يعمل"], task: "12 كابشن + سكربتات الريلز الثلاثة", sc: 90, ev: "هوكات قوية بعد ضبط اللهجة.", sug: "جهّز بنك عناوين مسبق لتسريع الإنتاج." },
  { n: "Design Studio", r: "وكيل التصميم", c: "#E8890F", st: ["working", "يعمل"], task: "أنتج 32 تصميم + 3 ريلز + 4 ستوريز", sc: 85, ev: "إخراج عالٍ؛ احتاج 4 جولات لمعيار الطاقة البصرية.", sug: "طبّق فحص Stop-the-Scroll قبل الحفظ." },
  { n: "Reviewer (QA)", r: "وكيل المراجعة", c: "#2D6FB3", st: ["idle", "بانتظار"], task: "بانتظار مراجعة الإدارة للدفعة", sc: 80, ev: "فحص الادعاءات والهوية سليم.", sug: "أضف فحصًا آليًا لأرقام التواصل قبل النشر." },
  { n: "Localizer", r: "الترجمة والتوطين", c: "#1A7A8A", st: ["idle", "خامل"], task: "لا مهام AR/EN حاليًا", sc: 78, ev: "جاهز للتفعيل عند التوسّع للإنجليزية.", sug: "جهّز مسرد مصطلحات ثابت." },
  { n: "Publish Desk", r: "وكيل النشر", c: "#5E7A1A", st: ["scheduled", "مجدول"], task: "جدولة MJ-001 اليوم 20:30", sc: 82, ev: "ينشر المعتمد فقط.", sug: "اربط الجدولة بـ Meta Business Suite." },
  { n: "Analytics & Insights", r: "وكيل التحليلات", c: "#7A5A1A", st: ["idle", "غير مُفعّل"], task: "بانتظار أول نشر لسحب البيانات عبر Windsor.ai", sc: 0, ev: "لم يُفعّل بعد.", sug: "اربط Windsor.ai الآن ليجهّز خط الأساس." },
  { n: "Knowledge Librarian", r: "أمين قاعدة المعرفة", c: "#3A6E44", st: ["online", "متصل"], task: "يحدّث قاعدة المعرفة وملف التسليم", sc: 90, ev: "توثيق دقيق ومزامنة موثوقة.", sug: "أرشفة أسبوعية مؤرّخة." },
  { n: "Integrations Engineer", r: "وكيل التكاملات", c: "#B0521A", st: ["action", "يحتاج إجراء"], task: "ربط IG/FB مؤكد؛ WhatsApp API معلّق", sc: 70, ev: "التكاملات الأساسية تمت؛ الناقص واتساب.", sug: "فعّل WhatsApp Business API." },
  { n: "Automation Engineer", r: "وكيل الأتمتة", c: "#5A5A7A", st: ["working", "يعمل"], task: "صيانة نظام المهام + سكربتات التوليد", sc: 80, ev: "السكربتات على جهاز المكتب فقط.", sug: "انسخ السكربتات إلى Drive/_Scripts." },
  { n: "Campaigns Manager", r: "الحملات المدفوعة", c: "#8A2A2A", st: ["idle", "خامل"], task: "خامل حتى الإطلاق", sc: 0, ev: "لا حملات قبل الإطلاق (سياسة).", sug: "جهّز جمهورًا مخصصًا وبيكسل مسبقًا." },
  { n: "Creative Innovation", r: "وكيل الابتكار", c: "#B96BB9", st: ["working", "يعمل"], task: "يقترح قوالب وأفكارًا تكسر التكرار", sc: 83, ev: "أدخل ألوان تمييز ثانوية بحساب.", sug: "وثّق كل قالب ناجح في Design_System فورًا." },
  { n: "Community & Platform Steward", r: "مسؤول المنصة والمجتمع", c: "#0E8C6A", st: ["new", "جديد — يُفعّل"], task: "يتابع الحساب، يجمع التعليقات والرسائل، يردّ بإشراف المدير", sc: 0, ev: "أُنشئ 2026-07-12 — بانتظار صلاحية Comment/DM API.", sug: "اربطه بـ Graph API عبر Integrations.", NEW: true }
];

export const needs = [
  { f: "Integrations Engineer", t: ["تكامل", "p-info"], pr: ["عالٍ", "p-bad"], ti: "تفعيل WhatsApp Business API", d: "أهم مسار تحويل للتجار — بدونه تُفقد Leads. يتطلب مزوّدًا وربط رقم 97426620." },
  { f: "Analytics & Insights", t: ["تكامل", "p-info"], pr: ["عالٍ", "p-bad"], ti: "ربط Windsor.ai لسحب بيانات IG/FB", d: "لتجهيز خط الأساس فور نشر MJ-001. يعمل بلا كود عبر OAuth." },
  { f: "Community & Platform Steward", t: ["صلاحية", "p-new"], pr: ["عالٍ", "p-bad"], ti: "صلاحية قراءة/رد التعليقات والرسائل", d: "الوكيل الجديد يحتاج وصول Graph API ليبدأ الرصد والرد." },
  { f: "Design Studio", t: ["توظيف", "p-warn"], pr: ["متوسط", "p-warn"], ti: "توظيف وكيل مونتاج فيديو", d: "الريلز حاليًا موشن آلي؛ وكيل مونتاج يرفع الجودة." },
  { f: "Automation Engineer", t: ["تكامل", "p-info"], pr: ["متوسط", "p-warn"], ti: "أداة جدولة تلقائية للنشر", d: "ربط Business Suite API لجدولة الدفعة بضغطة." },
  { f: "CAIMO", t: ["عملية", "p-idle"], pr: ["منخفض", "p-idle"], ti: "تقرير يومي موحّد من كل الوكلاء", d: "لوحة صباحية تجمع حالة كل وكيل — هذه اللوحة نواته." }
];

// July launch batch — designs ready. Relaunch officially Jul 15, spaced ~2 days,
// evening slots. (MJ-000 logo test post was published then retired.)
export const queue = [
  // Already published (over-published due to the ephemeral-storage bug). Dated in
  // the past so the 24h-stale backstop permanently skips it — no re-publish. Reschedule forward to run it cleanly again.
  { id: "MJ-001", t: "كم نظام تستخدم عشان تدير تجارتك؟", ch: "IG", ty: "ريل تشويقي", tyc: "#6E1444", date: "2026-07-13 · 20:00", st: ["نُشر مسبقاً", "p-ok"], drive: "1Wy1U6OL_LSSzpRD3Vmsp2ebRO0lC2VHL", cap: "لكل تاجر في عُمان… كم نظام تستخدم عشان تدير تجارتك؟ قريبًا، شيء يجمعها كلها في مكان واحد." },
  { id: "MJ-002", t: "٥ أخطاء تقتل مبيعاتك", ch: "IG", ty: "كاروسيل توعوي", tyc: "#E8890F", date: "2026-07-17 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1-LPc8wDO-SBRwD2hI-u-ZEyn5AmJmbqV", driveSlides: ["1-LPc8wDO-SBRwD2hI-u-ZEyn5AmJmbqV", "1PhopxTem0AcEkjUs5XCa07VoBOYbKY2G", "1V2x4elcvV08MfR0Nn7Iqr5_3v4qeqxeS", "12IIOBG6a26RVx1AzLdHKjZT_XjesUDWd", "1LC8PaMT2-w6qtcdkmdiUo9WG5V-5-ZmP", "1UvALiZOLAjhw9AQEkKK2M-5QoAtINIg5", "1JBGd4KElAP9r2CwnSa1sPFYOxW1bqrbr"], cap: "٥ أخطاء تخلي متجرك يفشل قبل ما يبدأ. احفظها." },
  { id: "MJ-003", t: "قصتنا بدأت من نفس مكانك", ch: "IG", ty: "منشور علامة", tyc: "#9D1F60", date: "2026-07-19 · 20:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1dyU4jEXNHxdeqGIOCasXnG0Bze7IYwOv", cap: "فريق عُماني عاش نفس تحديات التاجر. قصتنا بدأت من نفس مكانك." },
  { id: "MJ-004", t: "متجرك موجود.. بس المبيعات صفر؟", ch: "IG", ty: "ريل توعوي", tyc: "#B83B76", date: "2026-07-21 · 21:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1xJyfuwqZ4W4PsRXUuCkiY9EyFg9GG5IM", cap: "متجرك موجود بس المبيعات صفر؟ غالبًا السبب واحد من ثلاثة." },
  { id: "MJ-005", t: "استطلاع: أكبر تحدٍّ يواجهك؟", ch: "IG", ty: "تفاعلي + استطلاع", tyc: "#2D6FB3", date: "2026-07-23 · 19:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1uQU_fun0lutQ6CsD7DQVaW_CCaXbDbax", cap: "وش أكبر تحدٍّ يواجهك اليوم في تجارتك؟" },
  { id: "MJ-006", t: "تجارتك كلها في نظام واحد", ch: "IG", ty: "تشويقي", tyc: "#6E1444", date: "2026-07-25 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1zyVAlQxvmCgI2HXw65jZk657ANzVPLKq", cap: "متجرك والكاشير وحساباتك يشتغلون كفريق واحد. قريبًا." },
  { id: "MJ-007", t: "جهّز منتجاتك للبيع أونلاين", ch: "IG", ty: "كاروسيل توعوي", tyc: "#E8890F", date: "2026-07-27 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1mxSL2aHJhFL0FrVH24XixsNFOdVB2tQ7", driveSlides: ["1mxSL2aHJhFL0FrVH24XixsNFOdVB2tQ7", "1JrJe86oglTLeJEhjQENHhy9sWtl2DYzP", "1LeP59RbeXM2KYaUsYiVgLY1SMpV62tK1", "1PfjhadT2tj_QzvB-UQlMKzZZ65Z3M89w", "1HRYC_ZykSTJdYsWcbUUiv70naNHhDnxB", "1GrwTKE1_v_Wo68SpJv2_ZMKRExyDl0O1", "1ltddmyq_wqM7ZrebX54vBJDxPlUGDe7j", "10QcQlNdHyMMQYL-WC0tlQeUzNxoV98Uk"], cap: "دليل مختصر خطوة بخطوة لتجهيز منتجاتك للبيع." },
  { id: "MJ-008", t: "شريك ينجح معك", ch: "IG", ty: "منشور علامة", tyc: "#9D1F60", date: "2026-07-29 · 20:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1bI7h9_QI-0ikQhiZOJiwnx0W7Juczdpp", cap: "فرق بين شركة تبيعك خدمة وشريك ينجح معك. أربع قيم." },
  { id: "MJ-009", t: "كم ساعة تضيع في إدخال منتجاتك؟", ch: "IG", ty: "ريل تشويقي", tyc: "#6E1444", date: "2026-07-31 · 21:00", st: ["جاهز للمراجعة", "p-warn"], drive: "1L6JWUk_YElLUH6e5-ZOwAuDjZ4eKXpLB", cap: "شو لو تلقى آلاف العلامات جاهزة مسبقًا؟ قريبًا." },
  { id: "MJ-010", t: "الكاشير التقليدي vs الذكي", ch: "IG", ty: "كاروسيل مقارنة", tyc: "#E8890F", date: "2026-08-02 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1bd5NI-1upLMX6_PMbnVLyX_rJetZTwiT", driveSlides: ["1bd5NI-1upLMX6_PMbnVLyX_rJetZTwiT", "1qZgSerSFBDxA07x8feIJxkH2BPfbOMGC", "15EjygezwvThGG_uJz7xMs32xnHh-eR96", "1J5XSIAfCgLhk_pfEYn60DdUlYDlmy1N6", "1SUhE-RS_6WW_2vNAIU682ZS1sdctO291"], cap: "كاشيرك القديم يسجّل المبيعات بس هل يديرها؟" },
  { id: "MJ-011", t: "منشن متجر عُماني تحبه", ch: "IG", ty: "مجتمعي", tyc: "#0E8C6A", date: "2026-08-04 · 19:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1tlVNYWl0OBV5DM9Xz9UyahnRmgkLLDIp", cap: "منشن متجر عُماني جرّبته وعجبك في التعليقات." },
  { id: "MJ-012", t: "وعدنا لك يا تاجر عُمان", ch: "IG", ty: "كاروسيل فاخر", tyc: "#4E0E30", date: "2026-08-06 · 20:30", st: ["جاهز للمراجعة", "p-warn"], drive: "1cxbK8PwW3Q6Ny_R0DKA9DnAUb3GqnCxq", driveSlides: ["1cxbK8PwW3Q6Ny_R0DKA9DnAUb3GqnCxq", "17-4kYRG7hShdgCuY6a4xU84JxDWXxxjc", "1UWmuhe9F4bUaZQVXyMJhFbjUE_sATqGh", "1NL7rJv_NYT8l9RxrFeumM_y2rhETB9we"], cap: "وعدنا لك يا تاجر عُمان: منصة بلا خبرة تقنية، أدواتك في مكان واحد. قريبًا." }
];

// In-preparation cross-platform items — populated by agents; empty until real work is staged.
export const prep = [];

// Paid campaigns — none pre-launch (policy). Real campaigns appear here once launched.
export const campaigns = [
  { name: "Meta Ads — حملة وعي", meta: "مخطط · بعد الإطلاق · إنستغرام + فيسبوك", st: ["مخطط", "p-idle"] },
  { name: "Meta Ads — تحويل (Leads)", meta: "مخطط · يعتمد على بيكسل + جمهور مخصص", st: ["مخطط", "p-idle"] }
];

// Published posts come live from the Meta Graph API (see server /api/state). No mock entries.
export const published = [];

export const accounts = [
  { ch: "IG", h: "@matjarlink", s: "متصل · 558 متابعًا · نشط", st: ["متصل", "p-ok"] },
  { ch: "FB", h: "MatjarLink", s: "صفحة مرتبطة عبر Business Suite", st: ["متصل", "p-ok"] },
  { ch: "TH", h: "@matjarlink", s: "Threads مرتبط بالحساب", st: ["متصل", "p-ok"] },
  { ch: "WA", h: "WhatsApp Business", s: "يحتاج تفعيل API لبدء الردود", st: ["معلّق", "p-warn"] },
  { ch: "TT", h: "TikTok", s: "مخطط بعد الإطلاق", st: ["مخطط", "p-idle"] },
  { ch: "LI", h: "LinkedIn", s: "مخطط للمحتوى B2B", st: ["مخطط", "p-idle"] }
];

// Comments & messages come live from the Meta Graph API once the Community
// (comments/DM) permission is granted. No mock/sample content.
export const sampleComments = [];
export const sampleMessages = [];

// KPIs are computed live from real state in server.js (/api/state). Empty fallback.
export const kpis = [];

// Leads (mini-CRM) — populated from real WhatsApp/DM conversations. No mock leads.
export const leads = [];

export function baseState() {
  return {
    mode: "mock", generatedAt: null,
    agents, needs, queue, prep, campaigns, published, accounts, kpis, leads,
    comments: sampleComments, messages: sampleMessages,
    insights: null,
    connectivity: { meta: false, whatsapp: false, windsor: false }
  };
}
