/* Public pages for people who find Тезкор on the internet:
   /download    — one page: Android APK, iPhone (add to home screen), open in the browser, Telegram bot
   /robots.txt, /sitemap.xml — for Google / Yandex
   headTags()   — title, description, share picture (Open Graph), structured data, injected into the app page */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TITLE = "Тезкор — расонидани таом ва мол";
const DESC = "Тезкор (Tezkor) — фармоиши таом ва мол бо расонидан то дари хона, эълонҳо ва хизматҳо. Палав, шашлик, пицца, бургер ва ширинӣ. Барномаи Android ва сайт.";
const KEYWORDS = "Тезкор, Tezkor, tezkor tj, расонидани таом, доставка еды, доставка товаров, объявления, фармоиши таом, ошхона, доставка";

/* the address people see: PUBLIC_URL, Render's own address, or the host the request came to */
function baseUrl(req) {
  const env = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  return proto + "://" + (req.headers["x-forwarded-host"] || req.headers.host || "localhost");
}

function headTags(base) {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Тезкор", alternateName: ["Tezkor", "Tezkor TJ"], url: base + "/", inLanguage: ["tg", "ru"] },
      { "@type": "Organization", name: "Тезкор", alternateName: "Tezkor", url: base + "/", logo: base + "/icons/icon-512.png",
        areaServed: { "@type": "Country", name: "Тоҷикистон" } },
      { "@type": "MobileApplication", name: "Тезкор", operatingSystem: "Android", applicationCategory: "LifestyleApplication",
        downloadUrl: base + "/tezkor.apk", offers: { "@type": "Offer", price: "0", priceCurrency: "TJS" } },
    ],
  };
  /* ownership checks for Google Search Console / Yandex Webmaster / Bing: paste only the code from their "HTML tag" option */
  const code = v => String(v || "").replace(/.*content=["']?([^"'\s>]+).*/s, "$1").trim();
  const owners = [["google-site-verification", process.env.GOOGLE_SITE_VERIFICATION], ["yandex-verification", process.env.YANDEX_VERIFICATION], ["msvalidate.01", process.env.BING_VERIFICATION]]
    .filter(x => code(x[1])).map(x => `<meta name="${x[0]}" content="${esc(code(x[1]))}">`).join("");
  return `${owners}
<meta name="keywords" content="${esc(KEYWORDS)}">
<link rel="canonical" href="${esc(base)}/">
<meta property="og:type" content="website"><meta property="og:site_name" content="Тезкор">
<meta property="og:title" content="${esc(TITLE)}"><meta property="og:description" content="${esc(DESC)}">
<meta property="og:url" content="${esc(base)}/"><meta property="og:image" content="${esc(base)}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="tg_TJ"><meta property="og:locale:alternate" content="ru_RU">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(base)}/og.png">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
}

/* what a search engine (or a phone without JavaScript) reads on the main page */
function noscript(base) {
  return `<noscript><div style="max-width:640px;margin:40px auto;padding:0 16px;font-family:sans-serif">
<h1>${esc(TITLE)}</h1><p>${esc(DESC)}</p>
<p><a href="${esc(base)}/download">Барномаи Тезкорро боргирӣ кунед</a> · <a href="${esc(base)}/">Фармоиш додан</a></p></div></noscript>`;
}

function robots(base) { return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /webhooks/\nDisallow: /t/\nSitemap: ${base}/sitemap.xml\n`; }
function sitemap(base) {
  const d = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [["/", "1.0"], ["/download", "0.9"]].map(([p, pr]) => `  <url><loc>${base}${p}</loc><lastmod>${d}</lastmod><priority>${pr}</priority></url>`).join("\n") + "\n</urlset>\n";
}

/* /download: a plain, fast page — works on any phone and is easy for search engines to read */
function downloadPage(base, o) {
  const bot = o.botName ? `https://t.me/${o.botName}` : null;
  return `<!doctype html><html lang="tg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Барномаи Тезкор — боргирӣ барои Android ва iPhone</title>
<meta name="description" content="Барномаи Тезкорро ройгон боргирӣ кунед: фармоиши таом ва мол бо расонидан то дари хона. Android (APK) ва iPhone.">
<meta name="theme-color" content="#E8590C"><link rel="icon" href="/icons/icon-192.png"><link rel="canonical" href="${esc(base)}/download">
<meta property="og:title" content="Барномаи Тезкор"><meta property="og:description" content="${esc(DESC)}"><meta property="og:image" content="${esc(base)}/og.png"><meta property="og:url" content="${esc(base)}/download">
<style>
:root{--o:#E8590C;--ink:#1F1A17;--mut:#6B625C;--bg:#F4F1EC;--card:#fff;--line:#E7E1D8}
*{box-sizing:border-box}body{margin:0;font-family:Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
.hero{background:var(--o);color:#fff;padding:36px 20px 64px;text-align:center}
.logo{width:96px;height:96px;border-radius:26px;box-shadow:0 12px 30px rgba(0,0,0,.25);background:#fff}
h1{font-size:30px;margin:16px 0 6px;letter-spacing:-.5px}.hero p{margin:0 auto;max-width:440px;opacity:.92;font-size:16px;line-height:1.45}
.wrap{max-width:520px;margin:-40px auto 40px;padding:0 16px;display:grid;gap:14px}
.card{background:var(--card);border-radius:22px;padding:18px;box-shadow:0 8px 24px rgba(31,26,23,.08)}
.card h2{font-size:18px;margin:0 0 4px;display:flex;align-items:center;gap:10px}.card p{margin:6px 0 0;color:var(--mut);font-size:14.5px;line-height:1.45}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:54px;border-radius:16px;font-weight:800;font-size:17px;text-decoration:none;margin-top:14px;border:0;width:100%;cursor:pointer}
.b1{background:var(--o);color:#fff;box-shadow:0 10px 24px -8px rgba(232,89,12,.6)}.b2{background:var(--ink);color:#fff}.b3{background:#229ED9;color:#fff}.b4{background:#fff;color:var(--ink);border:1.5px solid var(--line)}
ol{margin:10px 0 0;padding-left:20px;color:var(--mut);font-size:14.5px;line-height:1.6}
.tag{font-size:12px;font-weight:700;background:#FDE7DA;color:#B4430A;padding:3px 9px;border-radius:99px}
.hide{display:none}.foot{text-align:center;color:var(--mut);font-size:13px;margin:10px 0 30px}
</style></head><body>
<header class="hero"><img class="logo" src="/icons/icon-192.png" alt="Тезкор" width="96" height="96">
<h1>Тезкор</h1><p>Таом ва мол — то дари хона. Як бор насб кунед, баъд бо як пахш фармоиш диҳед.</p></header>
<main class="wrap">
${o.apk ? `<section class="card" id="android"><h2>🤖 Android <span class="tag">тавсия</span></h2><p>Барнома бе Play Market, ройгон. Худаш нав мешавад — дубора боргирӣ лозим нест.</p>
<a class="btn b1" href="/tezkor.apk" download="tezkor.apk">⬇ Боргирии барнома (APK)</a>
<ol><li>Файли <b>tezkor.apk</b> боргирӣ мешавад — онро кушоед.</li><li>Агар телефон пурсад: «Иҷозат аз ин манбаъ» — фаъол кунед.</li><li>«Насб кардан»-ро пахш кунед ва Тезкорро кушоед.</li></ol></section>` : ""}
<section class="card" id="ios"><h2>🍎 iPhone</h2><p>Дар iPhone барнома аз Safari ба экран гузошта мешавад:</p>
<ol><li>Ин саҳифаро дар <b>Safari</b> кушоед.</li><li>Тугмаи <b>«Мубодила»</b> (□↑)-ро пахш кунед.</li><li><b>«Ба экрани хона»</b> (Add to Home Screen) → «Илова».</li></ol>
<a class="btn b4" href="/">Кушодани Тезкор</a></section>
<section class="card" id="web"><h2>🌐 Дар браузер</h2><p>Бе насб — рост аз браузер фармоиш диҳед. ${o.apk ? "" : "Дар Android: менюи браузер (⋮) → «Насб кардан» ё «Ба экрани асосӣ»."}</p>
<a class="btn b2" href="/">Фармоиш додан</a></section>
${bot ? `<section class="card" id="tg"><h2>✈️ Telegram</h2><p>Боти мо: тасдиқи рақам ва кушодани Тезкор рост аз Telegram.</p><a class="btn b3" href="${esc(bot)}" rel="noopener">@${esc(o.botName)}</a></section>` : ""}
</main>
<p class="foot">Тезкор · <a href="/" style="color:inherit">${esc(base.replace(/^https?:\/\//, ""))}</a></p>
<script>/* on an iPhone show the iPhone way first; on Android the APK */
(function(){var ua=navigator.userAgent,ios=/iphone|ipad|ipod/i.test(ua),w=document.querySelector(".wrap"),i=document.getElementById("ios"),a=document.getElementById("android");
if(ios){if(a)a.classList.add("hide");w.insertBefore(i,w.firstChild);}else if(/android/i.test(ua)&&a){w.insertBefore(a,w.firstChild);}})();</script>
</body></html>`;
}


/* Privacy policy and account deletion — public pages Google Play asks for */
function legalPage(title, body) {
  return "<!doctype html><html lang=ru><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>" + title + " — Тезкор</title>" +
    "<style>body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#F4F1EC;color:#1B1F1D}main{max-width:760px;margin:0 auto;padding:24px 18px 60px}h1{font-size:26px;margin:8px 0 4px}h2{font-size:19px;margin:26px 0 6px}a{color:#C2410C}.card{background:#fff;border-radius:18px;padding:20px 22px;box-shadow:0 2px 12px rgba(0,0,0,.05)}small{color:#68736E}</style>" +
    "<main><p><a href='/'>← Тезкор</a></p><div class=card>" + body + "</div></main></html>";
}
function privacyPage(base, o) { var phone = (o && o.phone) || "", upd = "27.10.2026";
  return legalPage("Политика конфиденциальности", "<h1>Политика конфиденциальности</h1><small>Тезкор · " + base + " · обновлено " + upd + "</small>" +
    "<p>Тезкор — сервис заказа и доставки товаров из магазинов, объявлений и услуг мастеров. Здесь сказано, какие данные мы получаем, зачем и как вы можете их удалить.</p>" +
    "<h2>Какие данные мы собираем</h2><ul><li><b>Аккаунт:</b> имя, номер телефона, пароль (хранится только в зашифрованном виде).</li><li><b>Адрес доставки:</b> текст адреса, ориентир и точка на карте, которую вы указываете при заказе.</li>" +
    "<li><b>Местоположение:</b> только когда вы нажимаете «Где я», чтобы поставить метку доставки; у курьеров — во время выполнения заказа, чтобы клиент видел, где курьер.</li><li><b>Заказы и платежи:</b> состав заказа, суммы, способ оплаты, фото чека перевода, если вы его загружаете. Данные банковских карт мы не получаем и не храним.</li>" +
    "<li><b>Объявления и фото</b>, которые вы публикуете сами.</li><li><b>Технические данные:</b> токен для push-уведомлений о заказе.</li></ul>" +
    "<h2>Зачем</h2><p>Чтобы принять и доставить заказ, связать вас с магазином и курьером, показать объявления и сообщить о статусе заказа. Мы не продаём данные и не используем их для рекламы третьих лиц.</p>" +
    "<h2>Кто видит данные</h2><p>Магазин и курьер видят ваше имя, телефон и адрес только по своему заказу. Карты показываются через OpenStreetMap и Esri — им передаются только координаты области карты. Данные хранятся на защищённых серверах (Render, Neon), передача — только по HTTPS.</p>" +
    "<h2>Сколько храним</h2><p>Пока у вас есть аккаунт. После удаления аккаунта имя, номер, адреса и избранное удаляются; прошлые заказы остаются в бухгалтерском учёте магазина без ваших личных данных.</p>" +
    "<h2>Удаление аккаунта</h2><p>В приложении: <b>Профиль → Удалить аккаунт</b>. Или по инструкции: <a href='/delete-account'>" + base + "/delete-account</a>.</p>" +
    "<h2>Дети</h2><p>Сервис не предназначен для детей младше 13 лет.</p>" +
    "<h2>Связь</h2><p>Вопросы о данных: " + (phone ? "<b>" + phone + "</b>" : "служба поддержки в приложении") + ".</p>");
}
function deletePage(base, o) { var phone = (o && o.phone) || "";
  return legalPage("Удаление аккаунта", "<h1>Удаление аккаунта Тезкор</h1>" +
    "<h2>В приложении (сразу)</h2><ol><li>Откройте Тезкор и войдите.</li><li>Перейдите в <b>Профиль</b>.</li><li>Внизу нажмите <b>«Удалить аккаунт»</b> и введите пароль.</li></ol>" +
    "<h2>Без приложения</h2><p>Позвоните или напишите в поддержку" + (phone ? ": <b>" + phone + "</b>" : "") + " с того номера, на который зарегистрирован аккаунт — удалим в течение 7 дней.</p>" +
    "<h2>Что удаляется</h2><p>Имя, номер телефона, пароль, адреса, избранное, push-токены. Прошлые заказы остаются в учёте магазина без личных данных (требование учёта).</p><p><a href='/privacy'>Политика конфиденциальности</a></p>");
}
module.exports = { baseUrl, headTags, noscript, robots, sitemap, downloadPage, privacyPage, deletePage, TITLE, DESC };
