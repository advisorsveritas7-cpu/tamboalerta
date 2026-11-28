
import { horaActualLima } from './tiempo';

export type Hora = { t: string; temp: number; prob: number; mm: number };
export type Pronostico = {
  actualizado: string;
  actual: { temp: number; humedad: number; mm: number; codigo: number };
  horas: Hora[]; // próximas 48 h
  total48: number; // toda la lluvia de los 7 días
  dias: { fecha: string; mm: number }[]; // lluvia de cada día (hoy desde ahora, y mañana)
  probMax: number;
  offline?: boolean;
};


export async function obtenerPronostico([lat, lon]: [number, number], idCiudad: string): Promise<Pronostico> {
  const CLAVE = `ta:clima:${idCiudad}`;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code' +
    '&hourly=temperature_2m,precipitation_probability,precipitation' +
    '&forecast_days=7&timezone=America%2FLima';
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    // Hoy (desde la hora actual) y mañana completos, en hora de Lima.
    const ahora = horaActualLima();
    const horas: Hora[] = j.hourly.time
      .map((t: string, i: number) => ({
        t,
        temp: j.hourly.temperature_2m[i],
        prob: j.hourly.precipitation_probability[i] ?? 0,
        mm: j.hourly.precipitation[i] ?? 0,
      }))
      .filter((h: Hora) => h.t >= ahora);
    const suma = (hs: Hora[]) => Math.round(hs.reduce((a, h) => a + h.mm, 0) * 10) / 10;
    const p: Pronostico = {
      actualizado: new Date().toISOString(),
      actual: {
        temp: j.current.temperature_2m,
        humedad: j.current.relative_humidity_2m,
        mm: j.current.precipitation,
        codigo: j.current.weather_code,
      },
      horas,
      total48: suma(horas),
      dias: [...new Set(horas.map((h) => h.t.slice(0, 10)))].map((fecha) => ({ fecha, mm: suma(horas.filter((h) => h.t.startsWith(fecha))) })),
      probMax: Math.max(0, ...horas.map((h) => h.prob)),
    };
    try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch {}
    return p;
  } catch (e) {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado) return { ...JSON.parse(guardado), offline: true };
    } catch {}
    throw e;
  }
}

export function describirCodigo(c: number): string {
  if (c === 0) return 'Despejado';
  if (c <= 3) return 'Parcialmente nublado';
  if (c <= 48) return 'Neblina';
  if (c <= 57) return 'Llovizna';
  if (c <= 65) return c >= 65 ? 'Lluvia fuerte' : 'Lluvia';
  if (c <= 67) return 'Lluvia helada';
  if (c <= 82) return c >= 81 ? 'Chubascos fuertes' : 'Chubascos';
  if (c >= 95) return 'Tormenta';
  return 'Nublado';
}
