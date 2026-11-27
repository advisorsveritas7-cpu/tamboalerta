// Escala de lluvia en palabras simples para el vecino (acumulado en mm).
export type NivelLluvia = { id: string; nombre: string; mm: number; icono: string; ejemplo: string };

export const NIVELES_LLUVIA: NivelLluvia[] = [
  { id: 'leve', nombre: 'Leve', mm: 10, icono: '🌦️', ejemplo: 'Llovizna o lluvia corta' },
  { id: 'moderada', nombre: 'Moderada', mm: 25, icono: '🌧️', ejemplo: 'Lluvia de varias horas' },
  { id: 'fuerte', nombre: 'Fuerte', mm: 50, icono: '⛈️', ejemplo: 'Aguacero de toda la noche' },
  { id: 'extrema', nombre: 'Extrema', mm: 100, icono: '🌊', ejemplo: 'Como en el Niño Costero 2017' },
];

/** Nombre de la lluvia para cualquier valor en mm. */
export function nombreLluvia(mm: number): string {
  if (mm <= 0) return 'Sin lluvia';
  if (mm < 18) return 'Lluvia leve';
  if (mm < 38) return 'Lluvia moderada';
  if (mm < 75) return 'Lluvia fuerte';
  return 'Lluvia extrema';
}
