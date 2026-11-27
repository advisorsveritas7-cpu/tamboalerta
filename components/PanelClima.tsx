'use client';
import type { Pronostico } from '@/lib/clima';
import { describirCodigo } from '@/lib/clima';
import { fechaDia } from '@/lib/tiempo';

type Props = { p: Pronostico | null; error: boolean; onSimular: (mm: number) => void; onAnimacion: () => void; ciudad: string };

export function PanelClima({ p, error, onSimular, onAnimacion, ciudad }: Props) {
  const botonAnimacion = (
    <button
      type="button"
      onClick={onAnimacion}
      className="mt-3 w-full rounded-xl bg-cian py-2.5 text-sm font-extrabold text-navy-900 hover:bg-cian-300"
    >
      ▶ Ver pronóstico animado de lluvia
    </button>
  );
  if (!p) {
    return (
      <section className="rounded-2xl border border-white/10 bg-navy-800 p-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-texto-sec">Pronóstico de hoy y mañana · {ciudad}</h2>
        <p className="mt-3 text-sm text-texto-sec">{error
            ? typeof window !== 'undefined' && (window as unknown as { __TA_VISTA_PREVIA?: boolean }).__TA_VISTA_PREVIA
              ? 'La vista previa no puede consultar Open-Meteo. En la app publicada aquí aparece el pronóstico en vivo de hoy y mañana.'
              : 'No se pudo cargar el pronóstico. Revisa tu conexión.'
            : 'Cargando pronóstico…'}</p>
        {botonAnimacion}
      </section>
    );
  }
  const maxMm = Math.max(1, ...p.horas.map((h) => h.mm));
  const W = 288, H = 64;
  const bw = W / p.horas.length;
  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800 p-4" aria-labelledby="clima-titulo">
      <div className="flex items-center justify-between">
        <h2 id="clima-titulo" className="font-display text-sm font-bold uppercase tracking-wider text-texto-sec">
          Pronóstico de hoy y mañana · {ciudad}
        </h2>
        {p.offline && <span className="text-[10px] text-aviso-naranja">sin conexión · último dato</span>}
      </div>
      <div className="mt-3 flex items-end gap-4">
        <p className="font-display text-4xl font-extrabold tabular-nums text-white">{Math.round(p.actual.temp)}°</p>
        <div className="pb-1 text-xs text-texto-sec">
          <p className="text-white">{describirCodigo(p.actual.codigo)}</p>
          <p>Humedad {p.actual.humedad}% · Lluvia ahora {p.actual.mm} mm</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(p.dias ?? []).slice(0, 2).map((d) => (
          <Dato key={d.fecha} t={fechaDia(d.fecha + 'T12:00', true).replace(/^./, (c) => c.toUpperCase())} v={`${d.mm} mm`} />
        ))}
        <Dato t="Prob. máx." v={`${p.probMax}%`} />
      </dl>
      <figure className="mt-3">
        <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label="Lluvia por hora hoy y mañana">
          {[0.5, 1].map((f) => (
            <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="#CBD5E1" strokeOpacity={0.12} />
          ))}
          {p.horas.map((h, i) => (
            <g key={h.t}>
              <rect x={i * bw + 0.5} y={H - H * (h.prob / 100)} width={bw - 1} height={H * (h.prob / 100)} fill="#14B8D4" opacity={0.18} />
              <rect x={i * bw + 0.5} y={H - (H * h.mm) / maxMm} width={bw - 1} height={(H * h.mm) / maxMm} fill="#14B8D4" rx={1} />
            </g>
          ))}
          {/* Rótulo de cada día donde empieza */}
          {p.horas.map((h, i) =>
            i === 0 || h.t.endsWith('T00:00') ? (
              <g key={'d' + h.t}>
                {i > 0 && <line x1={i * bw} x2={i * bw} y1={0} y2={H} stroke="#CBD5E1" strokeOpacity={0.35} strokeDasharray="2 2" />}
                <text x={i * bw + 2} y={H + 11} fontSize={8} fill="#CBD5E1">{fechaDia(h.t, true)}</text>
              </g>
            ) : null,
          )}
        </svg>
        <figcaption className="flex items-center gap-3 text-[10px] text-texto-sec">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-cian" /> mm/hora (máx {maxMm.toFixed(1)})</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-sm bg-cian/20" /> probabilidad</span>
        </figcaption>
      </figure>
      <button
        type="button"
        onClick={() => onSimular(Math.round(p.total48))}
        className="mt-3 w-full rounded-xl border border-cian/50 py-2 text-sm font-semibold text-cian hover:bg-cian/10"
      >
        Ver este pronóstico en el mapa
      </button>
      {botonAnimacion}
      <p className="mt-2 text-[10px] text-texto-sec/70">Fuente: Open-Meteo · actualizado {new Date(p.actualizado).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
    </section>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="rounded-lg bg-navy-700 py-1.5">
      <dt className="text-[10px] text-texto-sec">{t}</dt>
      <dd className="font-display text-sm font-bold tabular-nums text-white">{v}</dd>
    </div>
  );
}
