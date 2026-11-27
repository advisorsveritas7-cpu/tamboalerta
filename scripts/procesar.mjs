// Convierte la respuesta de Overpass (OpenStreetMap) + elevaciones (Open-Meteo, DEM Copernicus 90 m)
// en el archivo compacto public/data/tambogrande.json que usa la app.
// Lo usa scripts/generar-datos.mjs. Mantener sin dependencias.

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
export function dist(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function largo(c) {
  let L = 0;
  for (let i = 1; i < c.length; i++) L += dist(c[i - 1], c[i]);
  return L;
}

// Puntos cada `paso` metros a lo largo de una línea (incluye el punto medio como mínimo).
function muestrear(c, paso) {
  const L = largo(c);
  const n = Math.max(1, Math.round(L / paso));
  const out = [];
  for (let k = 0; k < n; k++) {
    const objetivo = ((k + 0.5) / n) * L;
    let acc = 0;
    for (let i = 1; i < c.length; i++) {
      const d = dist(c[i - 1], c[i]);
      if (acc + d >= objetivo || i === c.length - 1) {
        const t = d ? Math.min(1, (objetivo - acc) / d) : 0;
        out.push([c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]);
        break;
      }
      acc += d;
    }
  }
  return out;
}

const r5 = (x) => Math.round(x * 1e5) / 1e5;
const clamp = (x) => Math.max(0, Math.min(1, x));

const SIN_PAVIMENTO = new Set(['unpaved', 'dirt', 'earth', 'ground', 'sand', 'gravel', 'mud', 'compacted', 'fine_gravel']);
const TIPO_AGUA = { river: 'rio', stream: 'quebrada', drain: 'dren', ditch: 'dren', canal: 'canal' };

/**
 * @param elements  elementos de Overpass con `out tags geom`
 * @param elevar    async (puntos [[lat,lon]]) => number[]  (elevación en metros)
 */
export async function procesar(elements, elevar) {
  const calles = [];
  const agua = [];
  const lugares = [];
  for (const e of elements) {
    if (e.type === 'node' && e.tags?.place && e.tags?.name) {
      lugares.push({ n: e.tags.name, t: e.tags.place, p: [r5(e.lat), r5(e.lon)] });
    } else if (e.type === 'way' && e.geometry) {
      const c = e.geometry.map((g) => [r5(g.lat), r5(g.lon)]);
      if (e.tags?.waterway && TIPO_AGUA[e.tags.waterway]) {
        agua.push({ n: e.tags.name || null, t: /^quebrada/i.test(e.tags.name || '') ? 'quebrada' : TIPO_AGUA[e.tags.waterway], c });
      } else if (e.tags?.highway) {
        calles.push({
          id: e.id,
          n: e.tags.name || null,
          t: e.tags.highway,
          sp: e.tags.surface ? SIN_PAVIMENTO.has(e.tags.surface) : ['track', 'unclassified', 'residential'].includes(e.tags.highway) ? null : false,
          c,
        });
      }
    }
  }

  // 1. Muestras de elevación: calles cada 120 m, cauces cada 150 m.
  const mCalles = calles.map((s) => muestrear(s.c, 120));
  const mAgua = agua.map((w) => muestrear(w.c, 150));
  const todos = [...mCalles.flat(), ...mAgua.flat()];
  const z = await elevar(todos);
  let i = 0;
  const zCalles = mCalles.map((m) => m.map(() => z[i++]));
  const ptsAgua = [];
  mAgua.forEach((m, wi) => m.forEach((p) => {
    const zz = z[i++];
    if (Number.isFinite(zz)) ptsAgua.push({ p, z: zz, t: agua[wi].t });
  }));

  // 2. Rasgos topográficos por calle.
  const centros = calles.map((s, k) => {
    const m = mCalles[k];
    return m[Math.floor(m.length / 2)];
  });
  const zMin = zCalles.map((zs) => {
    const ok = zs.filter(Number.isFinite);
    return ok.length ? Math.min(...ok) : NaN;
  });
  for (let k = 0; k < calles.length; k++) {
    const s = calles[k];
    // distancia y desnivel respecto del cauce/dren más cercano
    let dMin = Infinity, zAgua = null;
    for (const m of mCalles[k]) {
      for (const w of ptsAgua) {
        const d = dist(m, w.p);
        if (d < dMin) { dMin = d; zAgua = w.z; }
      }
    }
    // depresión local ("cuenca ciega"): cota de la calle vs mediana de su entorno (300 m)
    const vecinos = [];
    if (!Number.isFinite(zMin[k])) continue;
    for (let j = 0; j < calles.length; j++) {
      if (j !== k && Number.isFinite(zMin[j]) && dist(centros[k], centros[j]) < 300) vecinos.push(zMin[j]);
    }
    vecinos.sort((a, b) => a - b);
    const mediana = vecinos.length ? vecinos[Math.floor(vecinos.length / 2)] : zMin[k];
    s.z = Math.round(zMin[k] * 10) / 10;
    s.d = Number.isFinite(dMin) ? Math.round(dMin) : 9999;
    s.h = zAgua == null ? 99 : Math.round((zMin[k] - zAgua) * 10) / 10;
    s.k = Math.round((zMin[k] - mediana) * 10) / 10;
  }

  // 3. Susceptibilidad 0..1 (modelo simplificado, ver lib/riesgo.ts)
  const conCota = calles.filter((s) => Number.isFinite(s.z));
  calles.length = 0;
  calles.push(...conCota);
  for (const s of calles) {
    const fH = clamp(1 - Math.max(0, s.h) / 8);
    const fD = clamp(1 - s.d / 400);
    const fK = clamp(-s.k / 3);
    const fS = s.sp === true ? 1 : s.sp === null ? 0.6 : 0.2;
    let v = 0.4 * fH + 0.25 * fD + 0.25 * fK + 0.1 * fS;
    // El DEM no "ve" los puentes (van por encima del cauce): se atenúa su susceptibilidad.
    if (/^puente/i.test(s.n || '')) v *= 0.4;
    s.s = Math.round(v * 100) / 100;
  }

  return {
    meta: {
      generado: new Date().toISOString(),
      fuentes: '© OpenStreetMap contributors (ODbL) · Elevación: Open-Meteo / Copernicus DEM GLO-90',
    },
    calles,
    agua,
    lugares,
  };
}
