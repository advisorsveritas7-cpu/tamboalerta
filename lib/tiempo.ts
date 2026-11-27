import type { Hora } from './clima';

// Tiempo estimado de inundación según el pronóstico hora por hora (aproximado, modelo no calibrado).

/** Lluvia acumulada (mm) al final de cada hora del pronóstico. */
export function acumulado(horas: Hora[]): number[] {
  let s = 0;
  return horas.map((h) => Math.round((s += h.mm) * 10) / 10);
}

/** Índice de la primera hora en que el acumulado alcanza el umbral, o null si no llega en 48 h. */
export function horaQueLlega(umbral: number, acum: number[]): number | null {
  for (let i = 0; i < acum.length; i++) if (acum[i] >= umbral) return i;
  return null;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Fecha de hoy en Lima como "AAAA-MM-DD". */
export function hoyLima(): string {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
}
/** Hora actual de Lima como "AAAA-MM-DDTHH:00", para comparar con las horas del pronóstico. */
export function horaActualLima(): string {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 13) + ':00';
}

/** "hoy 27 de noviembre", "mañana 28 de noviembre" o "sábado 29 de noviembre". */
export function fechaDia(t: string, corto = false): string {
  const f = t.slice(0, 10);
  const [y, m, d] = f.split('-').map(Number);
  const hoy = hoyLima();
  const manana = new Date(Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10) + 1)).toISOString().slice(0, 10);
  const pre = f === hoy ? 'hoy' : f === manana ? 'mañana' : DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${pre} ${d}${corto ? ' ' + MESES[m - 1].slice(0, 3) : ' de ' + MESES[m - 1]}`;
}

/** "en la madrugada", "en la mañana", "en la tarde" o "en la noche". */
export function parteDia(t: string): string {
  const h = Number(t.slice(11, 13));
  return h < 6 ? 'en la madrugada' : h < 12 ? 'en la mañana' : h < 19 ? 'en la tarde' : 'en la noche';
}

/** "mañana 28 de noviembre en la tarde" */
export function cuandoDia(t: string, corto = false): string {
  return `${fechaDia(t, corto)} ${parteDia(t)}`;
}

/** "hoy 27 nov, 3 p. m." (para la línea de tiempo). */
export function fechaCorta(t: string): string {
  const h = Number(t.slice(11, 13));
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${fechaDia(t, true)}, ${h12} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** "en 14 h" / "en menos de 1 h" relativo a ahora. */
export function enCuanto(t: string): string {
  const [f, hm] = t.split('T');
  const [y, m, d] = f.split('-').map(Number);
  // Hora de Lima = UTC-5
  const ms = Date.UTC(y, m - 1, d, Number(hm.slice(0, 2)) + 5, Number(hm.slice(3, 5)));
  const horas = Math.round((ms - Date.now()) / 3600e3);
  if (horas <= 0) return 'ya';
  if (horas === 1) return 'en 1 h';
  return `en ${horas} h`;
}

/** Minutos que tarda en juntarse el umbral si cae un aguacero de `mmPorHora`. */
export function minutosConAguacero(umbral: number, mmPorHora = 20): number {
  return Math.round((umbral / mmPorHora) * 60);
}

export function textoMinutos(min: number): string {
  if (min < 60) return `${min} minutos`;
  const h = Math.floor(min / 60), r = min % 60;
  return r >= 15 ? `${h} h ${r} min` : `${h} ${h === 1 ? 'hora' : 'horas'}`;
}
