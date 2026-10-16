const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const _origClick = Symbol();
function quietAlarms(p) { const orig = p.click.bind(p); p.click = async (sel, o) => { await p.evaluate(() => { if (!window.SF) return; SF.alarmCheck = function () {}; const a = document.getElementById("alarm"); if (a) a.hidden = true; }).catch(() => {}); return orig(sel, o); }; return p; }
const path = require("path"), fs = require("fs");
const URL = process.env.URL || ("file://" + path.resolve(__dirname, "../dist/index.html"));
const S = path.resolve(__dirname, "../shots"); fs.mkdirSync(S, { recursive: true });
const errs = [];
(async () => {
  const b = await chromium.launch();
  const mk = async (w, h, mobile) => { const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 }); const p = await c.newPage(); await p.clock.setFixedTime(new Date("2026-10-16T08:00:00Z")); p.on("pageerror", e => errs.push("PAGEERROR " + e.message)); return p; };
  const page = quietAlarms(await mk(1280, 820, false));
  const step = async (n) => { await page.waitForTimeout(450); const t = await page.evaluate(() => document.querySelector("#toasts").innerText); console.log("•", n, "|", page.url().split("#")[1], "|", t.replace(/\s+/g, " ").slice(0, 120)); };
  const shot = async (p, n) => { await p.waitForTimeout(500); await p.screenshot({ path: S + "/" + n + ".png" }); };
  const login = async (phone) => { await page.evaluate(() => localStorage.removeItem("somon.token")); await page.goto("about:blank"); await page.goto(URL + "#/login"); await page.waitForTimeout(500); const ok = await page.$(`[data-act=demologin][data-phone="${phone}"]`); if (!ok) { console.log("NOLOGIN", page.url(), await page.evaluate(() => [localStorage.getItem("somon.token"), document.body.innerText.slice(0, 300)])); await page.screenshot({ path: S + "/fail.png" }); }
  await page.click(`[data-act=demologin][data-phone="${phone}"]`, { timeout: 3000 }); await step("login " + phone); };
  await page.goto(URL + "#/"); await page.evaluate(() => { localStorage.clear(); localStorage.setItem("somon.lang", '"ru"'); }); await page.reload(); await page.waitForTimeout(700);
  await shot(page, "d-home");
  await login("900000301");
  await page.evaluate(() => location.hash = "/r/r1"); await step("rest");
  await shot(page, "d-restaurant");
  const adds = await page.$$("[data-act=add]"); console.log("add buttons", adds.length);
  await adds[0].click(); await step("add1"); const adds2 = await page.$$("[data-act=add]"); await adds2[1].click(); await step("add2");
  await page.evaluate(() => location.hash = "/cart"); await step("cart"); await shot(page, "d-cart");
  await page.click("[data-act=tocheckout]"); await step("checkout");
  const pr = async () => (await page.textContent("#pinread")).trim();
  console.log("map mounted:", await page.evaluate(() => { const m = document.querySelector("[data-tmap=co]"); return !!m && m.querySelector(".tm-ov").childElementCount > 0 && !!m.querySelector(".tm-tiles").style.backgroundImage; }));
  console.log("pin start:", await pr());
  // far point (≈6.3 km north) → outside zone, order blocked
  await page.fill("#co-ll", "37.3195, 68.1385"); await page.click("form[data-form=coords] button"); await page.waitForTimeout(700);
  console.log("far:", await pr(), "| bad:", await page.$eval("#pinread", e => e.classList.contains("bad")));
  await page.click("[data-act=placeorder]"); await step("placeorder far (must stay)");
  // Yandex link inside zone
  await page.fill("#co-ll", "https://yandex.com/maps/?ll=68.1500%2C37.2700&z=17"); await page.click("form[data-form=coords] button"); await page.waitForTimeout(800);
  console.log("yandex:", await pr());
  // drag the map 120px left → pin moves east
  const box = await (await page.$("[data-tmap=co]")).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(900);
  console.log("dragged:", await pr(), "| co:", JSON.stringify(await page.evaluate(() => [SF.state.co.lat.toFixed(5), SF.state.co.lng.toFixed(5)])));
  await page.click(".tm-zoom [data-tz='1']"); await page.waitForTimeout(500);
  console.log("zoom:", await page.evaluate(() => SF.state.tmv.co.z));
  await step("addr");
  await page.fill('[data-input=co][data-k=text]', "кӯчаи Рӯдакӣ 45, хонаи 12").catch(()=>{});
  await page.click('[data-act=paym][data-v=card]'); await step("paym card"); await shot(page, "d-checkout"); console.log("fee line:", (await page.textContent(".sum")).replace(/\s+/g," ").slice(0,160));
  await page.click("[data-act=placeorder]"); await step("placeorder");
  await page.fill("[name=cardNumber]", "4242424242424242"); await page.fill("[name=exp]", "12/29"); await page.fill("[name=cvc]", "123");
  const nm = await page.$("[name=holder]"); if (nm) await nm.fill("TEST USER");
  await shot(page, "d-pay");
  await page.click("form[data-form=pay] button:not([type=button])"); await page.waitForTimeout(1500); await step("paid");
  const oid = page.url().split("/o/")[1]; console.log("order", oid);
  await shot(page, "d-track-pending");
  await login("900000101"); await page.evaluate(() => location.hash = "/rest/orders"); await step("rest orders"); await shot(page, "d-rest-orders");
  await page.click("[data-act=accept]"); await step("accept"); await page.click("[data-act=ready]"); await step("ready");
  await page.evaluate(() => location.hash = "/rest"); await step("rest dash"); await shot(page, "d-rest-dash");
  await page.evaluate(() => location.hash = "/rest/menu"); await step("menu"); await shot(page, "d-rest-menu");
  await login("900000201"); await page.evaluate(() => location.hash = "/courier"); await step("courier");
  if (await page.$(".chero:not(.on)")) { await page.click(".chero [data-act=online]"); await step("online"); }
  await shot(page, "d-courier-offers");
  const take = await page.$(`[data-act=take][data-id="${oid}"]`) || await page.$("[data-act=take]"); await take.click(); await step("take");
  await page.click("[data-act=pickup]"); await step("pickup"); await shot(page, "d-courier-active");
  console.log("nav:", await page.$$eval(".navbtns a", as => as.map(a => a.href)), await page.textContent("#coords-text"));
  await page.click("[data-act=deliver]"); await step("deliver");
  await login("900000301"); await page.evaluate(h => location.hash = "/o/" + h, oid); await step("track"); await shot(page, "d-track-done");
  const st = await page.$$("[data-act=star]"); console.log("stars", st.length); if (st.length) { await st[4].click(); await page.waitForTimeout(200); const st2 = await page.$$("[data-act=star]"); if (st2[9]) await st2[9].click(); await page.click("[data-act=sendreview]"); await step("review"); }
  await login("900000001"); await page.evaluate(() => location.hash = "/admin"); await step("admin"); await shot(page, "d-admin");
  await page.evaluate(() => location.hash = "/admin/orders"); await step("admin orders"); await shot(page, "d-admin-orders");
  // mobile
  const m = await mk(390, 844, true); await m.goto(URL + "#/"); await m.evaluate(() => { localStorage.clear(); localStorage.setItem("somon.lang", '"tg"'); }); await m.reload(); await m.waitForTimeout(800);
  await shot(m, "m-home"); await m.evaluate(() => location.hash = "/r/r2"); await shot(m, "m-restaurant");
  await m.evaluate(() => location.hash = "/login"); await m.waitForTimeout(400); await m.click('[data-act=demologin][data-phone="900000201"]'); await m.waitForTimeout(600); await shot(m, "m-courier");
  await m.evaluate(() => { localStorage.setItem("somon.lang", '"en"'); location.hash = "/login"; localStorage.removeItem("somon.token"); }); await m.reload(); await m.waitForTimeout(600); await shot(m, "m-login");
  console.log(errs.length ? errs.join("\n") : "NO PAGE ERRORS"); await b.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
