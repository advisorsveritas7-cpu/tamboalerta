export const TAMBOGRANDE: [number, number] = [-4.928, -80.344];
export const NOMBRE_APP = 'TamboAlerta';
export const ESLOGAN = 'PREVENIR ES PROTEGER VIDAS';
export const URL_AVISOS_SENAMHI = 'https://www.senamhi.gob.pe/?p=aviso-meteorologico';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const MODO_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
