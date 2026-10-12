/* QA for built multilingual pages. Usage: node tools/qa.js [dist] */
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", process.argv[2] || "dist");
const CODES = ["en","cs","de","es","fr","id","it","ja","ko","ms","nl","pl","pt","ro","ru","th","tr","uk","vi"];
const enDict = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "i18n", "en.json"), "utf8"));

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; } else { fail++; console.log("  FAIL " + label); }
}

for (const code of CODES) {
  const fp = code === "en" ? path.join(DIST, "index.html") : path.join(DIST, code, "index.html");
  if (!fs.existsSync(fp)) { ok(false, code + ": file missing"); continue; }
  const html = fs.readFileSync(fp, "utf8");
  const dict = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "i18n", `${code}.json`), "utf8"));

  ok(html.includes(`<html lang="${code}">`), `${code}: lang attr`);
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  ok(h1s === 1, `${code}: exactly 1 h1 (got ${h1s})`);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  ok(title.length > 10 && title.length <= 70, `${code}: title length (${title.length})`);
  ok(title === dict.meta.title, `${code}: title matches dict`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  ok(desc.length >= 100 && desc.length <= 200, `${code}: meta description length (${desc.length})`);
  if (code !== "en") {
    ok(title !== enDict.meta.title, `${code}: title translated`);
    ok(!html.includes(`<h1`) || !html.includes(`>${enDict.meta.h1}</h1>`), `${code}: h1 translated`);
  }
  const hreflangs = (html.match(/hreflang="/g) || []).length;
  ok(hreflangs >= 38, `${code}: hreflang count (${hreflangs})`); // 19 page + 19 footer links
  ok(html.includes('<link rel="canonical"'), `${code}: canonical present`);
  ok(html.includes('rel="alternate" hreflang="x-default"'), `${code}: x-default present`);
  ok(html.includes("og:title") && html.includes("twitter:card"), `${code}: OG/Twitter present`);
  ok(html.includes(`window.CURRENT_LANG="${code}"`), `${code}: CURRENT_LANG`);
  const langsCount = (html.match(/\{code:"[a-z]{2}",name:"/g) || []).length;
  ok(langsCount === 19, `${code}: LANGS has 19 entries (${langsCount})`);
  // tool JS intact
  ok(html.includes("function ppiFromDiagonal") && html.includes("function drawRuler"), `${code}: tool JS intact`);
  ok(html.includes('id="proCanvas"') && html.includes('id="convFrom"'), `${code}: v2 features intact`);
  // footer
  ok(html.includes('class="footer-langs"'), `${code}: footer langs nav`);
  // no EN leaks in chrome for non-en (spot check a few high-visibility strings)
  if (code !== "en") {
    for (const s of ["How to measure", "Quick calibration", "Calibrate your screen"]) {
      ok(!html.includes(">" + s + "<") && !html.includes('"' + s + '"'), `${code}: no EN leak "${s}"`);
    }
  }
  // every dict key applied (or footer-only)
  const footerOnly = new Set(["All rights reserved.", "Free online ruler with protractor, printable ruler and unit converter."]);
  for (const k of Object.keys(dict.strings)) {
    if (footerOnly.has(k)) continue;
    ok(html.includes(dict.strings[k]), `${code}: key applied "${k.slice(0, 40)}"`);
  }
  // built page's <script> blocks must still parse (catches identifier corruption)
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let jsOk = scripts.length >= 3;
  if (jsOk) {
    const { execFileSync } = require("child_process");
    const os = require("os");
    for (let i = 0; i < scripts.length && jsOk; i++) {
      const f = path.join(os.tmpdir(), `qa-${code}-${i}.js`);
      fs.writeFileSync(f, scripts[i]);
      try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
      catch (e) { jsOk = false; }
    }
  }
  ok(jsOk, `${code}: all inline scripts parse`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
