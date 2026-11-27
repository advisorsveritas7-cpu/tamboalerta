// Genera public/data/<ciudad>.json con calles, cauces y lugares de OpenStreetMap
// y relieve del DEM Copernicus GLO-90 (vía Open-Meteo), para una ciudad de lib/ciudades.json.
// Uso:  node scripts/generar-ciudad.mjs piura        (necesita internet; corre en GitHub Actions)
import { readFile, writeFile } from 'node:fs/promises';
import { procesar } from './procesar.mjs';

const CIUDADES = JSON.parse(await readFile(new URL('../lib/ciudades.json', import.meta.url), 'utf8'));
const id = process.argv[2];
const ciudad = CIUDADES.find((c) => c.id === id);
if (!ciudad) throw new Error(`Ciudad desconocida: ${id}. Opciones: ${CIUDADES.map((c) => c.id).join(', ')}`);

const [la, lo] = ciudad.centro;
const caja = (km) => {
  const dla = km / 111.32, dlo = km / (111.32 * Math.cos((la * Math.PI) / 180));
  return [la - dla, lo - dlo, la + dla, lo + dlo];
};
const fmt = (b) => b.map((x) => x.toFixed(4)).join(',');
const bCalles = caja(ciudad.radioKm);
const bAgua = caja(ciudad.radioKm + 3);
const bLugares = caja(ciudad.radioKm + 12);
// En ciudades grandes se omiten pasajes de servicio y trochas para que el mapa siga liviano.
const grande = ciudad.radioKm >= 4;
const tipos = grande
  ? 'primary|secondary|tertiary|unclassified|residential|living_street|trunk|road|pedestrian'
  : 'primary|secondary|tertiary|unclassified|residential|living_street|service|track|trunk|road|pedestrian';

const query = `[out:json][timeout:240];(
way["highway"~"^(${tipos})$"](${fmt(bCalles)});
way["waterway"~"^(river|stream|drain|ditch|canal)$"](${fmt(bAgua)});
node["place"~"^(city|town|village|hamlet|suburb|neighbourhood|quarter|isolated_dwelling|locality)$"](${fmt(bLugares)});
);out tags geom;`;

const ESPEJOS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass() {
  for (let intento = 0; intento < 3; intento++) {
    for (const url of ESPEJOS) {
      try {
        console.log(`Overpass: ${url}`);
        const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'User-Agent': 'TamboAlerta/1.0 (github.com/advisorsveritas7-cpu/tamboalerta)' } });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!j.elements?.length) throw new Error('vacío');
        return j.elements;
      } catch (e) {
        console.log(`  falló (${e.message})`);
      }
    }
    await espera(20000);
  }
  throw new Error('Ningún servidor Overpass respondió');
}

// Relieve: grilla de ~165 m sobre el área de cauces, consultada por lotes de 100 puntos
// (Open-Meteo admite unos 600 puntos por minuto), e interpolación bilineal.
const ST = 0.0015;
async function grillaElevacion(b) {
  const [la0, lo0, la1, lo1] = b;
  const NR = Math.ceil((la1 - la0) / ST) + 1, NC = Math.ceil((lo1 - lo0) / ST) + 1;
  const pts = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) pts.push([la0 + i * ST, lo0 + j * ST]);
  const z = [];
  for (let k = 0; k < pts.length; k += 100) {
    const lote = pts.slice(k, k + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lote.map((p) => p[0].toFixed(5)).join(',')}&longitude=${lote.map((p) => p[1].toFixed(5)).join(',')}`;
    for (let intento = 0; ; intento++) {
      const t0 = Date.now();
      const r = await fetch(url).catch(() => null);
      if (r?.ok) {
        z.push(...(await r.json()).elevation);
        await espera(Math.max(0, 10500 - (Date.now() - t0)));
        break;
      }
      if (intento > 12) throw new Error(`Open-Meteo elevación ${r?.status}`);
      console.log(`  elevación ${r?.status ?? 'sin red'}, reintento en 30 s`);
      await espera(30000);
    }
    console.log(`  relieve ${z.length}/${pts.length}`);
  }
  return { la0, lo0, NR, NC, z };
}
function interpolar(g, [la, lo]) {
  const fi = (la - g.la0) / ST, fj = (lo - g.lo0) / ST;
  if (fi < 0 || fj < 0 || fi > g.NR - 1 || fj > g.NC - 1) return NaN;
  const i = Math.min(g.NR - 2, Math.floor(fi)), j = Math.min(g.NC - 2, Math.floor(fj));
  const di = fi - i, dj = fj - j, v = (a, c) => g.z[a * g.NC + c];
  return v(i, j) * (1 - di) * (1 - dj) + v(i, j + 1) * (1 - di) * dj + v(i + 1, j) * di * (1 - dj) + v(i + 1, j + 1) * di * dj;
}

// Simplificación Douglas-Peucker (~3 m) para aligerar el archivo.
function simplificar(c, tol = 0.00003) {
  if (c.length <= 2) return c;
  const [a, b] = [c[0], c[c.length - 1]];
  let dmax = 0, idx = 0;
  for (let i = 1; i < c.length - 1; i++) {
    const p = c[i];
    const dx = b[1] - a[1], dy = b[0] - a[0];
    const L = Math.hypot(dx, dy) || 1e-12;
    const d = Math.abs(dy * p[1] - dx * p[0] + b[1] * a[0] - b[0] * a[1]) / L;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= tol) return [a, b];
  return [...simplificar(c.slice(0, idx + 1), tol).slice(0, -1), ...simplificar(c.slice(idx), tol)];
}

console.log(`== ${ciudad.nombre} ==`);
const elements = await overpass();
console.log(`${elements.length} elementos de OpenStreetMap`);
for (const e of elements) {
  if (e.type === 'way' && e.geometry) {
    const s = simplificar(e.geometry.map((g) => [g.lat, g.lon]));
    e.geometry = s.map(([lat, lon]) => ({ lat, lon }));
  }
}
const g = await grillaElevacion(bAgua);
const datos = await procesar(elements, async (pts) => pts.map((p) => interpolar(g, p)));
datos.meta.ciudad = ciudad.id;
// Cauces largos (Río Piura, Chira): solo el tramo cercano a la ciudad.
const [a0, o0, a1, o1] = bAgua;
const dentro = ([x, y]) => x >= a0 && x <= a1 && y >= o0 && y <= o1;
datos.agua = datos.agua.flatMap((w) => {
  const partes = [];
  let cur = [];
  w.c.forEach((p, k) => {
    if (dentro(p) || (k > 0 && dentro(w.c[k - 1])) || (k < w.c.length - 1 && dentro(w.c[k + 1]))) cur.push(p);
    else if (cur.length) { partes.push(cur); cur = []; }
  });
  if (cur.length) partes.push(cur);
  return partes.filter((c) => c.length >= 2).map((c) => ({ ...w, c }));
});
await writeFile(new URL(`../public/data/${ciudad.id}.json`, import.meta.url), JSON.stringify(datos));
console.log(`Listo: ${datos.calles.length} calles, ${datos.agua.length} cauces, ${datos.lugares.length} lugares`);
