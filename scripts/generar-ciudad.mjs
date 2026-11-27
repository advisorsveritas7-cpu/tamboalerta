// Genera public/data/<ciudad>.json con calles, cauces y lugares de OpenStreetMap
// y relieve del DEM Copernicus GLO-90 (vía Open-Meteo), para una ciudad de lib/ciudades.json.
// Uso:  node scripts/generar-ciudad.mjs piura        (necesita internet; corre en GitHub Actions)
import { readFile, writeFile } from 'node:fs/promises';
import { procesar } from './procesar.mjs';
import { inflateSync } from 'node:zlib';

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

// Relieve: grilla de ~165 m sobre el área de cauces. Se lee de las teselas de elevación
// abiertas "Terrarium" (AWS Open Data, SRTM/Copernicus), sin límite de consultas.
// Si fallan, se usa Open-Meteo (Copernicus GLO-90), que limita las consultas por hora.
const ST = 0.0015;
function decodificarPNG(buf) {
  let p = 8, ancho = 0, alto = 0, tipo = 0;
  const idat = [];
  while (p < buf.length) {
    const largo = buf.readUInt32BE(p), nombre = buf.toString('ascii', p + 4, p + 8);
    const datos = buf.subarray(p + 8, p + 8 + largo);
    if (nombre === 'IHDR') { ancho = datos.readUInt32BE(0); alto = datos.readUInt32BE(4); tipo = datos[9]; if (datos[8] !== 8) throw new Error('PNG no soportado'); }
    else if (nombre === 'IDAT') idat.push(datos);
    p += 12 + largo;
  }
  const bpp = tipo === 6 ? 4 : tipo === 2 ? 3 : (() => { throw new Error('PNG tipo ' + tipo); })();
  const crudo = inflateSync(Buffer.concat(idat));
  const fila = ancho * bpp, out = Buffer.alloc(alto * fila);
  for (let y = 0; y < alto; y++) {
    const f = crudo[y * (fila + 1)], src = crudo.subarray(y * (fila + 1) + 1, (y + 1) * (fila + 1));
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? out[y * fila + x - bpp] : 0, b = y > 0 ? out[(y - 1) * fila + x] : 0, c = x >= bpp && y > 0 ? out[(y - 1) * fila + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * fila + x] = v & 255;
    }
  }
  return { ancho, bpp, px: out };
}

const Z = 13;
const teselas = new Map();
async function tesela(x, y) {
  const k = `${x}/${y}`;
  if (!teselas.has(k)) {
    teselas.set(k, (async () => {
      for (let i = 0; i < 5; i++) {
        const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`).catch(() => null);
        if (r?.ok) return decodificarPNG(Buffer.from(await r.arrayBuffer()));
        await espera(3000);
      }
      throw new Error('tesela ' + k);
    })());
  }
  return teselas.get(k);
}
async function cotaTerrarium(la, lo) {
  const n = 2 ** Z;
  const fx = ((lo + 180) / 360) * n;
  const r = (la * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const t = await tesela(tx, ty);
  const px = Math.min(255, Math.floor((fx - tx) * 256)), py = Math.min(255, Math.floor((fy - ty) * 256));
  const o = (py * t.ancho + px) * t.bpp;
  return t.px[o] * 256 + t.px[o + 1] + t.px[o + 2] / 256 - 32768;
}

async function grillaElevacion(b) {
  const [la0, lo0, la1, lo1] = b;
  const NR = Math.ceil((la1 - la0) / ST) + 1, NC = Math.ceil((lo1 - lo0) / ST) + 1;
  const pts = [];
  for (let i = 0; i < NR; i++) for (let j = 0; j < NC; j++) pts.push([la0 + i * ST, lo0 + j * ST]);
  try {
    const z = [];
    for (const [la, lo] of pts) z.push(Math.round((await cotaTerrarium(la, lo)) * 10) / 10);
    console.log(`  relieve Terrarium: ${pts.length} puntos, ${teselas.size} teselas`);
    return { la0, lo0, NR, NC, z };
  } catch (e) {
    console.log(`  Terrarium falló (${e.message}), uso Open-Meteo`);
  }
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
