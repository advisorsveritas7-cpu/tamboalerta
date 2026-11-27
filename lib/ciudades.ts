import lista from './ciudades.json';

export type Ciudad = {
  id: string;
  nombre: string;
  corto?: string;
  provincia: string;
  centro: [number, number];
  zoom: number;
  radioKm: number;
};

export const CIUDADES = lista as Ciudad[];
export const CIUDAD_INICIAL = 'tambogrande';
export const ciudadPorId = (id: string | null | undefined) => CIUDADES.find((c) => c.id === id) ?? CIUDADES[0];
export const nombreCorto = (c: Ciudad) => c.corto ?? c.nombre;
