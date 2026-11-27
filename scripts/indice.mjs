// Genera public/data/indice.json: índice liviano para el buscador (lupa) con
// calles, barrios/caseríos y ciudades de todas las ciudades. Corre antes de cada build.
import { readFile, writeFile, access } from 'node:fs/promises';

const CIUDADES = JSON.parse(await readFile(new URL('../lib/ciudades.json', import.meta.url), 'utf8'));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const km = ([a, b], [la, lo]) => Math.hypot((a - la) * 111.3, (b - lo) * 111.3 * Math.cos((la * Math.PI) / 180));
const largo = (c) => c.slice(1).reduce((L, p, i) => L + km(p, c[i]), 0);
const salida = [];

for (const ciudad of CIUDADES) {
  const archivo = new URL(`../public/data/${ciudad.id}.json`, import.meta.url);
  try { await access(archivo); } catch { continue; }
  const d = JSON.parse(await readFile(archivo, 'utf8'));
  salida.push({ n: ciudad.nombre, t: 'ciudad', c: ciudad.id, p: ciudad.centro });

  // Calles: una entrada por nombre, ubicada en su tramo más largo; s = la parte más susceptible.
  const porNombre = new Map();
  for (const s of d.calles) {
    if (!s.n) continue;
    const e = porNombre.get(s.n) ?? { s: 0, L: -1, p: null };
    e.s = Math.max(e.s, s.s);
    const L = largo(s.c);
    if (L > e.L) { e.L = L; e.p = s.c[Math.floor(s.c.length / 2)]; }
    porNombre.set(s.n, e);
  }
  for (const [n, e] of porNombre) salida.push({ n, t: 'calle', c: ciudad.id, p: [r4(e.p[0]), r4(e.p[1])], s: e.s });

  // Barrios, asentamientos y caseríos cercanos.
  const lim = ciudad.id === 'tambogrande' ? 40 : ciudad.radioKm + 2;
  const vistos = new Set();
  for (const l of d.lugares) {
    if (vistos.has(l.n) || km(l.p, ciudad.centro) > lim) continue;
    vistos.add(l.n);
    salida.push({ n: l.n, t: 'lugar', c: ciudad.id, p: [r4(l.p[0]), r4(l.p[1])] });
  }
}
await writeFile(new URL('../public/data/indice.json', import.meta.url), JSON.stringify(salida));
console.log(`Índice del buscador: ${salida.length} entradas`);
