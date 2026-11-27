// Construye public/data/tambogrande.json a partir del extracto guardado en scripts/osm/
// (vías y cauces de OpenStreetMap, caseríos y una grilla de elevación Copernicus GLO-90 vía Open-Meteo).
// No necesita internet.   Uso:  node scripts/construir-desde-osm.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { procesar } from './procesar.mjs';

const dir = new URL('./osm/', import.meta.url);
const grilla = JSON.parse(await readFile(new URL('grilla-elevacion.json', dir), 'utf8'));
const { la0, lo0, st, NR, NC, z } = grilla;
const LAT_MAX = la0 + (NR - 1) * st;
const LON_MAX = lo0 + (NC - 1) * st;
const dentro = ([la, lo]) => la >= la0 && la <= LAT_MAX && lo >= lo0 && lo <= LON_MAX;

// Interpolación bilineal en la grilla de elevación.
function cota([la, lo]) {
  if (!dentro([la, lo])) return NaN;
  const fi = (la - la0) / st, fj = (lo - lo0) / st;
  const i = Math.min(NR - 2, Math.floor(fi)), j = Math.min(NC - 2, Math.floor(fj));
  const di = fi - i, dj = fj - j;
  const v = (a, b) => z[a * NC + b];
  return v(i, j) * (1 - di) * (1 - dj) + v(i, j + 1) * (1 - di) * dj + v(i + 1, j) * di * (1 - dj) + v(i + 1, j + 1) * di * dj;
}

// Recorta una polilínea a la grilla (conserva un vértice de borde para no cortar en seco).
function recortar(c) {
  const partes = [];
  let cur = [];
  for (let k = 0; k < c.length; k++) {
    const ok = dentro(c[k]) || (k > 0 && dentro(c[k - 1])) || (k < c.length - 1 && dentro(c[k + 1]));
    if (ok) cur.push(c[k]);
    else if (cur.length) { partes.push(cur); cur = []; }
  }
  if (cur.length) partes.push(cur);
  return partes.filter((p) => p.length >= 2);
}

const elements = [];
let id = 1;
for (const linea of (await readFile(new URL('vias.txt', dir), 'utf8')).split('\n')) {
  if (!linea.trim()) continue;
  const [clase, nombre, tipo, superficie, geo] = linea.split('|');
  let la = 0, lo = 0;
  const c = geo.split(';').map((par, k) => {
    const [a, b] = par.split(',').map(Number);
    if (k === 0) { la = a; lo = b; } else { la += a; lo += b; }
    return [la / 1e5, lo / 1e5];
  });
  for (const parte of recortar(c)) {
    const tags = clase === 'w' ? { waterway: tipo } : { highway: tipo };
    if (nombre) tags.name = nombre;
    if (superficie) tags.surface = superficie;
    elements.push({ type: 'way', id: id++, tags, geometry: parte.map(([lat, lon]) => ({ lat, lon })) });
  }
}
for (const linea of (await readFile(new URL('lugares.txt', dir), 'utf8')).split('\n')) {
  if (!linea.trim()) continue;
  const [name, place, lat, lon] = linea.split('|');
  elements.push({ type: 'node', id: id++, lat: Number(lat) / 1e5, lon: Number(lon) / 1e5, tags: { name, place } });
}

const datos = await procesar(elements, async (pts) => pts.map(cota));
datos.meta.fuentes = '© OpenStreetMap contributors (ODbL) · Elevación: Copernicus DEM GLO-90 vía Open-Meteo';
datos.meta.extracto = grilla.fecha;
for (const s of datos.calles) delete s.id;
await writeFile(new URL('../public/data/tambogrande.json', import.meta.url), JSON.stringify(datos));
const est = { bajo: 0, medio: 0, alto: 0 };
for (const s of datos.calles) est[s.s >= 0.6 ? 'alto' : s.s >= 0.35 ? 'medio' : 'bajo']++;
console.log(`Listo: ${datos.calles.length} calles, ${datos.agua.length} cauces, ${datos.lugares.length} lugares. Susceptibilidad:`, est);
