/* the restaurant owner advertises himself: dish photo + discount, cover, home-page ad → the customer sees it (phone screen) */
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const path = require("path"), fs = require("fs");
const URL = process.env.URL || ("file://" + path.resolve(__dirname, "../dist/index.html"));
const S = path.resolve(__dirname, "../shots"); fs.mkdirSync(S, { recursive: true });
const IMG1 = process.env.IMG1, IMG2 = process.env.IMG2;
const errs = [];
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await c.newPage(); p.on("pageerror", e => errs.push(e.message));
  const quiet = () => p.evaluate(() => { if (window.SF) { SF.alarmCheck = function () {}; const a = document.querySelector(".alarm"); if (a) a.remove(); } });
  const wait = (ms) => p.waitForTimeout(ms || 500);
  const toast = () => p.evaluate(() => document.querySelector("#toasts").innerText.trim());
  const shot = async (n, full) => { await wait(400); await p.screenshot({ path: S + "/" + n + ".png", fullPage: !!full }); };
  const login = async (phone) => { await p.goto("about:blank"); await p.goto(URL + "#/login"); await wait(); await p.evaluate(() => localStorage.removeItem("somon.token")); await p.reload(); await wait(600);
    await p.click(`[data-act=demologin][data-phone="${phone}"]`); await wait(700); await quiet(); };
  await p.goto(URL + "#/"); await p.evaluate(() => { localStorage.clear(); localStorage.setItem("somon.lang", '"tg"'); }); await p.reload(); await wait(700);
  /* owner */
  await login("900000101"); console.log("owner home:", p.url().split("#")[1]);
  await p.evaluate(() => location.hash = "/rest"); await wait(700); await quiet(); await shot("p-dash");
  await p.evaluate(() => location.hash = "/rest/menu"); await wait(700); await quiet();
  await p.click("[data-act=prodnew]"); await wait();
  await p.setInputFiles("[data-input=pphoto]", IMG1); await wait(900);
  await p.fill("form[data-form=prod] [name=name]", "Палави тӯёна"); await p.fill("form[data-form=prod] [name=price]", "36"); await p.fill("form[data-form=prod] [name=oldPrice]", "45");
  await shot("p-prodform");
  await p.click("form[data-form=prod] button.primary"); await wait(800); console.log("product:", await toast());
  await shot("p-menu");
  await p.evaluate(() => location.hash = "/rest/promo"); await wait(800); await quiet();
  await shot("p-promo-empty");
  await p.fill("[data-input=adtitle]", "Палави тӯёна −20%"); await p.fill("[data-input=adsub]", "Ҳар рӯз то соати 15:00");
  await p.click('[data-act=adtone][data-v="#0B8A5A"]'); await wait();
  await p.setInputFiles("[data-input=adphoto]", IMG2); await wait(900);
  await p.click("form[data-form=adsave] button.primary"); await wait(800); console.log("ad:", await toast());
  await p.setInputFiles("[data-input=cover]", IMG2); await wait(900);
  await p.fill("form[data-form=rprofile] [name=about]", "Палави тандирӣ аз соли 2010, ҳар рӯз тару тоза");
  await p.click("form[data-form=rprofile] button.primary"); await wait(800); console.log("profile:", await toast());
  await p.evaluate(() => scrollTo(0, 0)); await shot("p-promo", true);
  /* customer */
  await login("900000301"); await p.evaluate(() => location.hash = "/"); await wait(900);
  const home = await p.evaluate(() => ({ adPhoto: !!document.querySelector(".banners .banner.hasph img.bph"), adTitle: (document.querySelector(".banners .banner") || {}).innerText, cover: !!document.querySelector(".rcover.hasph img.cover") }));
  console.log("customer home:", JSON.stringify(home)); await shot("c-home");
  await p.click(".banners .banner.hasph"); await wait(900);
  const rp = await p.evaluate(() => ({ url: location.hash, hero: !!document.querySelector(".rhero.hasph"), about: (document.querySelector(".rtitle .about") || {}).innerText, sale: [...document.querySelectorAll(".pcard")].filter(x => x.querySelector(".chip.sale")).map(x => x.innerText.replace(/\s+/g, " ")) }));
  console.log("restaurant page:", JSON.stringify(rp)); await shot("c-rest");
  await p.evaluate(() => { const e = [...document.querySelectorAll(".pcard")].find(x => x.querySelector(".chip.sale")); e.scrollIntoView({ block: "center" }); }); await shot("c-sale");
  /* register with the restaurant's number → told to log in with the admin's password */
  await p.evaluate(() => SF.actions.logout()); await wait(400); await p.evaluate(() => location.hash = "/register"); await wait(700);
  const reg = await p.$("form[data-form=register]");
  if (reg) { await p.fill("form[data-form=register] [name=name]", "Карим"); await p.fill("form[data-form=register] [name=phone]", "900000101"); await p.fill("form[data-form=register] [name=password]", "123456");
    const pw2 = await p.$("form[data-form=register] [name=password2]"); if (pw2) await pw2.fill("123456");
    await p.click("form[data-form=register] button:not([type=button])"); await wait(700); console.log("register staff:", await toast()); await shot("c-staffreg"); }
  else console.log("no register form at #/register:", await p.evaluate(() => [...document.querySelectorAll("form")].map(f => f.dataset.form)));
  console.log(errs.length ? "PAGE ERRORS: " + errs.join(" | ") : "NO PAGE ERRORS");
  await b.close();
})();
