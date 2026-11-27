import type { Calle, Reporte } from './tipos';
import { estadoCalle, umbralMm } from './riesgo';

/**
 * Ruta de evacuación: el camino más corto desde donde estás hasta una zona alta segura,
 * evitando las calles que se inundan con la lluvia elegida y las zonas donde los vecinos reportaron agua.
 *
 * Se arma una red con las calles de la ciudad (cada esquina es un nodo) y se busca el camino
 * de menor "costo" (algoritmo de Dijkstra). El costo de cada tramo es su largo multiplicado por
 * una penalidad: una calle que se inunda cuesta muchísimo (solo se usa si no hay otra salida),
 * una calle amarilla cuesta un poco más, y las calles cerca de un reporte de vecinos casi se bloquean.
 */

export type Modo = 'pie' | 'vehiculo';
type P = [number, number];

type Arista = { a: number; b: number; largo: number; calle: number };
export type Red = { pts: P[]; ady: number[][]; aristas: Arista[]; comp: number[]; tamComp: number[]; calles: Calle[] };

export type Paso = { nombre: string; metros: number; estado: 'bajo' | 'moderado' | 'critico' };
export type Ruta = {
  coords: P[];
  metros: number;
  minutos: number;
  metrosInundados: number;
  metrosCuidado: number;
  pasaPorReportes: boolean;
  destino: P;
  alturaDestino: number;
  alturaOrigen: number;
  pasos: Paso[];
  modo: Modo;
};
export type ResultadoRuta = { ok: true; ruta: Ruta } | { ok: false; motivo: 'lejos' | 'seguro' | 'sin-ruta'; alturaOrigen?: number };

const M_LAT = 111320;
const metros = (a: P, b: P) => Math.hypot((a[0] - b[0]) * M_LAT, (a[1] - b[1]) * M_LAT * Math.cos((a[0] * Math.PI) / 180));

/** Proyección de p sobre el segmento a-b: devuelve el punto y la fracción t (0..1). */
function proyectar(p: P, a: P, b: P): { q: P; t: number } {
  const k = Math.cos((a[0] * Math.PI) / 180);
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return { q: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t };
}

const SIN_VEHICULO = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'bridleway', 'corridor']);
const cache = new WeakMap<Calle[], Red>();

