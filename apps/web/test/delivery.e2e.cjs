/* own delivery on a phone: admin switches the mode, restaurant adds its courier, orders ring only there, self-delivery */
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const path = require("path"), fs = require("fs");
const URL = "file://" + path.resolve(__dirname, "../dist/index.html");
const S = path.resolve(__dirname, "../shots"); fs.mkdirSync(S, { recursive: true });
const errs = [];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await c.newPage(); p.on("pageerror", e => errs.push(e.message));
  const wait = (ms) => p.waitForTimeout(ms || 500);
  const quiet = () => p.evaluate(() => { if (window.SF) { SF.alarmCheck = function () {}; document.querySelectorAll(".alarm").forEach(a => a.remove()); } });
  const toast = () => p.evaluate(() => document.querySelector("#toasts").innerText.trim().split("\n").pop());
  const clearT = () => p.evaluate(() => { document.getElementById("toasts").innerHTML = ""; });
  const shot = async (n, full) => { await wait(400); await clearT(); await p.screenshot({ path: S + "/" + n + ".png", fullPage: !!full }); };
  const go = async (h) => { await p.evaluate((h) => location.hash = h, h); await wait(800); await quiet(); };
  const loginPw = async (phone, pw) => { await p.evaluate(() => window.SF && SF.state.user && SF.actions.logout()); await wait(300); await go("/login");
    if (pw) { await p.fill("form[data-form=login] [name=phone]", phone); await p.fill("form[data-form=login] [name=password]", pw); await p.click("form[data-form=login] button.primary"); }
    else await p.click(`[data-act=demologin][data-phone="${phone}"]`);
    await wait(900); await quiet(); };
  const api = (m, u, body) => p.evaluate(([m, u, body]) => SF.api[m](u, body).then(x => x, e => ({ err: e.code || String(e) })), [m, u, body]);
  await p.goto(URL + "#/"); await p.evaluate(() => { localStorage.clear(); localStorage.setItem("somon.lang", '"tg"'); }); await p.reload(); await wait(800);
  // admin: r1 → own couriers
  await loginPw("900000001"); await go("/admin/restaurants");
  await p.selectOption('select[data-input=adeliv][data-id="r1"]', "own"); await wait(600); console.log("admin:", await toast());
  await p.evaluate(() => document.querySelector('select[data-id="r1"]').scrollIntoView({ block: "center" })); await shot("d-admin");
  // restaurant adds its courier
  await loginPw("900000101"); await go("/rest/couriers"); await shot("d-rest-empty");
  await p.click("[data-act=ocnew]"); await wait(); await p.fill("form[data-form=ocnew] [name=name]", "Алишер"); await p.fill("form[data-form=ocnew] [name=phone]", "935551100");
  await p.click("form[data-form=ocnew] button.primary"); await wait(800);
  const pw = await p.evaluate(() => document.querySelectorAll(".creds code")[1].innerText); console.log("courier password:", pw); await shot("d-creds");
  await p.click("[data-act=closemodal]"); await wait();
  // own courier goes online
  await loginPw("935551100", pw); console.log("own courier home:", p.url().split("#")[1], "| badge:", await p.evaluate(() => (document.querySelector(".ownbadge") || {}).innerText));
  await api("patch", "/courier/me", { online: true });
  // customer orders twice
  await loginPw("900000301");
  const addr = { text: "кӯчаи Ленин 5", lat: 37.268, lng: 68.145 };
  const o1 = await api("post", "/orders", { restaurantId: "r1", items: [{ productId: "r1p1", qty: 1 }], address: addr, paymentMethod: "cash" });
  const o2 = await api("post", "/orders", { restaurantId: "r1", items: [{ productId: "r1p2", qty: 2 }], address: addr, paymentMethod: "cash" });
  console.log("orders:", o1.number, o1.delivery, o2.number);
  // restaurant accepts both
  await loginPw("900000101");
  await api("post", "/restaurant/orders/" + o1.id + "/accept", { prepMin: 15 }); await api("post", "/restaurant/orders/" + o2.id + "/accept", { prepMin: 15 });
  await go("/rest/orders"); await shot("d-rest-orders", true);
  // Tezkor courier sees nothing
  await loginPw("900000201"); await api("patch", "/courier/me", { online: true });
  const av = await api("get", "/courier/orders/available"); console.log("Тезкор courier sees:", av.filter(o => o.id === o1.id || o.id === o2.id).length);
  // own courier sees both, takes o1
  await loginPw("935551100", pw); await go("/courier"); await shot("d-own-courier");
  const av2 = await api("get", "/courier/orders/available"); console.log("own courier sees:", av2.map(o => o.number).join(","));
  await api("post", "/courier/orders/" + o1.id + "/accept", {});
  // restaurant sends o2 itself
  await loginPw("900000101"); await go("/rest/orders");
  await p.click(`[data-act=selfout][data-id="${o2.id}"]`); await wait(700); await shot("d-selfout");
  await p.fill("#so-n", "Акаи Шер"); await p.fill("#so-p", "935559988"); await p.click("form[data-form=selfout] button.primary"); await wait(800); console.log("self out:", await toast());
  // customer sees it
  await loginPw("900000301"); await go("/o/" + o2.id);
  console.log("customer o2:", await p.evaluate(() => (document.querySelector(".courier2") || {}).innerText.replace(/\s+/g, " ")));
  await p.evaluate(() => document.querySelector(".courier2").scrollIntoView({ block: "center" })); await shot("d-customer");
  await loginPw("900000101"); await go("/rest/orders"); await p.click(`[data-act=selfdone][data-id="${o2.id}"]`); await wait(700); console.log("delivered:", await toast());
  console.log(errs.length ? "PAGE ERRORS: " + errs.join(" | ") : "NO PAGE ERRORS");
  await b.close();
})();
