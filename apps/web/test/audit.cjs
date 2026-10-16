/* Full audit on phones (360 and 390 px wide) and desktop: every page of every role, three languages.
   Reports: page errors, console errors, missing translations, "undefined/NaN" text, horizontal overflow,
   elements sticking out of the screen, buttons without a name, broken images. */
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const path = require("path"), fs = require("fs");
const URL = "file://" + path.resolve(__dirname, "../dist/index.html");
const SHOTS = path.resolve(__dirname, "../shots/audit"); fs.mkdirSync(SHOTS, { recursive: true });
const ROUTES = {
  guest: ["/", "/search?q=%D0%BF%D0%BB%D0%BE%D0%B2", "/r/r1", "/r/r3", "/login", "/register", "/cart"],
  "900000301": ["/", "/r/r1", "/r/r2", "/cart", "/checkout", "/orders", "/profile", "/search?q=pizza"],
  "900000101": ["/rest", "/rest/orders", "/rest/menu", "/rest/promo", "/rest/couriers", "/rest/history", "/rest/settings"],
  "900000201": ["/courier", "/courier/earnings", "/courier/history", "/courier/profile"],
  "900000001": ["/admin", "/admin/orders", "/admin/restaurants", "/admin/couriers", "/admin/users", "/admin/products", "/admin/categories", "/admin/payments", "/admin/promos", "/admin/banners", "/admin/cities", "/admin/stats", "/admin/settings"],
};
const MODALS = {
  guest: [["/login", "[data-act=forgot]"]],
  "900000301": [["/r/r1", "[data-act=prod]"]],
  "900000101": [["/rest/menu", "[data-act=prodnew]"], ["/rest/menu", "[data-act=prodedit]"], ["/rest/couriers", "[data-act=ocnew]"]],
  "900000001": [["/admin/orders", "[data-act=aorder]"], ["/admin/restaurants", "[data-act=arestnew]"], ["/admin/restaurants", "[data-act=asub]"], ["/admin/couriers", "[data-act=acournew]"]],
};
const only = process.argv[2];
const problems = new Set();
(async () => {
  const b = await chromium.launch();
  const W = { 360: [360, 740, true], 390: [390, 844, true], 1280: [1280, 860, false] };
  const sizes = process.env.W ? [W[process.env.W]] : only ? [W[390]] : [W[360], W[390], W[1280]];
  for (const [w, h, mobile] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    const page = await ctx.newPage(); await page.clock.setFixedTime(new Date("2026-10-16T08:00:00Z"));
    let cur = "";
    page.on("pageerror", e => problems.add(cur + " PAGEERROR " + e.message));
    page.on("console", m => { if (m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text())) problems.add(cur + " CONSOLE " + m.text()); });
    const quiet = () => page.evaluate(() => { if (window.SF) { SF.alarmCheck = function () {}; const a = document.getElementById("alarm"); if (a) { a.hidden = true; a.innerHTML = ""; } } });
    const go = async (r) => { cur = `[${w}/${r}]`; await page.evaluate(x => { location.hash = x; }, r); await page.waitForTimeout(450); await quiet(); };
    const check = async (tag) => {
      const res = await page.evaluate(() => {
        const out = [], vw = document.documentElement.clientWidth, txt = document.body.innerText;
        (txt.match(/⟦[^⟧]*⟧/g) || []).forEach(m => out.push("MISSING " + m));
        const bad = txt.match(/.{0,30}\b(undefined|NaN|null)\b.{0,20}|\[object Object\]/); if (bad) out.push("BADTEXT " + bad[0].replace(/\s+/g, " "));
        if (document.documentElement.scrollWidth > vw + 1) out.push("HSCROLL page " + document.documentElement.scrollWidth + ">" + vw);
        const scope = document.getElementById("modal").hidden ? document.getElementById("app") : document.getElementById("modal");
        scope.querySelectorAll("button,a,input,select,h1,h2,h3,b,p,.btn,.chip,.pill,img,textarea,label").forEach(el => {
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
          const st = getComputedStyle(el); if (st.visibility === "hidden" || st.position === "fixed") return;
          if (el.closest(".side") && !document.querySelector(".panel.open")) return;
          let p = el.parentElement, clipped = false; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 2) { clipped = true; break; } if (s.overflowX === "hidden") { const pr = p.getBoundingClientRect(); if (r.left >= pr.right - 2 || r.right <= pr.left + 2) { out.push("HIDDEN " + el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0] + " «" + (el.innerText || "").trim().slice(0, 25) + "»"); return; } } p = p.parentElement; }
          if (!clipped && (r.right > vw + 2 || r.left < -2)) out.push("OUTSIDE " + el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0] + " «" + (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().slice(0, 30) + "» " + Math.round(r.left) + ".." + Math.round(r.right));
          if (el.tagName === "BUTTON" || (el.tagName === "A" && el.getAttribute("href"))) { const name = (el.innerText || el.getAttribute("aria-label") || el.title || "").trim(); if (!name) out.push("NONAME " + el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0] + " " + (el.dataset.act || el.getAttribute("href") || "")); }
          if (el.tagName === "IMG" && el.complete && !el.naturalWidth) out.push("BROKENIMG " + el.src.slice(0, 60));
          if (["BUTTON", "A", "INPUT", "SELECT"].includes(el.tagName) && !/checkbox|radio|file|hidden/.test(el.type || "") && el.offsetParent && r.height < 24 && r.width < 24 && !el.closest(".tm,.tmap,.ic-prep")) out.push("TINY " + el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0] + " " + Math.round(r.width) + "x" + Math.round(r.height));
          if (el.scrollWidth > el.clientWidth + 2 && /^(BUTTON|B|H1|H2|H3)$/.test(el.tagName) && getComputedStyle(el).overflow === "visible" && el.clientWidth > 0) out.push("TEXTOVER " + el.tagName.toLowerCase() + " «" + el.innerText.trim().slice(0, 30) + "»");
        });
        return out;
      });
      res.forEach(x => problems.add(tag + " " + x));
    };
    await page.goto(URL); await page.waitForTimeout(500);
    for (const lang of (only ? [only] : ["tg", "ru", "en"])) {
      for (const who of Object.keys(ROUTES)) {
        await page.evaluate(l => { localStorage.removeItem("somon.token"); localStorage.setItem("somon.lang", JSON.stringify(l)); }, lang);
        await page.goto(URL + "#/"); await page.reload(); await page.waitForTimeout(500);
        if (who !== "guest") { await go("/login"); await page.click(`[data-act=demologin][data-phone="${who}"]`); await page.waitForTimeout(600); await quiet(); }
        if (who === "900000301") await page.evaluate(() => { SF.cart.clear && SF.cart.clear(); });
        for (const r of ROUTES[who]) {
          if (r === "/checkout" && who === "900000301") { await go("/r/r1"); for (let i = 0; i < 3; i++) { await page.locator("[data-act=add]").nth(i).click(); await page.waitForTimeout(250); } }
          await go(r); await check(`[${lang}/${w}/${who}${r}]`);
          if (lang === "tg" && w === 390) await page.screenshot({ path: `${SHOTS}/${who}${r.replace(/[\/?=%]/g, "_")}.png`, fullPage: true });
        }
        for (const [r, sel] of (MODALS[who] || [])) { await go(r); const el = await page.$(sel); if (!el) { problems.add(`[${lang}/${w}] no ${sel} on ${r}`); continue; } await el.click(); await page.waitForTimeout(500); await check(`[${lang}/${w}/${who} modal ${sel}]`);
          if (lang === "tg" && w === 390) await page.screenshot({ path: `${SHOTS}/modal_${who}_${sel.replace(/\W/g, "")}.png` });
          await page.evaluate(() => SF.closeModal()); }
      }
    }
    await ctx.close();
  }
  const list = [...problems];
  console.log(list.length ? list.join("\n") + "\n" + list.length + " problems" : "NO PROBLEMS");
  await b.close();
})();
