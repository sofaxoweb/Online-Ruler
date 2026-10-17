/* Build multilingual pages for TrueRuler.
 * Reads index.html (EN master) + i18n/{code}.json, writes dist/{code}/index.html.
 * Usage: node tools/build.js [--out dist]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, process.argv[2] === "--out" ? process.argv[3] : "dist");
// Production domain (connected 2026-10-17):
const BASE_URL = "https://trueruleronline.com/";

const LANGS = [
  { code: "en", name: "English", dir: "" },
  { code: "cs", name: "Čeština", dir: "cs" },
  { code: "de", name: "Deutsch", dir: "de" },
  { code: "es", name: "Español", dir: "es" },
  { code: "fr", name: "Français", dir: "fr" },
  { code: "id", name: "Bahasa Indonesia", dir: "id" },
  { code: "it", name: "Italiano", dir: "it" },
  { code: "ja", name: "日本語", dir: "ja" },
  { code: "ko", name: "한국어", dir: "ko" },
  { code: "ms", name: "Melayu", dir: "ms" },
  { code: "nl", name: "Nederlands", dir: "nl" },
  { code: "pl", name: "Polski", dir: "pl" },
  { code: "pt", name: "Português", dir: "pt" },
  { code: "ro", name: "Română", dir: "ro" },
  { code: "ru", name: "Русский", dir: "ru" },
  { code: "th", name: "ไทย", dir: "th" },
  { code: "tr", name: "Türkçe", dir: "tr" },
  { code: "uk", name: "Українська", dir: "uk" },
  { code: "vi", name: "Tiếng Việt", dir: "vi" },
];

const FOOTER_KEYS = new Set(["All rights reserved.", "Free online ruler with protractor, printable ruler and unit converter."]);

// Translations must never touch code identifiers: id/class/for/name attributes
// and JS DOM lookups like $("btnMeasure") whose argument contains an EN word
// (e.g. tr "Measure"->"Ölç" would otherwise rewrite id="btnMeasure").
const TOKENS = [];
function protect(html) {
  // (name= is intentionally NOT protected: build anchors on <meta name="description">;
  //  its values ("unit", "card-orient") contain no translatable keys)
  html = html.replace(/\b(id|class|for)\s*=\s*"[^"]*"/g, m => {
    TOKENS.push(m);
    return "T" + (TOKENS.length - 1) + "";
  });
  html = html.replace(/(\$\(|getElementById\(|querySelectorAll\(|querySelector\(|closest\()"([^"]*)"\)/g, m => {
    TOKENS.push(m);
    return "T" + (TOKENS.length - 1) + "";
  });
  return html;
}
function restore(html) {
  return html.replace(/T(\d+)/g, (m, i) => TOKENS[Number(i)]);
}

function pageUrl(lang) {
  return BASE_URL + (lang.dir ? lang.dir + "/" : "");
}
function relUrl(from, to) {
  // relative URL from page `from` to page `to`
  if (from.code === to.code) return "./";
  if (from.code === "en") return to.dir + "/";
  if (to.code === "en") return "../";
  return "../" + to.dir + "/";
}

function buildLang(lang, dict) {
  TOKENS.length = 0;
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const warnings = [];

  // 0. protect code identifiers from translation
  html = protect(html);

  // 1. <html lang>
  html = html.replace('<html lang="en">', `<html lang="${lang.code}">`);

  // 2. title + meta description (from EN master values)
  const enMeta = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "en.json"), "utf8")).meta;
  html = html.replace(`<title>${enMeta.title}</title>`, `<title>${dict.meta.title}</title>`);
  html = html.replace(`content="${enMeta.description}"`, `content="${dict.meta.description}"`);
  // h1
  html = html.replace(`>${enMeta.h1}</h1>`, `>${dict.meta.h1}</h1>`);

  // 3. UI strings — SINGLE PASS so inserted translations are never re-processed
  // (a translation may legitimately contain an EN key as a loanword, e.g. nl "Print").
  // A key is only replaced when NOT glued to a JS identifier: this keeps
  // document.exitFullscreen, startMeasure, etc. intact in every language.
  const keys = Object.keys(dict.strings).sort((a, b) => b.length - a.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const IDCH = "A-Za-z0-9_$";
  const re = new RegExp(keys.map(k => `(?<![${IDCH}])${esc(k)}(?![${IDCH}])`).join("|"), "g");
  const before = html;
  html = html.replace(re, m => dict.strings[m]);
  for (const k of keys) {
    if (!before.includes(k) && !FOOTER_KEYS.has(k)) warnings.push(`key not found: ${k.slice(0, 60)}`);
  }

  // 4. canonical + hreflang + OG/Twitter (insert after meta description)
  const hreflangs = LANGS.map(l =>
    `    <link rel="alternate" hreflang="${l.code}" href="${pageUrl(l)}">`).join("\n");
  const head = `    <link rel="canonical" href="${pageUrl(lang)}">\n${hreflangs}\n` +
    `    <link rel="alternate" hreflang="x-default" href="${pageUrl(LANGS[0])}">\n` +
    `    <meta property="og:type" content="website">\n` +
    `    <meta property="og:url" content="${pageUrl(lang)}">\n` +
    `    <meta property="og:title" content="${dict.meta.title}">\n` +
    `    <meta property="og:description" content="${dict.meta.description}">\n` +
    `    <meta property="og:locale" content="${lang.code}">\n` +
    `    <meta property="og:image" content="${BASE_URL}og-image.png">\n` +
    `    <meta property="og:image:width" content="1200">\n` +
    `    <meta property="og:image:height" content="630">\n` +
    `    <meta name="twitter:card" content="summary_large_image">\n` +
    `    <meta name="twitter:image" content="${BASE_URL}og-image.png">\n` +
    `    <meta name="twitter:title" content="${dict.meta.title}">\n` +
    `    <meta name="twitter:description" content="${dict.meta.description}">`;
  html = html.replace(/(<meta name="description"[^>]*>)/, `$1\n${head}`);

  // 5. footer replacement
  const links = LANGS.map(l => {
    const cur = l.code === lang.code ? ' aria-current="page"' : "";
    return `<a href="${relUrl(lang, l)}" hreflang="${l.code}"${cur}>${l.name}</a>`;
  }).join("\n      ");
  const footer =
`<footer>
  <div class="footer-inner">
    <div class="footer-brand">TrueRuler</div>
    <p class="footer-tag">${dict.strings["Free online ruler with protractor, printable ruler and unit converter."]}</p>
    <nav class="footer-langs" aria-label="Languages">
      ${links}
    </nav>
    <nav class="footer-legal" aria-label="Legal">
      <a href="/about/">About</a>
      <a href="/contact/">Contact</a>
      <a href="/privacy/">Privacy Policy</a>
      <a href="/terms/">Terms</a>
    </nav>
    <p class="footer-copy">&copy; <span id="year"></span> TrueRuler. ${dict.strings["All rights reserved."]}</p>
  </div>
</footer>`;
  html = html.replace(/<footer>[\s\S]*?<\/footer>/, footer);

  // 6. LANGS injection for the language switcher
  const langsJs = LANGS.map(l => `{code:"${l.code}",name:"${l.name}",url:"${relUrl(lang, l)}"}`).join(",");
  const inject = `<script>window.LANGS=[${langsJs}];window.CURRENT_LANG="${lang.code}";</script>\n`;
  html = html.replace(/(<body[^>]*>)/, `$1\n${inject}`);

  // 7. fix relative asset paths for subdirectories (PWA)
  if (lang.dir) {
    html = html.split('href="manifest.json"').join('href="../manifest.json"');
    html = html.split('href="icon-192.svg"').join('href="../icon-192.svg"');
    html = html.split('src="img/').join('src="../img/');
    html = html.split('navigator.serviceWorker.register("sw.js")').join('navigator.serviceWorker.register("../sw.js")');
  }

  // 8. restore protected code identifiers (LAST - after all injections)
  html = restore(html);

  // 8b. brand link points at the current language home (after restore: class="brand" was protected)
  if (lang.dir) {
    html = html.split('<a class="brand" href="/">').join(`<a class="brand" href="/${lang.dir}/">`);
  }

  const outDir = path.join(OUT, lang.dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  return warnings;
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  let totalWarnings = 0;
  for (const lang of LANGS) {
    const dictPath = path.join(ROOT, "i18n", `${lang.code}.json`);
    if (!fs.existsSync(dictPath)) {
      console.log(`SKIP ${lang.code}: no dictionary`);
      continue;
    }
    const dict = JSON.parse(fs.readFileSync(dictPath, "utf8"));
    const enKeys = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "en.json"), "utf8")).strings);
    const missing = enKeys.filter(k => !(k in dict.strings));
    if (missing.length) console.log(`WARN ${lang.code}: ${missing.length} keys missing from dict`);
    const warnings = buildLang(lang, dict);
    warnings.forEach(w => console.log(`WARN ${lang.code}: ${w}`));
    totalWarnings += warnings.length + missing.length;
    console.log(`built ${lang.code} -> ${(lang.dir || "/") + "index.html"}`);
  }
  console.log(totalWarnings === 0 ? "BUILD CLEAN" : `BUILD DONE with ${totalWarnings} warnings`);
  // copy root-level static files that must survive the dist wipe
  for (const f of [".htaccess", "og-image.png"]) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUT, f));
      console.log(`copied ${f} -> dist/`);
    }
  }
  // copy guide illustrations
  const imgSrc = path.join(ROOT, "img"), imgOut = path.join(OUT, "img");
  if (fs.existsSync(imgSrc)) {
    fs.mkdirSync(imgOut, { recursive: true });
    for (const f of fs.readdirSync(imgSrc)) {
      fs.copyFileSync(path.join(imgSrc, f), path.join(imgOut, f));
    }
    console.log(`copied img/ -> dist/img/`);
  }
  // copy English legal pages
  for (const p of ["about", "contact", "privacy", "terms"]) {
    const src = path.join(ROOT, "legal", p, "index.html");
    if (fs.existsSync(src)) {
      const outDir = path.join(OUT, p);
      fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(src, path.join(outDir, "index.html"));
    }
  }
  console.log(`copied legal/ -> dist/`);
  // sitemap.xml + robots.txt (19 languages + 4 legal pages)
  const smUrls = [
    ...LANGS.map(l => pageUrl(l)),
    ...["about", "contact", "privacy", "terms"].map(p => BASE_URL + p + "/"),
  ];
  const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    smUrls.map(u => `    <url>\n        <loc>${u}</loc>\n    </url>`).join("\n") + '\n</urlset>\n';
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sm);
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}sitemap.xml\n`);
  console.log(`wrote sitemap.xml (${smUrls.length} urls) + robots.txt`);
}

main();
