export type Calle = {
  id: number;
  n: string | null; // nombre
  t: string; // tipo OSM (residential, track, ...)
  sp: boolean | null; // sin pavimento (null = desconocido)
  c: [number, number][]; // coordenadas [lat, lon]
  z: number; // cota mínima (m s.n.m.)
  d: number; // distancia al cauce/dren más cercano (m)
  h: number; // altura sobre ese cauce (m)
  k: number; // depresión local vs. entorno 300 m (m, negativo = más baja)
  s: number; // susceptibilidad 0..1
};

export type Cauce = { n: string | null; t: 'rio' | 'quebrada' | 'dren' | 'canal'; c: [number, number][] };
export type Lugar = { n: string; t: string; p: [number, number] };
export type DatosTerritorio = { meta: { generado: string; fuentes: string }; calles: Calle[]; agua: Cauce[]; lugares: Lugar[] };

export type NivelAgua = 'tobillos' | 'rodillas' | 'cintura';

export type Reporte = {
  id: string;
  creado: string; // ISO
  lat: number;
  lon: number;
  lugar: string;
  nivel: NivelAgua;
  descripcion: string | null;
  foto_url: string | null;
  video_url?: string | null;
  aprobado?: boolean; // false = esperando revisión de un coordinador
  denuncias?: number;
  mio?: boolean; // enviado desde este teléfono (solo se ve aquí mientras espera revisión)
};

export type NivelAviso = 'amarillo' | 'naranja' | 'rojo';

export type Aviso = {
  id: string;
  nivel: NivelAviso;
  titulo: string;
  numero: string | null; // nº de aviso SENAMHI
  inicio: string; // ISO
  fin: string; // ISO
  lluvia_mm: number; // acumulado esperado
  detalle: string | null;
  ejemplo?: boolean;
};
