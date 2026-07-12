# MatjarLink Ops Platform — لوحة إدارة الفريق الحيّة

منصّة تشغيل ديناميكية لفريق الذكاء الاصطناعي: الوكلاء وتقييمهم، قائمة النشر
والمراجعة، التعليقات والرسائل عبر المنصات مع الرد، والأداء — تعمل **حيّة** عند ربط
المفاتيح، وتعمل فورًا بوضع **تجريبي** بدونها.

```
ops_platform/
├─ server.js              خادم Express: يقدّم اللوحة + /api/state + /api/reply + webhook واتساب
├─ data/seed.js           الحالة الأساسية (وكلاء، قائمة نشر، حسابات…) + عيّنات
├─ integrations/
│  ├─ meta.js             Graph API: تعليقات، رسائل، منشورات، ردود (IG + FB)
│  ├─ windsor.js          Windsor.ai: بيانات الأداء
│  └─ whatsapp.js         WhatsApp Cloud API: استقبال (webhook) + إرسال
├─ public/index.html      اللوحة الديناميكية (تسحب /api/state)
├─ .env.example           كل المفاتيح المطلوبة
├─ render.yaml / Dockerfile   إعدادات النشر
└─ package.json
```

## تشغيل محلي (دقيقتان)
```bash
cd ops_platform
npm install
cp .env.example .env      # يعمل فورًا بوضع mock
npm start                 # → http://localhost:8080
```

## جعلها حيّة أونلاين برابط مخصّص — 3 خطوات بيدك أنت
> هذه الخطوات تتطلب حساباتك ومفاتيحك السرّية؛ لا يمكن لأي أداة تنفيذها نيابةً عنك.

### 1) تطبيق Meta (تعليقات + رسائل + منشورات IG/FB)
1. [developers.facebook.com](https://developers.facebook.com) → Create App → نوع «Business».
2. أضِف منتجات: **Instagram Graph API** و **Messenger**.
3. اربط صفحة فيسبوك `MatjarLink` وحساب إنستغرام `@matjarlink`.
4. الصلاحيات المطلوبة: `instagram_basic`, `instagram_manage_comments`,
   `instagram_manage_messages`, `pages_messaging`, `pages_read_engagement`,
   `pages_manage_metadata`, `pages_show_list`.
5. استخرج **Page Access Token طويل الأمد** → ضعه في `META_ACCESS_TOKEN`.
   (المعرّفات جاهزة في `.env.example`: IG=17841449202353128، Page=1247632705095985.)
6. للنشر العام (خارج وضع التطوير) يلزم **App Review** على تلك الصلاحيات — عدّة أيام.

### 2) Windsor.ai (الأداء)
[windsor.ai](https://windsor.ai) → اربط Instagram/Facebook → API → انسخ المفتاح إلى `WINDSOR_API_KEY`.

### 3) WhatsApp Cloud API (اختياري لكن مهم)
Meta app → WhatsApp → أضف رقم 97426620 → انسخ `WHATSAPP_TOKEN` و`WHATSAPP_PHONE_ID`.
اضبط Webhook على `https://<your-url>/webhook/whatsapp` بـ verify token المذكور.

### النشر (رابط مخصّص من أي مكان)
**الأسرع — Render (مجاني):**
1. ارفع مجلد `ops_platform` إلى مستودع GitHub.
2. [render.com](https://render.com) → New → **Blueprint** → اختر المستودع → Apply
   (يقرأ `render.yaml` تلقائيًا).
3. في Render → Environment → الصق مفاتيحك، وحوّل `MODE=live`.
4. تحصل على رابط دائم مثل `https://matjarlink-ops.onrender.com` يُفتح من أي جهاز.

**بدائل:** Railway / Fly.io (نفس المبدأ)، أو أي VPS عبر `Dockerfile`.

## كيف تتحوّل حيّة
- `MODE=mock` → عيّنات (يعمل بلا مفاتيح).
- `MODE=live` → `/api/state` يستدعي `meta.getComments/getMessages/getPublished`
  و`windsor.getInsights` ويدمج واتساب. كل مصدر بلا مفتاح يبقى بعيّنته دون أن يكسر البقية.
- الرد: `/api/reply` يوجّه إلى `replyToComment` / `sendMessage` / واتساب حسب القناة.

## أمان
- كلمة مرور اللوحة: `DASHBOARD_PASSWORD` (Basic auth).
- المفاتيح تبقى في الخادم فقط (env)، لا تصل المتصفح إطلاقًا.
- لا تضع `.env` في Git (مستثنى في `.gitignore`).

> المعرّفات مأخوذة من حساب متجرلينك الفعلي. القيم السرّية فقط هي المتبقية عليك.
