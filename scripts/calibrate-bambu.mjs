/**
 * stl/#N.stl + 뱀부 샘플 → index.html 견적 vs 뱀부
 * node scripts/calibrate-bambu.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";
import { analyzeStl } from "./stl-metrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STL_DIR = path.join(__dirname, "..", "stl");

const SAMPLES = [
  { id: 1, bambuVolMm3: 48418.3, bambuG: 14.48, bambuMin: 24 + 2 / 60 },
  { id: 2, bambuVolMm3: 457585, bambuG: 73.07, bambuMin: 82 },
  { id: 3, bambuVolMm3: 601549, bambuG: 91.43, bambuMin: 103 },
  { id: 4, bambuVolMm3: 462007, bambuG: 71.95, bambuMin: 82 },
  { id: 5, bambuVolMm3: 334108, bambuG: 51.8, bambuMin: 63 },
  { id: 6, bambuVolMm3: 10867, bambuG: 6.41, bambuMin: 20 + 54 / 60 },
  { id: 7, bambuVolMm3: 233967, bambuG: 50.62, bambuMin: 62 },
];

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("var CONFIG = {");
const fnEnd =
  html.indexOf("};", html.indexOf("return buildEstimateResult", html.indexOf("window.estimateFromSTL = function", start))) + 2;
const code = html.slice(start, fnEnd) + "\nglobalThis.estimateFromSTL = window.estimateFromSTL;";

const ctx = { globalThis: {}, window: {}, ChannelIO: () => {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);

const estimateFromSTL = ctx.globalThis.estimateFromSTL;
const CONFIG = ctx.CONFIG;
const INFILL = 5;

function stlPath(id) {
  return path.join(STL_DIR, `#${id}.stl`);
}

function fmtMin(m) {
  const t = Math.round(m);
  if (t < 60) return `${t}분`;
  const h = Math.floor(t / 60);
  const r = t % 60;
  return r < 5 ? `${h}시간` : `${h}시간 ${r}분`;
}

console.log("=== STL 실측 + 페이지 견적 vs 뱀부 ===\n");
console.log(`준비 ${CONFIG.PRINT_PREP_MINUTES}분 포함 | infill ${INFILL}%\n`);

const rows = [];

for (const s of SAMPLES) {
  const fp = stlPath(s.id);
  if (!fs.existsSync(fp)) {
    console.log(`#${s.id} — 파일 없음: ${fp}`);
    continue;
  }
  const m = analyzeStl(fp);
  const r = estimateFromSTL(m.volMm3, m.bbox, m.surfaceAreaMm2, INFILL);
  const volCm3 = m.volMm3 / 1000;
  const bboxVolCm3 = (m.bbox.x * m.bbox.y * m.bbox.z) / 1000;
  const compact = volCm3 / Math.max(bboxVolCm3, volCm3 * 0.01);
  const pageG = Math.round(r.filGrams);
  const pageMin = Math.round(r.printMin);
  const bambuMin = Math.round(s.bambuMin);

  rows.push({
    id: s.id,
    volCm3,
    bambuVolCm3: s.bambuVolMm3 / 1000,
    volDiff: ((m.volMm3 - s.bambuVolMm3) / s.bambuVolMm3 * 100).toFixed(1),
    bbox: `${m.bbox.x.toFixed(1)}×${m.bbox.y.toFixed(1)}×${m.bbox.z.toFixed(1)}`,
    compact: compact.toFixed(3),
    pageG,
    bambuG: s.bambuG,
    dG: pageG - s.bambuG,
    pageMin,
    bambuMin,
    dMin: pageMin - bambuMin,
  });
}

console.log(
  "id | mesh cm³ | 뱀부cm³ | volΔ% | bbox(mm) | compact | 페이지g | 뱀부g | Δg | 페이지 | 뱀부 | Δ분"
);
console.log("-".repeat(110));

for (const r of rows) {
  console.log(
    [
      `#${r.id}`,
      r.volCm3.toFixed(1).padStart(7),
      r.bambuVolCm3.toFixed(1).padStart(7),
      (r.volDiff + "%").padStart(6),
      r.bbox.padStart(18),
      r.compact.padStart(7),
      String(r.pageG).padStart(7),
      String(r.bambuG).padStart(6),
      (r.dG >= 0 ? "+" : "") + r.dG.toFixed(1).padStart(5),
      fmtMin(r.pageMin).padStart(8),
      fmtMin(r.bambuMin).padStart(6),
      (r.dMin >= 0 ? "+" : "") + String(r.dMin).padStart(5),
    ].join(" | ")
  );
}

const avgAbsG = rows.reduce((a, r) => a + Math.abs(r.dG), 0) / rows.length;
const avgAbsMin = rows.reduce((a, r) => a + Math.abs(r.dMin), 0) / rows.length;
console.log("\n평균 절대 오차: 필라 " + avgAbsG.toFixed(1) + "g | 시간 " + avgAbsMin.toFixed(0) + "분");
