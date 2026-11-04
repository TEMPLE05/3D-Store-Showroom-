// Helpers for reading MakeHuman (CC0) source assets: base.obj, .target files, .mhskel, .mhw
import fs from 'fs';

export function readObj(path) {
  const txt = fs.readFileSync(path, 'utf8').split('\n');
  const v = [], vt = [], faces = []; let group = '';
  for (const line of txt) {
    if (line.startsWith('v ')) { const [, x, y, z] = line.trim().split(/\s+/); v.push([+x, +y, +z]); }
    else if (line.startsWith('vt ')) { const [, a, b] = line.trim().split(/\s+/); vt.push([+a, +b]); }
    else if (line.startsWith('g ')) group = line.slice(2).trim();
    else if (line.startsWith('f ')) {
      const idx = line.trim().split(/\s+/).slice(1).map((t) => { const [a, b] = t.split('/'); return [+a - 1, b ? +b - 1 : -1]; });
      faces.push({ group, v: idx.map((x) => x[0]), t: idx.map((x) => x[1]) });
    }
  }
  return { v, vt, faces };
}

export function readTarget(path) {
  const d = [];
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const [i, x, y, z] = line.trim().split(/\s+/);
    d.push([+i, +x, +y, +z]);
  }
  return d;
}

export function applyTarget(v, target, w) {
  for (const [i, x, y, z] of target) { v[i][0] += w * x; v[i][1] += w * y; v[i][2] += w * z; }
}
