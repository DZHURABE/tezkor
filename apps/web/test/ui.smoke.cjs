const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "../dist/index.html");
const shots = path.resolve(__dirname, "../shots"); require("fs").mkdirSync(shots, { recursive: true });
const ROUTES = {
  guest: ["/", "/search?q=%D0%BF%D0%BB%D0%BE%D0%B2", "/r/r1", "/login", "/register"],
  "900000301": ["/", "/r/r1", "/r/r2", "/cart", "/orders", "/profile", "/search?q=pizza"],
  "900000101": ["/rest", "/rest/orders", "/rest/menu", "/rest/history", "/rest/settings"],
  "900000201": ["/courier", "/courier/earnings", "/courier/history", "/courier/profile"],
  "900000001": ["/admin", "/admin/orders", "/admin/restaurants", "/admin/couriers", "/admin/users", "/admin/products", "/admin/categories", "/admin/payments", "/admin/promos", "/admin/banners", "/admin/cities", "/admin/stats", "/admin/settings"],
};
const problems = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  const page = await ctx.newPage(); await page.clock.setFixedTime(new Date("2026-10-16T08:00:00Z"));
  let cur = "";
  page.on("pageerror", e => problems.push(cur + " PAGEERROR " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text())) problems.push(cur + " CONSOLE " + m.text()); });
  const go = async (r) => { cur = r; await page.evaluate(h => { location.hash = h; }, r); await page.waitForTimeout(350); };
  const check = async (tag) => {
    const txt = await page.evaluate(() => document.body.innerText);
    const html = await page.evaluate(() => document.body.innerHTML);
    for (const m of (txt.match(/⟦[^⟧]*⟧/g) || [])) problems.push(tag + " MISSING " + m);
    if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(txt)) problems.push(tag + " BADTEXT " + (txt.match(/.{0,40}(undefined|NaN|\[object Object\]).{0,20}/) || [])[0]);
    if (/>\s*(undefined|NaN)\s*</.test(html)) problems.push(tag + " BADHTML");
  };
  await page.goto(URL); await page.waitForTimeout(600);
  for (const lang of ["tg", "ru", "en"]) {
    for (const who of Object.keys(ROUTES)) {
      await page.evaluate(() => { localStorage.removeItem("somon.token"); });
      await page.evaluate(l => localStorage.setItem("somon.lang", JSON.stringify(l)), lang);
      await page.goto(URL + "#/"); await page.reload(); await page.waitForTimeout(500);
      if (who !== "guest") {
        await go("/login");
        await page.click(`[data-act=demologin][data-phone="${who}"]`); await page.waitForTimeout(500);
      }
      for (const r of ROUTES[who]) { await go(r); await check(`[${lang}/${who}${r}]`); }
      // open modals that exist
      if (who === "900000001") { await go("/admin/orders"); const b1 = await page.$("[data-act=aorder]"); if (b1) { await b1.click(); await page.waitForTimeout(200); await check(`[${lang}/admin order modal]`); await page.evaluate(() => SF.closeModal()); } }
      if (who === "900000101") { await go("/rest/menu"); const b1 = await page.$("[data-act=prodedit]"); if (b1) { await b1.click(); await page.waitForTimeout(200); await check(`[${lang}/menu modal]`); await page.evaluate(() => SF.closeModal()); } }
      if (who === "900000301") { await go("/r/r1"); const b1 = await page.$("[data-act=prod]"); if (b1) { await b1.click(); await page.waitForTimeout(250); await check(`[${lang}/prod sheet]`); await page.evaluate(() => SF.closeModal()); } }
    }
    await page.evaluate(() => SF.actions.notes && 0);
  }
  console.log(problems.length ? problems.join("\n") : "NO PROBLEMS");
  await b.close();
})();
