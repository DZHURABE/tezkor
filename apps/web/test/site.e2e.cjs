/* What someone who searches "Тезкор" meets: tags for Google, robots/sitemap, share picture, the /download page on Android and iPhone */
const { chromium, devices } = require("/opt/npm-tools/node_modules/playwright");
const { spawn } = require("child_process"), path = require("path"), fs = require("fs"), os = require("os"), assert = require("assert");
const S = path.resolve(__dirname, "../shots"); const PUB = path.resolve(__dirname, "../public/tezkor.apk"), DIST = path.resolve(__dirname, "../dist/tezkor.apk");
const PORT = 9300 + Math.floor(Math.random() * 300), B = `http://localhost:${PORT}`;
(async () => {
  fs.writeFileSync(DIST, Buffer.alloc(4096, 1));      // a stand-in APK, as GitHub Actions would put there
  const srv = spawn(process.execPath, [path.resolve(__dirname, "../../api/src/index.js")], { env: { ...process.env, PORT, DATA_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "si-")), "db.json"), ADMIN_PHONE: "931112233", ADMIN_PASSWORD: "Admin2026" }, stdio: "ignore" });
  const done = () => { srv.kill(); try { fs.unlinkSync(DIST); } catch {} }; process.on("exit", done);
  await new Promise(r => setTimeout(r, 900));
  const home = await (await fetch(B + "/")).text();
  assert.match(home, /<title>Тезкор — расонидани таом дар Шаҳритус<\/title>/); assert.match(home, /og:image" content="http:\/\/localhost:\d+\/og\.png"/); assert.match(home, /application\/ld\+json/); assert.match(home, /<noscript>/);
  assert.match(home, /alternateName":\["Tezkor","Tezkor TJ"/);
  console.log("✓ home: title, description, Open Graph, schema.org, noscript");
  const rb = await (await fetch(B + "/robots.txt")).text(); assert.match(rb, /Sitemap: http:\/\/localhost:\d+\/sitemap\.xml/); assert.match(rb, /Disallow: \/api\//);
  const sm = await (await fetch(B + "/sitemap.xml")).text(); assert.match(sm, /<loc>http:\/\/localhost:\d+\/download<\/loc>/);
  const og = await fetch(B + "/og.png"); assert.equal(og.headers.get("content-type"), "image/png");
  const fwd = await (await fetch(B + "/", { headers: { "x-forwarded-proto": "https", "x-forwarded-host": "tezkor.tj" } })).text(); assert.match(fwd, /canonical" href="https:\/\/tezkor\.tj\/"/);
  console.log("✓ robots.txt, sitemap.xml, og.png, canonical behind a proxy (https://tezkor.tj)");
  const b = await chromium.launch();
  const an = await (await b.newContext({ ...devices["Pixel 7"], acceptDownloads: true })).newPage(); await an.route(/fonts\./, r => r.abort());
  await an.goto(B + "/download"); await an.waitForTimeout(500);
  const first = await an.evaluate(() => document.querySelector(".wrap .card").id); assert.equal(first, "android");
  const [dl] = await Promise.all([an.waitForEvent("download"), an.click("a[href='/tezkor.apk']")]); assert.equal(dl.suggestedFilename(), "tezkor.apk");
  await an.screenshot({ path: S + "/download-android.png", fullPage: true });
  console.log("✓ /download on Android: APK first, downloads tezkor.apk");
  const ip = await (await b.newContext({ ...devices["iPhone 13"] })).newPage(); await ip.route(/fonts\./, r => r.abort());
  await ip.goto(B + "/download"); await ip.waitForTimeout(500);
  assert.equal(await ip.evaluate(() => document.querySelector(".wrap .card:not(.hide)").id), "ios"); assert.ok(await ip.evaluate(() => document.getElementById("android").classList.contains("hide")));
  await ip.screenshot({ path: S + "/download-iphone.png", fullPage: true });
  console.log("✓ /download on iPhone: home-screen steps first, no APK");
  fs.unlinkSync(DIST);
  const noapk = await (await fetch(B + "/download")).text(); assert.ok(!/tezkor\.apk"/.test(noapk.split("<main")[1].split("</main>")[0].replace(/download="tezkor\.apk"/g, "")) || !/id="android"/.test(noapk));
  assert.ok(!/id="android"/.test(noapk)); console.log("✓ without an APK yet: the page offers the browser way only");
  await b.close(); done(); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
