import fs from 'fs';
import { readObj, readTarget, applyTarget } from './mh.mjs';
const SRC = process.argv[2];
const OUT = process.argv[3];
const obj = readObj(`${SRC}/3dobjs/base.obj`);
const T = `${SRC}/targets/macrodetails`;
for (const e of ['african', 'asian', 'caucasian']) applyTarget(obj.v, readTarget(`${T}/${e}-male-young.target`), 1 / 3);
applyTarget(obj.v, readTarget(`${T}/height/male-young-averagemuscle-averageweight-maxheight.target`), 0.5);
applyTarget(obj.v, readTarget(`${T}/proportions/male-young-averagemuscle-averageweight-idealproportions.target`), 1);
const body = obj.faces.filter((f) => f.group === 'body');
const used = new Map(); const pos = []; const idx = [];
const vid = (i) => { if (!used.has(i)) { used.set(i, pos.length / 3); pos.push(obj.v[i][0] / 10, obj.v[i][1] / 10, obj.v[i][2] / 10); } return used.get(i); };
for (const f of body) { const q = f.v.map(vid); idx.push(q[0], q[1], q[2]); if (q.length === 4) idx.push(q[0], q[2], q[3]); }
let minY = 1e9, maxY = -1e9; for (let i = 1; i < pos.length; i += 3) { minY = Math.min(minY, pos[i]); maxY = Math.max(maxY, pos[i]); }
for (let i = 1; i < pos.length; i += 3) pos[i] -= minY;
fs.writeFileSync(OUT, JSON.stringify({ pos: pos.map((x) => +x.toFixed(4)), idx }));
console.log('verts', pos.length / 3, 'tris', idx.length / 3, 'height m', (maxY - minY).toFixed(3));
