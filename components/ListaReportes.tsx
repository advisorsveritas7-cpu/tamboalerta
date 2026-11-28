'use client';
import { useMemo, useState } from 'react';
import type { Reporte } from '@/lib/tipos';
import { NIVELES, enlaceWhatsApp, horaCorta } from '@/lib/formato';
import { MODO_SUPABASE } from '@/lib/config';
import { CIUDADES, nombreCorto } from '@/lib/ciudades';

// "Ahora en vivo": fotos y videos de calles inundadas enviados por los vecinos, el más reciente arriba.

function hace(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

function ciudadCercana(r: Reporte) {
  let mejor = CIUDADES[0], dmin = Infinity;
  for (const c of CIUDADES) {
    const d = (c.centro[0] - r.lat) ** 2 + (c.centro[1] - r.lon) ** 2;
    if (d < dmin) { dmin = d; mejor = c; }
  }
  return mejor;
}

type Props = {
  reportes: Reporte[]; // aprobados (los ve todo el mundo)
  pendientes: Reporte[]; // enviados desde este teléfono, esperando revisión
  porRevisar: Reporte[]; // solo coordinadores
  coordinador: boolean;
  onVer: (r: Reporte) => void;
  onAprobar: (id: string) => void;
  onBorrar: (id: string) => void;
  onDenunciar: (id: string) => void;
  onIngresar: () => void;
};

function leerDenunciados(): string[] {
  try { return JSON.parse(localStorage.getItem('ta:denunciados') || '[]'); } catch { return []; }
}

function Medio({ r, onVer }: { r: Reporte; onVer?: () => void }) {
  if (r.video_url) return <video src={r.video_url} controls playsInline muted preload="metadata" className="max-h-72 w-full bg-black" />;
  if (r.foto_url)
    return onVer ? (
      <button type="button" onClick={onVer} className="block w-full" aria-label={`Ver ${r.lugar} en el mapa`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.foto_url} alt={`Foto de ${r.lugar}`} loading="lazy" className="max-h-72 w-full object-cover" />
      </button>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={r.foto_url} alt={`Foto de ${r.lugar}`} loading="lazy" className="max-h-72 w-full object-cover" />
    );
  return <div className="grid h-20 place-items-center text-3xl">🌊</div>;
}

export function ListaReportes({ reportes, pendientes, porRevisar, coordinador, onVer, onAprobar, onBorrar, onDenunciar, onIngresar }: Props) {
  const [filtro, setFiltro] = useState<string>('todas');
  const [denunciados, setDenunciados] = useState<string[]>(leerDenunciados);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const denunciar = (id: string) => {
    const n = [...denunciados, id];
    setDenunciados(n);
    try { localStorage.setItem('ta:denunciados', JSON.stringify(n)); } catch {}
    onDenunciar(id);
  };
  const botonBorrar = (id: string) => (
    <button
      type="button"
      onClick={() => (confirmar === id ? (setConfirmar(null), onBorrar(id)) : setConfirmar(id))}
      className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${confirmar === id ? 'bg-aviso-rojo text-white' : 'border border-aviso-rojo/60 text-aviso-rojo'}`}
    >
      {confirmar === id ? '¿Seguro? Toca para borrar' : '🗑️ Borrar'}
    </button>
  );
  const conCiudad = useMemo(() => reportes.map((r) => ({ r, c: ciudadCercana(r) })), [reportes]);
  const ciudades = [...new Map(conCiudad.map(({ c }) => [c.id, c])).values()];
  const visibles = conCiudad.filter(({ c }) => filtro === 'todas' || c.id === filtro);

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800 p-4" aria-labelledby="rep-lista">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aviso-rojo opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-aviso-rojo" />
        </span>
        <h2 id="rep-lista" className="font-display text-base font-extrabold text-white">Ahora en vivo</h2>
        <span className="ml-auto text-[11px] text-texto-sec">últimas 72 h</span>
      </div>
      <p className="mt-0.5 text-[11px] text-texto-sec">Fotos y videos de calles inundadas enviados por los vecinos y revisados por un coordinador.</p>
      {!MODO_SUPABASE && (
        <p className="mt-1 text-[11px] text-aviso-naranja">Modo local: por ahora solo ves los reportes de este teléfono.</p>
      )}

      {/* Coordinadores: envíos esperando revisión */}
      {coordinador && (
        <div className="mt-3 rounded-xl border border-aviso-amarillo/50 bg-aviso-amarillo/10 p-3">
          <p className="font-display text-sm font-extrabold text-white">🔔 Por revisar ({porRevisar.length})</p>
          <p className="text-[11px] text-texto-sec">Nadie los ve hasta que los apruebes. Borra lo falso o inadecuado.</p>
          {porRevisar.length === 0 && <p className="mt-2 text-xs text-texto-sec">No hay envíos pendientes.</p>}
          <ul className="mt-2 flex flex-col gap-3">
            {porRevisar.map((r) => (
              <li key={r.id} className="overflow-hidden rounded-xl bg-navy-700">
                <div className="relative bg-navy-600">
                  <Medio r={r} />
                  <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-navy-900 shadow" style={{ background: NIVELES[r.nivel].color }}>
                    {NIVELES[r.nivel].etiqueta}
                  </span>
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{hace(r.creado)}</span>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-white">{r.lugar}</p>
                  <p className="text-[11px] text-texto-sec">
                    📍 {nombreCorto(ciudadCercana(r))} · {horaCorta(r.creado)}
                    {r.descripcion ? ` · ${r.descripcion}` : ''}
                    {r.denuncias ? ` · 🚩 ${r.denuncias} denuncias` : ''}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => onAprobar(r.id)} className="flex-1 rounded-lg bg-[#22C55E] py-1.5 text-xs font-extrabold text-navy-900">
                      ✅ Aprobar
                    </button>
                    {botonBorrar(r.id)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lo que envié desde este teléfono y espera revisión */}
      {pendientes.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/10 bg-navy-700/60 p-3">
          <p className="text-xs font-bold text-white">⏳ Tus envíos en revisión ({pendientes.length})</p>
          <p className="text-[11px] text-texto-sec">Se publicarán para todos cuando un coordinador los apruebe.</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {pendientes.map((r) => (
              <li key={r.id} className="truncate text-[11px] text-texto-sec">
                • {r.lugar} · {NIVELES[r.nivel].etiqueta} · {horaCorta(r.creado)}
                {r.video_url ? ' · 🎥' : r.foto_url ? ' · 📷' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ciudades.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {[{ id: 'todas', nombre: 'Todas' }, ...ciudades.map((c) => ({ id: c.id, nombre: nombreCorto(c) }))].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFiltro(c.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${filtro === c.id ? 'bg-cian text-navy-900' : 'bg-navy-700 text-texto-sec'}`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="mt-3 text-sm text-texto-sec">Todavía no hay reportes. Si ves una calle inundada, toca “Reportar Calle Inundada” y envía una foto o video.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {visibles.map(({ r, c }) => {
            const n = NIVELES[r.nivel];
            return (
              <li key={r.id} className="overflow-hidden rounded-xl bg-navy-700">
                <div className="relative bg-navy-600">
                  <Medio r={r} onVer={() => onVer(r)} />
                  <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-navy-900 shadow" style={{ background: n.color }}>
                    {n.etiqueta}
                  </span>
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{hace(r.creado)}</span>
                </div>
                <div className="p-3">
                  <p className="font-semibold text-white">{r.lugar}</p>
                  <p className="text-[11px] text-texto-sec">
                    📍 {nombreCorto(c)} · {horaCorta(r.creado)}
                    {r.descripcion ? ` · ${r.descripcion}` : ''}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => onVer(r)} className="flex-1 rounded-lg border border-cian/50 py-1.5 text-xs font-bold text-cian">
                      Ver en el mapa
                    </button>
                    <a href={enlaceWhatsApp(r)} target="_blank" rel="noopener" className="flex-1 rounded-lg bg-[#25D366] py-1.5 text-center text-xs font-bold text-navy-900">
                      Compartir por WhatsApp
                    </a>
                  </div>
                  {coordinador ? (
                    <div className="mt-2 flex">{botonBorrar(r.id)}</div>
                  ) : MODO_SUPABASE && (
                    <button
                      type="button"
                      disabled={denunciados.includes(r.id)}
                      onClick={() => denunciar(r.id)}
                      className="mt-2 text-[11px] text-texto-sec underline disabled:no-underline disabled:opacity-60"
                    >
                      {denunciados.includes(r.id) ? 'Denunciado. Gracias.' : '🚩 Denunciar contenido inadecuado'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {MODO_SUPABASE && !coordinador && (
        <button type="button" onClick={onIngresar} className="mt-4 w-full text-center text-[11px] text-texto-sec underline underline-offset-2">
          Soy coordinador: revisar envíos
        </button>
      )}
    </section>
  );
}
