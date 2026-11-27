import type { Aviso } from './tipos';

/**
 * Avisos de EJEMPLO para el modo local. No son avisos oficiales: sirven para probar las tarjetas
 * y el cálculo de impacto. El coordinador los reemplaza publicando el aviso vigente de SENAMHI.
 */
export const AVISOS_EJEMPLO = (): Aviso[] => {
  const h = (x: number) => new Date(Date.now() + x * 3600_000).toISOString();
  return [
    {
      id: 'ejemplo-naranja',
      nivel: 'naranja',
      numero: null,
      titulo: 'Precipitaciones de moderada a fuerte intensidad en la sierra y costa norte',
      inicio: h(-6),
      fin: h(42),
      lluvia_mm: 45,
      detalle: 'EJEMPLO. Acumulados de hasta 45 mm/día con descargas eléctricas y ráfagas de viento.',
      ejemplo: true,
    },
    {
      id: 'ejemplo-amarillo',
      nivel: 'amarillo',
      numero: null,
      titulo: 'Lluvias ligeras a moderadas en la costa de Piura',
      inicio: h(42),
      fin: h(66),
      lluvia_mm: 20,
      detalle: 'EJEMPLO. Lluvias dispersas por la tarde y noche.',
      ejemplo: true,
    },
  ];
};
