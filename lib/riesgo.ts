import type { Calle } from './tipos';

/**
 * Modelo simplificado de anegamiento por topografía (NO calibrado con eventos reales).
 *
 * Cada calle trae una susceptibilidad s ∈ [0,1] calculada en scripts/procesar.mjs:
 *   s = 0.40·(cercanía vertical al cauce: 0 m → 1, ≥ 8 m → 0)
 *     + 0.25·(cercanía horizontal a río/quebrada/dren: 0 m → 1, ≥ 400 m → 0)
 *     + 0.25·(depresión local o "cuenca ciega": ≥ 3 m bajo su entorno → 1)
 *     + 0.10·(calle sin pavimento)
 *
 * Umbral de lluvia acumulada (mm) a partir del cual la calle se anega:
 *   T(s) = 15 + 105·(1 − s)^1.3     → calle muy susceptible ≈ 15 mm, calle alta y lejos ≈ 120 mm
 */
export function umbralMm(s: number) {
  return 15 + 105 * Math.pow(1 - s, 1.3);
}

export type Estado = 'bajo' | 'moderado' | 'critico';

export function estadoCalle(c: Calle, lluviaMm: number): Estado {
  const T = umbralMm(c.s);
  if (lluviaMm >= T) return 'critico';
  if (lluviaMm >= 0.6 * T) return 'moderado';
  return 'bajo';
}

export const COLOR_ESTADO: Record<Estado, string> = {
  bajo: '#22C55E',
  moderado: '#FACC15',
  critico: '#EF4444',
};

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  bajo: 'Sin peligro',
  moderado: 'Cuidado',
  critico: 'Se inunda',
};
