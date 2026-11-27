'use client';
import type { Reporte } from '@/lib/tipos';
import { NIVELES, enlaceWhatsApp, horaCorta } from '@/lib/formato';
import { MODO_SUPABASE } from '@/lib/config';

export function ListaReportes({ reportes, onVer }: { reportes: Reporte[]; onVer: (r: Reporte) => void }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800 p-4" aria-labelledby="rep-lista">
      <h2 id="rep-lista" className="font-display text-sm font-bold uppercase tracking-wider text-texto-sec">
        Reportes ciudadanos · últimas 72 h
      </h2>
      {!MODO_SUPABASE && (
        <p className="mt-1 text-[11px] text-aviso-naranja">Modo local: los reportes se guardan solo en este teléfono hasta conectar Supabase.</p>
      )}
      {reportes.length === 0 ? (
        <p className="mt-3 text-sm text-texto-sec">Todavía no hay reportes. Si ves una calle inundada, usa el botón “Reportar Calle Inundada”.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {reportes.map((r) => {
            const n = NIVELES[r.nivel];
            return (
              <li key={r.id} className="flex gap-3 rounded-xl bg-navy-700 p-2">
                <button type="button" onClick={() => onVer(r)} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-navy-600" aria-label={`Ver ${r.lugar} en el mapa`}>
                  {r.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.foto_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-2xl">🌊</span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-navy-900" style={{ background: n.color }}>
                    {n.etiqueta}
                  </span>
                  <p className="truncate text-sm font-semibold text-white">{r.lugar}</p>
                  <p className="text-[11px] text-texto-sec">
                    {horaCorta(r.creado)}
                    {r.descripcion ? ` · ${r.descripcion}` : ''}
                  </p>
                </div>
                <a href={enlaceWhatsApp(r)} target="_blank" rel="noopener" className="self-center rounded-lg bg-[#25D366] px-2.5 py-2 text-[11px] font-bold text-navy-900" aria-label="Compartir por WhatsApp">
                  WhatsApp
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
