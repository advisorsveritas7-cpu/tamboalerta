// Regenera public/data/tambogrande.json con calles, cauces y caseríos reales de OpenStreetMap
// y elevaciones del DEM Copernicus (vía Open-Meteo).   Uso:  npm run datos
import { writeFile } from 'node:fs/promises';
import { procesar } from './procesar.mjs';

const OVERPASS = process.env.OVERPASS_URL || 'https://overpass.private.coffee/api/interpreter';
// Casco urbano de Tambogrande + asentamientos humanos alrededor.
const CALLES_BBOX = '-4.975,-80.385,-4.895,-80.305';
// Río Piura, quebradas (San Francisco, etc.), drenes y canales.
const AGUA_BBOX = '-5.02,-80.42,-4.86,-80.20';
// Caseríos del distrito (Cruceta, Malingas, Locuto, Pedregal, ...).
const LUGARES_BBOX = '-5.10,-80.50,-4.80,-80.10';

const query = `[out:json][timeout:170];(
way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|service|track|trunk|road|pedestrian)$"](${CALLES_BBOX});
way["waterway"](${AGUA_BBOX});
node["place"](${LUGARES_BBOX});
);out tags geom;`;

async function elevar(puntos) {
  const z = [];
  for (let i = 0; i < puntos.length; i += 100) {
    const lote = puntos.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lote.map((p) => p[0].toFixed(5)).join(',')}&longitude=${lote.map((p) => p[1].toFixed(5)).join(',')}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Open-Meteo elevación ${r.status}`);
    z.push(...(await r.json()).elevation);
    process.stdout.write(`\relevaciones ${z.length}/${puntos.length}`);
  }
  console.log();
  return z;
}

console.log('Descargando OpenStreetMap…');
const r = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(query) });
if (!r.ok) throw new Error(`Overpass ${r.status}`);
const { elements } = await r.json();
console.log(`${elements.length} elementos`);
const datos = await procesar(elements, elevar);
await writeFile(new URL('../public/data/tambogrande.json', import.meta.url), JSON.stringify(datos));
console.log(`Listo: ${datos.calles.length} calles, ${datos.agua.length} cauces, ${datos.lugares.length} lugares`);
