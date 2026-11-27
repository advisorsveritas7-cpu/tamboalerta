import type { NivelAgua, Reporte } from './tipos';
import { MODO_SUPABASE } from './config';

export const NIVELES: Record<NivelAgua, { etiqueta: string; corto: string; color: string; detalle: string }> = {
  tobillos: { etiqueta: 'Hasta los tobillos', corto: '1', color: '#FACC15', detalle: '≈ 10–15 cm · transitable con cuidado' },
  rodillas: { etiqueta: 'Hasta las rodillas', corto: '2', color: '#F97316', detalle: '≈ 40–50 cm · solo vehículos altos' },
  cintura: { etiqueta: 'Cintura / Intransitable', corto: '3', color: '#EF4444', detalle: '≈ 80 cm o más · no cruzar' },
};

export function horaCorta(iso: string) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
  if (min < 1) return `ahora (${hora})`;
  if (min < 60) return `hace ${min} min (${hora})`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h (${hora})`;
  return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
}

export function enlaceReporte(r: Reporte) {
  if (typeof window === 'undefined') return '';
  const u = new URL(window.location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('r', r.id);
  return u.toString();
}

export function enlaceWhatsApp(r: Reporte) {
  const texto =
    `⚠️ *TamboAlerta* – Calle inundada\n` +
    `📍 ${r.lugar}\n` +
    `🌊 Agua: ${NIVELES[r.nivel].etiqueta}\n` +
    (r.descripcion ? `📝 ${r.descripcion}\n` : '') +
    `🕒 ${horaCorta(r.creado)}\n` +
    `🗺️ https://maps.google.com/?q=${r.lat.toFixed(5)},${r.lon.toFixed(5)}\n` +
    (MODO_SUPABASE ? `Ver en el mapa: ${enlaceReporte(r)}\n` : '') +
    `PREVENIR ES PROTEGER VIDAS`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function fechaAviso(iso: string) {
  return new Date(iso).toLocaleString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
}