/** Arma la red de calles (una sola vez por ciudad). */
export function construirRed(calles: Calle[]): Red {
  const hit = cache.get(calles);
  if (hit) return hit;
  const pts: P[] = [];
  const ady: number[][] = [];
  const aristas: Arista[] = [];
  // Rejilla de ~11 m para unir vértices que están prácticamente en el mismo lugar (esquinas).
  const CEL = 0.0001;
  const rejilla = new Map<string, number[]>();
  const clave = (p: P) => `${Math.floor(p[0] / CEL)},${Math.floor(p[1] / CEL)}`;
  const nodo = (p: P) => {
    const i0 = Math.floor(p[0] / CEL), j0 = Math.floor(p[1] / CEL);
    for (let i = i0 - 1; i <= i0 + 1; i++)
      for (let j = j0 - 1; j <= j0 + 1; j++)
        for (const n of rejilla.get(`${i},${j}`) ?? []) if (metros(pts[n], p) < 6) return n;
    const n = pts.length;
    pts.push(p);
    ady.push([]);
    const k = clave(p);
    (rejilla.get(k) ?? rejilla.set(k, []).get(k)!).push(n);
    return n;
  };
  const unir = (a: number, b: number, calle: number) => {
    if (a === b) return;
    const e = aristas.length;
    aristas.push({ a, b, largo: Math.max(1, metros(pts[a], pts[b])), calle });
    ady[a].push(e);
    ady[b].push(e);
  };
  const extremos: { n: number; calle: number }[] = [];
  calles.forEach((c, ci) => {
    let prev = -1;
    c.c.forEach((p, k) => {
      const n = nodo(p);
      if (prev >= 0) unir(prev, n, ci);
      prev = n;
      if (k === 0 || k === c.c.length - 1) extremos.push({ n, calle: ci });
    });
  });

  // Al simplificar las líneas a veces se pierde el vértice de la esquina: cada extremo de calle
  // se engancha al tramo más cercano de otra calle si está a menos de 20 m.
  const CS = 0.0005; // ~55 m
  const segs = new Map<string, number[]>();
  aristas.forEach((e, i) => {
    const a = pts[e.a], b = pts[e.b];
    const i0 = Math.floor(Math.min(a[0], b[0]) / CS), i1 = Math.floor(Math.max(a[0], b[0]) / CS);
    const j0 = Math.floor(Math.min(a[1], b[1]) / CS), j1 = Math.floor(Math.max(a[1], b[1]) / CS);
    for (let x = i0; x <= i1; x++) for (let y = j0; y <= j1; y++) { const k = `${x},${y}`; (segs.get(k) ?? segs.set(k, []).get(k)!).push(i); }
  });
  const n0 = aristas.length;
  for (const { n, calle } of extremos) {
    if (ady[n].length > 1) continue; // ya está conectado a otra calle
    const p = pts[n];
    let mejor = -1, dmin = 20, qmin: P = p, tmin = 0;
    const ci = Math.floor(p[0] / CS), cj = Math.floor(p[1] / CS);
    const vistos = new Set<number>();
    for (let x = ci - 1; x <= ci + 1; x++)
      for (let y = cj - 1; y <= cj + 1; y++)
        for (const s of segs.get(`${x},${y}`) ?? []) {
          if (s >= n0 || vistos.has(s)) continue;
          vistos.add(s);
          const e = aristas[s];
          if (e.calle === calle || e.a === n || e.b === n) continue;
          const { q, t } = proyectar(p, pts[e.a], pts[e.b]);
          const d = metros(p, q);
          if (d < dmin) { dmin = d; mejor = s; qmin = q; tmin = t; }
        }
    if (mejor < 0) continue;
    const e = aristas[mejor];
    // Se une al extremo del tramo más cercano, o a un nodo nuevo en el punto proyectado.
    const m = tmin < 0.15 ? e.a : tmin > 0.85 ? e.b : (() => {
      const k = pts.length;
      pts.push(qmin);
      ady.push([]);
      unir(e.a, k, e.calle);
      unir(k, e.b, e.calle);
      return k;
    })();
    unir(n, m, e.calle);
  }

  // Componentes conectadas (para no arrancar en un pedacito de calle suelto).
  const comp = new Array(pts.length).fill(-1);
  const tamComp: number[] = [];
  for (let s = 0; s < pts.length; s++) {
    if (comp[s] >= 0) continue;
    const id = tamComp.length;
    let tam = 0;
    const pila = [s];
    comp[s] = id;
    while (pila.length) {
      const u = pila.pop()!;
      tam++;
      for (const ei of ady[u]) {
        const e = aristas[ei];
        const v = e.a === u ? e.b : e.a;
        if (comp[v] < 0) { comp[v] = id; pila.push(v); }
      }
    }
    tamComp.push(tam);
  }
  const red = { pts, ady, aristas, comp, tamComp, calles };
  cache.set(calles, red);
  return red;
}

