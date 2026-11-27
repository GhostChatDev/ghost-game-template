// The base scene's 7 checks. Every check reads window.__game (set by src/main.js) instead of guessing from pixels,
// except the frame check, which must look at pixels to catch a black rectangle.
// Run: npm install --no-save playwright@1.58.2 && npx playwright install chromium && node tests/base.check.mjs
import { chromium } from "playwright";
import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(".");
const OUT = "test-results";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) throw new Error("outside");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;
await mkdir(OUT, { recursive: true });

const results = [];
const record = (n, name, ok, detail) => {
  results.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}: ${n}. ${name}: ${detail}`);
  if (!ok) console.log(`::error::check ${n} (${name}): ${detail}`);
};

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function open(viewport, errors) {
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  await page.goto(URL_, { waitUntil: "load", timeout: 30000 });
  return { context, page };
}
const waitReady = (page, ms) => page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: ms });
const waitFrames = (page, n) => page.waitForFunction((k) => window.__game.frames >= k, n, { timeout: 20000 });

// Distinct colours in a PNG (decoded in the page), so a flat canvas is caught.
async function colours(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 160; c.height = 160;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, 160, 160);
    const d = g.getImageData(0, 0, 160, 160).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
    return seen.size;
  }, png.toString("base64"));
}

// ---- 1. loads clean, ready within 5 s ----
{
  const errors = [];
  const { context, page } = await open({ width: 844, height: 390 }, errors);
  let ready = true;
  try { await waitReady(page, 5000); } catch { ready = false; }
  await page.waitForTimeout(500);
  record(1, "loads", ready && errors.length === 0,
    ready ? (errors.length ? errors.slice(0, 3).join(" | ") : "window.__game.ready true, no console error") : "window.__game.ready not true within 5 s");
  await context.close();
}

// ---- 2. canvas fills the viewport at 360x640 and 844x390; aspect follows resize ----
{
  const errors = [];
  const { context, page } = await open({ width: 360, height: 640 }, errors);
  await waitReady(page, 15000);
  const measure = () => page.evaluate(() => {
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, aspect: window.__game.camera.aspect };
  });
  const a = await measure();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  const b = await measure();
  const fills = (m) => Math.abs(m.w - m.vw) <= 1 && Math.abs(m.h - m.vh) <= 1;
  const aspectOk = (m) => Math.abs(m.aspect - m.vw / m.vh) < 0.01;
  const ok = fills(a) && fills(b) && aspectOk(a) && aspectOk(b);
  record(2, "viewport", ok, `360x640 canvas ${a.w}x${a.h} aspect ${a.aspect.toFixed(3)}; 844x390 canvas ${b.w}x${b.h} aspect ${b.aspect.toFixed(3)}`);
  await context.close();
}

// ---- 3. frame check: two screenshots 2 s apart differ, and the canvas is not one flat colour ----
{
  const errors = [];
  const { context, page } = await open({ width: 844, height: 390 }, errors);
  await waitReady(page, 15000);
  const canvas = page.locator("canvas");
  const first = await canvas.screenshot({ path: `${OUT}/frame-1-load.png` });
  await page.waitForTimeout(2000);
  const second = await canvas.screenshot({ path: `${OUT}/frame-2-after-2s.png` });
  const same = Buffer.compare(first, second) === 0;
  const c1 = await colours(page, first);
  const c2 = await colours(page, second);
  record(3, "frames", !same && c1 > 2 && c2 > 2, `screenshots ${same ? "IDENTICAL" : "differ"}; colours ${c1} and ${c2}`);
  await context.close();
}

// ---- 4 + 6. tap the ground: player reaches it in 3 s, frames grow, y stays on the ground ----
{
  const errors = [];
  const { context, page } = await open({ width: 844, height: 390 }, errors);
  await waitReady(page, 15000);
  const f0 = await page.evaluate(() => window.__game.frames);
  // Sample player y every frame from now on.
  await page.evaluate(() => {
    window.__ys = [];
    const tick = () => { window.__ys.push(window.__game.player.y); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.mouse.click(844 * 0.7, 390 * 0.65);
  await page.waitForTimeout(100);
  const tgt = await page.evaluate(() => window.__game.target);
  await page.waitForTimeout(3000);
  const end = await page.evaluate(() => ({ p: window.__game.player, f: window.__game.frames, ys: window.__ys }));
  if (!tgt) record(4, "tap to move", false, "tap set no ground target (window.__game.target is null)");
  else {
    const d = Math.hypot(end.p.x - tgt.x, end.p.z - tgt.z);
    const moved = Math.hypot(tgt.x, tgt.z) > 1; // the tap point is away from the start (0,0)
    record(4, "tap to move", d <= 0.5 && moved && end.f > f0,
      `tap at (${tgt.x.toFixed(2)}, ${tgt.z.toFixed(2)}), player at (${end.p.x.toFixed(2)}, ${end.p.z.toFixed(2)}), off by ${d.toFixed(3)}; frames ${f0} -> ${end.f}`);
  }
  const worst = end.ys.reduce((m, y) => Math.max(m, Math.abs(y)), 0);
  record(6, "on the ground", end.ys.length > 10 && worst <= 0.05, `${end.ys.length} frames sampled, largest |y| ${worst.toFixed(4)}`);
  await context.close();
}

// ---- 5. camera at frame 10 equals camera at frame 200 ----
{
  const errors = [];
  const { context, page } = await open({ width: 844, height: 390 }, errors);
  await waitFrames(page, 10);
  const c10 = await page.evaluate(() => ({ ...window.__game.camera, f: window.__game.frames }));
  await page.mouse.click(844 * 0.3, 390 * 0.4); // moving the player must not move the camera
  await waitFrames(page, 200);
  const c200 = await page.evaluate(() => ({ ...window.__game.camera, f: window.__game.frames }));
  const same = c10.x === c200.x && c10.y === c200.y && c10.z === c200.z;
  record(5, "fixed camera", same, `frame ${c10.f}: (${c10.x}, ${c10.y}, ${c10.z}); frame ${c200.f}: (${c200.x}, ${c200.y}, ${c200.z})`);
  await context.close();
}

// ---- 7. save, reload, state comes back identical ----
{
  const errors = [];
  const { context, page } = await open({ width: 844, height: 390 }, errors);
  await waitReady(page, 15000);
  // Load: a probe written to storage must come back as the state after a reload.
  const probe = JSON.stringify({ probe: 7 });
  await page.evaluate((p) => localStorage.setItem("ghost-game-save-v1", p), probe);
  await page.reload({ waitUntil: "load" });
  await waitReady(page, 15000);
  const loaded = await page.evaluate(() => JSON.stringify(window.__game.state));
  // Save: storage cleared, save() must write the state back out, and a reload must return it identical.
  const before = await page.evaluate(() => {
    localStorage.removeItem("ghost-game-save-v1");
    const ok = typeof window.__game.save === "function" && window.__game.save();
    return { ok, state: JSON.stringify(window.__game.state), stored: localStorage.getItem("ghost-game-save-v1") };
  });
  await page.reload({ waitUntil: "load" });
  await waitReady(page, 15000);
  const after = await page.evaluate(() => JSON.stringify(window.__game.state));
  const ok = loaded === probe && before.ok === true && before.stored === before.state && after === before.state;
  record(7, "save and reload", ok, `probe ${probe} loaded as ${loaded}; saved ${before.stored}, state after reload ${after}`);
  await context.close();
}

await browser.close();
server.close();
await writeFile(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
