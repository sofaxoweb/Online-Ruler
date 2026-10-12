// Extracts the /*__PURE_START__*/ ... /*__PURE_END__*/ block from index.html
// and unit-tests the ruler math + device matching.
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/\/\*__PURE_START__\*\/([\s\S]*?)\/\*__PURE_END__\*\//);
if (!m) { console.error("FAIL: pure block not found"); process.exit(1); }
eval(m[1]);

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? " :: " + extra : "")); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log("== ppiFromDiagonal ==");
// iPhone 15: 2556x1179 physical px, 6.1" diagonal -> ~460 ppi
ok(approx(ppiFromDiagonal(6.1, 2556, 1179), 460, 2), "iPhone 15 -> 460ppi", ppiFromDiagonal(6.1, 2556, 1179));
// 24" 1080p monitor: 1920x1080, 24" -> ~92 ppi
ok(approx(ppiFromDiagonal(24, 1920, 1080), 92, 1), "24in 1080p -> 92ppi", ppiFromDiagonal(24, 1920, 1080));
ok(ppiFromDiagonal(0, 1920, 1080) === null, "zero diagonal -> null");
ok(ppiFromDiagonal(-5, 1920, 1080) === null, "negative diagonal -> null");

console.log("== conversions ==");
ok(approx(pxPerMm(96), 96 / 25.4, 1e-9), "pxPerMm(96)");
ok(approx(mmToPx(85.6, 460), 85.6 * 460 / 25.4, 1e-6), "card width px @460ppi");
ok(approx(pxToMm(mmToPx(100, 300), 300), 100, 1e-9), "mm round-trip");
ok(approx(pxToIn(460, 460), 1, 1e-9), "460px @460ppi = 1in");
ok(approx(cardWidthPx(96), 85.6 * 96 / 25.4, 1e-6), "cardWidthPx(96)");
ok(approx(cardHeightPx(200), 53.98 * 200 / 25.4, 1e-6), "cardHeightPx(200)");

console.log("== clampPpi ==");
ok(clampPpi(460) === 460, "in range kept");
ok(clampPpi(5) === 40, "low clamped to 40");
ok(clampPpi(9999) === 600, "high clamped to 600");
ok(clampPpi("abc") === null, "garbage -> null");

console.log("== fmtLen ==");
ok(fmtLen(100, "cm") === "10 cm", "100mm -> 10 cm", fmtLen(100, "cm"));
ok(fmtLen(85.6, "mm") === "85.6 mm", "85.6mm", fmtLen(85.6, "mm"));
ok(fmtLen(25.4, "in") === "1 in", "25.4mm -> 1 in", fmtLen(25.4, "in"));

console.log("== matchDevice ==");
// iPhone 15 CSS viewport 393x852 @3x
var r1 = matchDevice(393, 852, 3, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
ok(r1 && r1.device.ppi === 460 && /iPhone/.test(r1.device.n), "iPhone 15 matched", JSON.stringify(r1 && r1.device.n));
// unknown tiny screen -> no match
var r2 = matchDevice(123, 456, 1, "weird");
ok(r2 === null, "unknown screen -> null");
// landscape (rotated) still matches
var r3 = matchDevice(852, 393, 3, "iPhone");
ok(r3 && /iPhone/.test(r3.device.n), "rotated dims match", JSON.stringify(r3 && r3.device.n));
// 24" 1080p desktop
var r4 = matchDevice(1920, 1080, 1, "Windows NT");
ok(r4 && r4.device.ppi === 92, "24in 1080p matched", JSON.stringify(r4 && r4.device.n));

console.log("\n== angleBetweenDeg ==");
ok(angleBetweenDeg(10, 100) === 90, "10->100 = 90deg");
ok(angleBetweenDeg(350, 10) === 20, "wrap-around = 20deg");
ok(angleBetweenDeg(0, 180) === 180, "0->180 = 180deg");
ok(angleBetweenDeg(45, 45) === 0, "same angle = 0");
ok(approx(angleBetweenDeg(15, 105), 90, 1e-9), "protractor defaults = 90deg");

console.log("== convertLen ==");
ok(convertLen(10, "cm", "mm", 96) === 100, "10cm = 100mm");
ok(approx(convertLen(1, "inch", "mm", 96), 25.4, 1e-9), "1in = 25.4mm");
ok(approx(convertLen(96, "px", "inch", 96), 1, 1e-9), "96px @96ppi = 1in");
ok(approx(convertLen(2, "inch", "px", 96), 192, 1e-9), "2in = 192px @96ppi");
ok(approx(convertLen(72, "pt", "inch", 96), 1, 1e-9), "72pt = 1in");
ok(approx(convertLen(1, "m", "ft", 96), 3.28084, 1e-4), "1m in ft");
ok(convertLen(5, "cm", "lightyear", 96) === null, "bad unit -> null");
ok(convertLen(5, "px", "mm", 0) === null, "px needs ppi");
ok(convertLen("abc", "cm", "mm", 96) === null, "garbage -> null");

console.log("== share hash ==");
ok(shareHashFor(157.35) === "#ppi=157.4", "hash format", shareHashFor(157.35));
ok(ppiFromHash("#ppi=157.4") === 157.4, "parse hash");
ok(ppiFromHash("") === null, "empty hash -> null");
ok(ppiFromHash("#foo=1") === null, "no ppi -> null");
ok(ppiFromHash("#ppi=99999") === 600, "hash clamped", String(ppiFromHash("#ppi=99999")));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
