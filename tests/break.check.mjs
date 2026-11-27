// Break tests: prove checks 2 and 7 go red when the thing they cover is removed.
// Each case copies the game to a temp folder, removes one piece of src/main.js,
// runs tests/base.check.mjs there, and requires that check to FAIL.
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const BASE = path.join(HERE, "base.check.mjs");

const CASES = [
  { check: 2, why: "resize handler removed", from: 'window.addEventListener("resize", resize);', to: "" },
  { check: 2, why: "aspect not updated on resize", from: "camera.aspect = w / h;", to: "" },
  { check: 7, why: "save writes nothing", from: "localStorage.setItem(SAVE_KEY, JSON.stringify(state)); ", to: "" },
  { check: 7, why: "load reads nothing", from: "localStorage.getItem(SAVE_KEY)", to: "null" },
];

let bad = 0;
for (const c of CASES) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "break-"));
  for (const f of ["index.html", "style.css", "src"]) await cp(path.join(REPO, f), path.join(dir, f), { recursive: true });
  const file = path.join(dir, "src", "main.js");
  const code = await readFile(file, "utf8");
  if (!code.includes(c.from)) {
    console.log(`FAIL: break ${c.check} (${c.why}): the line to remove was not found in src/main.js`);
    bad++;
    continue;
  }
  await writeFile(file, code.replace(c.from, c.to));
  const run = spawnSync(process.execPath, [BASE], { cwd: dir, encoding: "utf8", timeout: 180000 });
  const out = (run.stdout || "") + (run.stderr || "");
  const line = out.split("\n").find((l) => l.startsWith(`FAIL: ${c.check}.`));
  if (run.status !== 0 && line) console.log(`PASS: break ${c.check} (${c.why}) turned check ${c.check} red -> ${line.slice(0, 160)}`);
  else {
    console.log(`FAIL: break ${c.check} (${c.why}) did NOT turn check ${c.check} red (exit ${run.status})`);
    bad++;
  }
  await rm(dir, { recursive: true, force: true });
}
console.log(bad ? `\n${bad} break test(s) failed` : "\nAll break tests passed: checks 2 and 7 go red when broken.");
process.exit(bad ? 1 : 0);
