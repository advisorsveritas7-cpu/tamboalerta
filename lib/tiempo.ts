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

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "sáb 3 p. m." a partir de la hora local que entrega Open-Meteo (America/Lima). */
export function fechaCorta(t: string): string {
  const [f, hm] = t.split('T');
  const [y, m, d] = f.split('-').map(Number);
  const dia = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const h = Number(hm.slice(0, 2));
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${dia} ${h12} ${h < 12 ? 'a. m.' : 'p. m.'}`;
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
