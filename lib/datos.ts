/**
 * Capa de datos de reportes y avisos.
 *  - Modo Supabase (si hay NEXT_PUBLIC_SUPABASE_URL y ANON_KEY): base de datos + Storage + Realtime.
 *  - Modo local (sin credenciales): se guarda en este navegador y se sincroniza entre pestañas.
 */
import type { Aviso, Reporte } from './tipos';
import { supabase } from './supabase';
import { blobADataUrl } from './foto';
import { AVISOS_EJEMPLO } from './avisos-ejemplo';

const K_REP = 'ta:reportes';
const K_AV = 'ta:avisos';
const K_MIOS = 'ta:mis-reportes';
const canal = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('tamboalerta') : null;

function leer<T>(k: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function escribir(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    throw new Error('El almacenamiento del navegador está lleno. Borra reportes antiguos o configura Supabase.');
  }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const HACE_72H = () => new Date(Date.now() - 72 * 3600_000).toISOString();

/* ------------------------------ REPORTES ------------------------------ */

export async function listarReportes(): Promise<Reporte[]> {
  const sb = await supabase();
  if (sb) {
    // Los vecinos solo reciben lo aprobado (lo filtra la base de datos); los coordinadores reciben todo.
    const { data, error } = await sb.from('reportes').select('*').gte('creado', HACE_72H()).order('creado', { ascending: false }).limit(500);
    if (error) throw error;
    const ids = new Set((data as Reporte[]).map((r) => r.id));
    // Lo que envié yo y aún espera revisión: solo lo veo en este teléfono, marcado como pendiente.
    const mios = leer<Reporte[]>(K_MIOS, []).filter((r) => r.creado >= HACE_72H() && !ids.has(r.id));
    return [...mios, ...(data as Reporte[])];
  }
  return leer<Reporte[]>(K_REP, []).filter((r) => r.creado >= HACE_72H());
}

/** Coordinador: aprobar un reporte para que todos lo vean. */
export async function aprobarReporte(id: string): Promise<void> {
  const sb = await supabase();
  if (!sb) return;
  const { error } = await sb.from('reportes').update({ aprobado: true, denuncias: 0 }).eq('id', id);
  if (error) throw error;
}

/** Coordinador: borrar un reporte (falso o inadecuado). */
export async function borrarReporte(id: string): Promise<void> {
  const sb = await supabase();
  if (!sb) {
    escribir(K_REP, leer<Reporte[]>(K_REP, []).filter((r) => r.id !== id));
    return;
  }
  const { error } = await sb.from('reportes').delete().eq('id', id);
  if (error) throw error;
}

/** Vecino: denunciar contenido inadecuado. Con 2 denuncias vuelve a revisión. */
export async function denunciarReporte(id: string): Promise<void> {
  const sb = await supabase();
  if (!sb) return;
  const { error } = await sb.rpc('denunciar', { p_id: id });
  if (error) throw error;
}

/** ¿La sesión actual es de un coordinador autorizado? */
export async function soyCoordinador(): Promise<boolean> {
  const sb = await supabase();
  if (!sb) return true;
  const { data, error } = await sb.rpc('es_coordinador');
  // Si la función no existe, la base de datos aún no tiene la revisión (falta ejecutar schema.sql).
  if (error) throw new Error('BASE_SIN_REVISION');
  return data === true;
}

export async function crearReporte(r: Omit<Reporte, 'id' | 'creado' | 'foto_url' | 'video_url'>, foto: Blob | null, video: { blob: Blob; tipo: string } | null = null): Promise<Reporte> {
  const sb = await supabase();
  if (sb) {
    let foto_url: string | null = null;
    if (foto) {
      const ruta = `${new Date().toISOString().slice(0, 10)}/${uid()}.jpg`;
      const { error } = await sb.storage.from('fotos').upload(ruta, foto, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
      foto_url = sb.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
    }
    let video_url: string | null = null;
    if (video) {
      const ext = video.tipo.includes('webm') ? 'webm' : video.tipo.includes('quicktime') ? 'mov' : 'mp4';
      const ruta = `${new Date().toISOString().slice(0, 10)}/${uid()}.${ext}`;
      const { error } = await sb.storage.from('fotos').upload(ruta, video.blob, { contentType: video.tipo, cacheControl: '31536000' });
      if (error) throw error;
      video_url = sb.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
    }
    // Entra sin aprobar: no se puede leer de vuelta hasta que un coordinador lo revise.
    const nuevo: Reporte = { ...r, id: uid(), creado: new Date().toISOString(), foto_url, video_url, aprobado: false, mio: true };
    const { error } = await sb.from('reportes').insert({ ...r, id: nuevo.id, foto_url, ...(video_url ? { video_url } : {}) });
    if (error) throw error;
    try { escribir(K_MIOS, [nuevo, ...leer<Reporte[]>(K_MIOS, [])].slice(0, 20)); } catch {}
    return nuevo;
  }
  // En modo local el video solo se ve en esta sesión (no cabe en el almacenamiento del teléfono).
  const nuevo: Reporte = { ...r, id: uid(), creado: new Date().toISOString(), foto_url: foto ? await blobADataUrl(foto) : null, video_url: video ? URL.createObjectURL(video.blob) : null };
  const todos = [{ ...nuevo, video_url: null }, ...leer<Reporte[]>(K_REP, [])].slice(0, 40);
  escribir(K_REP, todos);
  canal?.postMessage({ tipo: 'reporte', dato: nuevo });
  return nuevo;
}

/** Avisa cuando cambia algo (nuevo, aprobado o borrado) para volver a cargar la lista. */
export function escucharReportes(alCambiar: () => void): () => void {
  const psb = supabase();
  if (psb) {
    let fin = () => {};
    psb.then((sb) => {
      const ch = sb
        .channel('reportes-en-vivo')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, () => alCambiar())
        .subscribe();
      // Respaldo por si el tiempo real se corta: se vuelve a consultar cada minuto.
      const t = setInterval(alCambiar, 60_000);
      fin = () => { clearInterval(t); void sb.removeChannel(ch); };
    });
    return () => fin();
  }
  const f = (e: MessageEvent) => e.data?.tipo === 'reporte' && alCambiar();
  canal?.addEventListener('message', f);
  return () => canal?.removeEventListener('message', f);
}

/* ------------------------------- AVISOS ------------------------------- */

export async function listarAvisos(): Promise<Aviso[]> {
  const sb = await supabase();
  const ahora = new Date().toISOString();
  if (sb) {
    const { data, error } = await sb.from('avisos').select('*').gte('fin', ahora).order('inicio');
    if (error) throw error;
    return data as Aviso[];
  }
  const propios = leer<Aviso[] | null>(K_AV, null);
  return (propios ?? AVISOS_EJEMPLO()).filter((a) => a.fin >= ahora);
}

export async function publicarAviso(a: Omit<Aviso, 'id'>): Promise<Aviso> {
  const sb = await supabase();
  if (sb) {
    const { data, error } = await sb.from('avisos').insert(a).select().single();
    if (error) throw new Error(error.code === '42501' ? 'Solo coordinadores con sesión iniciada pueden publicar avisos.' : error.message);
    return data as Aviso;
  }
  const nuevo = { ...a, id: uid() };
  const actuales = leer<Aviso[] | null>(K_AV, null) ?? [];
  escribir(K_AV, [...actuales.filter((x) => !x.ejemplo), nuevo]);
  canal?.postMessage({ tipo: 'aviso' });
  return nuevo;
}

export async function retirarAviso(id: string): Promise<void> {
  const sb = await supabase();
  if (sb) {
    const { error } = await sb.from('avisos').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const actuales = leer<Aviso[] | null>(K_AV, null) ?? AVISOS_EJEMPLO();
  escribir(K_AV, actuales.filter((x) => x.id !== id));
}

export function escucharAvisos(alCambiar: () => void): () => void {
  const psb = supabase();
  if (psb) {
    let fin = () => {};
    psb.then((sb) => {
      const ch = sb.channel('avisos-en-vivo').on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, alCambiar).subscribe();
      fin = () => void sb.removeChannel(ch);
    });
    return () => fin();
  }
  const f = (e: MessageEvent) => e.data?.tipo === 'aviso' && alCambiar();
  canal?.addEventListener('message', f);
  return () => canal?.removeEventListener('message', f);
}
