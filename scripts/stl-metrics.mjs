/**
 * STL → 부피(mm³), 표면적(mm²), bbox {x,y,z} (index.html과 동일 알고리즘)
 */
import fs from "fs";

function parseStl(buffer) {
  const triangles = [];
  const isAscii = buffer.length < 84 || buffer.slice(0, 5).toString("utf8") === "solid";
  if (isAscii) {
    const text = buffer.toString("utf8");
    const re = /facet\s+normal\s+[\d.eE+-]+\s+[\d.eE+-]+\s+[\d.eE+-]+\s+outer\s+loop\s+vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
    let m;
    while ((m = re.exec(text))) {
      triangles.push([
        [+m[1], +m[2], +m[3]],
        [+m[4], +m[5], +m[6]],
        [+m[7], +m[8], +m[9]],
      ]);
    }
    if (!triangles.length) throw new Error("ASCII STL 파싱 실패");
    return triangles;
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const n = view.getUint32(80, true);
  let off = 84;
  for (let i = 0; i < n; i++) {
    off += 12;
    const a = [view.getFloat32(off, true), view.getFloat32(off + 4, true), view.getFloat32(off + 8, true)];
    off += 12;
    const b = [view.getFloat32(off, true), view.getFloat32(off + 4, true), view.getFloat32(off + 8, true)];
    off += 12;
    const c = [view.getFloat32(off, true), view.getFloat32(off + 4, true), view.getFloat32(off + 8, true)];
    off += 14;
    triangles.push([a, b, c]);
  }
  return triangles;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function len(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function analyzeStl(filePath) {
  const triangles = parseStl(fs.readFileSync(filePath));
  let volSum = 0;
  let area = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const [a, b, c] of triangles) {
    for (const p of [a, b, c]) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i]);
        max[i] = Math.max(max[i], p[i]);
      }
    }
    volSum += dot(a, cross(b, c)) / 6;
    area += len(cross(sub(b, a), sub(c, a))) / 2;
  }
  const volMm3 = Math.abs(volSum);
  const bbox = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
  return { volMm3, surfaceAreaMm2: area, bbox, triangleCount: triangles.length };
}