// Montículo binario mínimo para Dijkstra.
class Monticulo {
  private k: number[] = [];
  private v: number[] = [];
  get size() { return this.k.length; }
  push(n: number, d: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(n); v.push(d);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (v[p] <= v[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const k = this.k, v = this.v;
    const r: [number, number] = [k[0], v[0]];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, d = l + 1;
        let m = i;
        if (l < k.length && v[l] < v[m]) m = l;
        if (d < k.length && v[d] < v[m]) m = d;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return r;
  }
}

const VELOCIDAD = { pie: 65, vehiculo: 250 }; // metros por minuto (≈4 km/h caminando con familia, ≈15 km/h manejando con cuidado)

/**
 * Calcula la ruta de evacuación.
 * @param origen  dónde está la persona [lat, lon]
 * @param lluvia  lluvia elegida en el mapa (mm)
 */
export function rutaEvacuacion(calles: Calle[], origen: P, lluvia: number, modo: Modo, reportes: Reporte[]): ResultadoRuta {
  if (!calles.length) return { ok: false, motivo: 'sin-ruta' };
  const red = construirRed(calles);
  const { pts, ady, aristas, comp, tamComp } = red;

  // Punto de partida: el nodo más cercano, prefiriendo la red principal (no un pedacito suelto).
  const mayor = tamComp.indexOf(Math.max(...tamComp));
  let ini = -1, dIni = Infinity, iniPrincipal = -1, dPrincipal = Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (!ady[i].length) continue;
    const d = metros(origen, pts[i]);
    if (d < dIni) { dIni = d; ini = i; }
    if (comp[i] === mayor && d < dPrincipal) { dPrincipal = d; iniPrincipal = i; }
  }
  if (ini < 0 || dIni > 2500) return { ok: false, motivo: 'lejos' };
  if (tamComp[comp[ini]] < 30 && dPrincipal < dIni + 250) { ini = iniPrincipal; dIni = dPrincipal; }

  // Calle donde está la persona (para saber si ya está en zona segura y su altura).
  const calleDe = (n: number) => calles[aristas[ady[n][0]].calle];
  const zOrigen = calleDe(ini).z;

  // ¿Qué es una "zona alta segura"? Calles que siguen sin peligro aunque llueva bastante más
  // (1,5 veces la lluvia elegida, mínimo 50 mm) y que no están más bajas que la mitad de la ciudad.
  const L = Math.max(lluvia, 50) * 1.5;
  const zs = calles.map((c) => c.z).sort((a, b) => a - b);
  const zMediana = zs[Math.floor(zs.length / 2)];
  const Ts = calles.map((c) => umbralMm(c.s));
  let segura = calles.map((c, i) => Ts[i] >= L && c.z >= zMediana);
  if (segura.filter(Boolean).length < 5) {
    // Con lluvias extremas casi nada es 100 % seguro: se usan las calles más altas y menos expuestas.
    const corte = [...Ts].sort((a, b) => b - a)[Math.max(0, Math.floor(calles.length * 0.1))];
    segura = calles.map((c, i) => Ts[i] >= corte && c.z >= zMediana);
  }

  // Reportes de vecinos: las calles a menos de 150 m de un reporte casi se bloquean.
  const cercaReporte = (p: P) => reportes.some((r) => metros(p, [r.lat, r.lon]) < 150);
  const lejosDeReportes = (p: P) => !reportes.some((r) => metros(p, [r.lat, r.lon]) < 250);

  const nodoSeguro = (n: number) => ady[n].some((ei) => segura[aristas[ei].calle]) && lejosDeReportes(pts[n]);
  const enCalleSegura = ady[ini].every((ei) => estadoCalle(calles[aristas[ei].calle], lluvia) === 'bajo');
  if (enCalleSegura && nodoSeguro(ini) && dIni < 120) return { ok: false, motivo: 'seguro', alturaOrigen: zOrigen };

  // Penalidad de cada calle según la lluvia y el modo.
  const estados = calles.map((c) => estadoCalle(c, lluvia));
  const pen = calles.map((c, i) => {
    if (modo === 'vehiculo' && SIN_VEHICULO.has(c.t)) return Infinity;
    let f = 1;
    if (estados[i] === 'critico') f = modo === 'pie' ? 40 : 80;
    else if (estados[i] === 'moderado') f = modo === 'pie' ? 2.5 : 4;
    if (modo === 'vehiculo' && c.t === 'track') f *= 1.5; // trocha: más lenta y se embarra
    return f;
  });
  const penReporte = new Map<number, number>();
  const factorArista = (ei: number) => {
    let f = penReporte.get(ei);
    if (f == null) {
      const e = aristas[ei];
      const mid: P = [(pts[e.a][0] + pts[e.b][0]) / 2, (pts[e.a][1] + pts[e.b][1]) / 2];
      f = reportes.length && (cercaReporte(mid) || cercaReporte(pts[e.a]) || cercaReporte(pts[e.b])) ? 60 : 1;
      penReporte.set(ei, f);
    }
    return f * pen[aristas[ei].calle];
  };

  // Dijkstra hasta el primer nodo seguro que esté al menos a 150 m.
  const dist = new Float64Array(pts.length).fill(Infinity);
  const geo = new Float64Array(pts.length).fill(0);
  const previo = new Int32Array(pts.length).fill(-1);
  const pq = new Monticulo();
  dist[ini] = 0;
  pq.push(ini, 0);
  let fin = -1;
  while (pq.size) {
    const [u, d] = pq.pop();
    if (d > dist[u]) continue;
    if (geo[u] >= 150 && nodoSeguro(u)) { fin = u; break; }
    for (const ei of ady[u]) {
      const f = factorArista(ei);
      if (!isFinite(f)) continue;
      const e = aristas[ei];
      const v = e.a === u ? e.b : e.a;
      const nd = d + e.largo * f;
      if (nd < dist[v]) { dist[v] = nd; geo[v] = geo[u] + e.largo; previo[v] = ei; pq.push(v, nd); }
    }
  }
  if (fin < 0) return { ok: false, motivo: 'sin-ruta', alturaOrigen: zOrigen };

  // Se reconstruye el camino y se resume en pasos ("Sigue por Jr. Grau 300 m").
  const camino: number[] = [];
  for (let n = fin; n !== ini; ) {
    const ei = previo[n];
    camino.push(ei);
    const e = aristas[ei];
    n = e.a === n ? e.b : e.a;
  }
  camino.reverse();
  const coords: P[] = [origen, pts[ini]];
  let n = ini, total = dIni, inund = 0, cuid = 0, porReporte = false;
  const pasos: Paso[] = [];
  for (const ei of camino) {
    const e = aristas[ei];
    n = e.a === n ? e.b : e.a;
    coords.push(pts[n]);
    total += e.largo;
    const c = calles[e.calle];
    const est = estados[e.calle];
    if (est === 'critico') inund += e.largo;
    else if (est === 'moderado') cuid += e.largo;
    if ((penReporte.get(ei) ?? 1) > 1) porReporte = true;
    const nombre = c.n || 'calle sin nombre';
    const ult = pasos[pasos.length - 1];
    if (ult && ult.nombre === nombre) {
      ult.metros += e.largo;
      if (est === 'critico' || (est === 'moderado' && ult.estado === 'bajo')) ult.estado = est;
    } else pasos.push({ nombre, metros: e.largo, estado: est });
  }
  // Se juntan los tramos muy cortos sin nombre con el paso anterior para que la lista sea clara.
  const limpios: Paso[] = [];
  for (const p of pasos) {
    const ult = limpios[limpios.length - 1];
    if (ult && p.metros < 40 && p.nombre === 'calle sin nombre') { ult.metros += p.metros; continue; }
    limpios.push({ ...p });
  }
  const destinoCalle = calles[aristas[camino[camino.length - 1] ?? ady[fin][0]].calle];
  return {
    ok: true,
    ruta: {
      coords,
      metros: Math.round(total),
      minutos: Math.max(1, Math.round(total / VELOCIDAD[modo])),
      metrosInundados: Math.round(inund),
      metrosCuidado: Math.round(cuid),
      pasaPorReportes: porReporte,
      destino: pts[fin],
      alturaDestino: Math.round(Math.max(destinoCalle.z, ...ady[fin].map((ei) => calles[aristas[ei].calle].z))),
      alturaOrigen: Math.round(zOrigen),
      pasos: limpios.map((p) => ({ ...p, metros: Math.round(p.metros) })),
      modo,
    },
  };
}

/** Enlace para seguir la ruta en Google Maps (con algunos puntos intermedios para que no cambie el camino). */
export function enlaceGoogleMaps(r: Ruta) {
  const f = (p: P) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const o = r.coords[0], d = r.destino;
  const inter = r.coords.slice(1, -1);
  const vias: string[] = [];
  const N = Math.min(3, inter.length);
  for (let i = 1; i <= N; i++) vias.push(f(inter[Math.floor((i * inter.length) / (N + 1))]));
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('origin', f(o));
  u.searchParams.set('destination', f(d));
  if (vias.length) u.searchParams.set('waypoints', vias.join('|'));
  u.searchParams.set('travelmode', r.modo === 'pie' ? 'walking' : 'driving');
  return u.toString();
}

export const textoDistancia = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
