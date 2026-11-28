'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Calle } from '@/lib/tipos';
import { COLOR_ESTADO, estadoCalle, umbralMm } from '@/lib/riesgo';
import { nombreLluvia } from '@/lib/lluvia';
import type { Hora } from '@/lib/clima';
import { acumulado, cuandoDia, enCuanto, fechaCorta, fechaDia, horaQueLlega } from '@/lib/tiempo';

// Panel del pronóstico sobre el mapa. Ya no hay simulaciones: el mapa siempre muestra las zonas que se
// afectarían con la lluvia pronosticada (o con el aviso oficial de SENAMHI si el vecino lo eligió).
type Props = {
  calles: Calle[];
  horas: Hora[] | null;
  error: boolean;
  lluvia: number;
  onLluvia: (mm: number) => void;
  aviso: { mm: number; titulo: string } | null;
  onQuitarAviso: () => void;
};

export function PanelPronostico({ calles, horas, error, lluvia, onLluvia, aviso, onQuitarAviso }: Props) {
  const acum = useMemo(() => (horas ? acumulado(horas) : []), [horas]);
  const ultima = Math.max(0, acum.length - 1);
  const hayLluvia = acum.length > 0 && acum[ultima] > 0;
  // Días del pronóstico (hoy, mañana y los siguientes), con la última hora de cada uno.
  const dias = useMemo(() => {
    const ds: { fecha: string; ini: number; fin: number; mm: number }[] = [];
    (horas ?? []).forEach((h, i) => {
      const f = h.t.slice(0, 10);
      const d = ds[ds.length - 1];
      if (d && d.fecha === f) { d.fin = i; d.mm += h.mm; } else ds.push({ fecha: f, ini: i, fin: i, mm: h.mm });
    });
    return ds;
  }, [horas]);
  // Hora del pronóstico que se está mirando: por defecto, el final de mañana.
  const porDefecto = dias.length > 1 ? dias[1].fin : ultima;
  const [horaSel, setHoraSel] = useState(porDefecto);
  useEffect(() => setHoraSel(porDefecto), [porDefecto, horas]);
  const diaSel = dias.findIndex((d) => horaSel >= d.ini && horaSel <= d.fin);
  useEffect(() => {
    if (aviso) onLluvia(aviso.mm);
    else onLluvia(acum.length ? Math.round(acum[Math.min(horaSel, ultima)]) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horaSel, acum, aviso]);

  const [oculto, setOculto] = useState(false);
  const [detalle, setDetalle] = useState(false);

  // Animación: recorre el pronóstico hora por hora y se queda al final.
  const [animando, setAnimando] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const parar = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setAnimando(false);
  };
  const animar = () => {
    if (animando) return parar();
    if (aviso) onQuitarAviso();
    setAnimando(true);
    let i = 0;
    setHoraSel(0);
    timer.current = setInterval(() => {
      i++;
      if (i > ultima) return parar();
      setHoraSel(i);
    }, 90);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const resumen = useMemo(() => {
    const r = { bajo: 0, moderado: 0, critico: 0 };
    for (const c of calles) r[estadoCalle(c, lluvia)]++;
    return r;
  }, [calles, lluvia]);
  const total = calles.length || 1;

  // Primeras calles en inundarse con el pronóstico y cuánto tiempo queda para salir.
  const primeras = useMemo(() => {
    if (!horas || !hayLluvia) return [];
    const porNombre = new Map<string, number>();
    for (const c of calles) {
      if (!c.n) continue;
      const i = horaQueLlega(umbralMm(c.s), acum);
      if (i != null) porNombre.set(c.n, Math.min(porNombre.get(c.n) ?? 99, i));
    }
    return [...porNombre.entries()].sort((a, b) => a[1] - b[1]).slice(0, 12);
  }, [calles, acum, horas, hayLluvia]);

  const estadoGeneral = resumen.critico > 0 ? 'critico' : resumen.moderado > 0 ? 'moderado' : 'bajo';
  const titular = !calles.length
    ? 'Cargando calles…'
    : resumen.critico > 0
      ? `${resumen.critico} ${resumen.critico === 1 ? 'calle se inundaría' : 'calles se inundarían'}`
      : resumen.moderado > 0
        ? 'Ninguna calle se inunda, pero puede haber charcos'
        : 'Ninguna calle en peligro';
  const cuando = aviso
    ? `Según el aviso de SENAMHI: ${aviso.titulo}`
    : !horas
      ? error ? 'Sin conexión: no se pudo leer el pronóstico.' : 'Leyendo el pronóstico…'
      : !hayLluvia
        ? 'El pronóstico no trae lluvia para los próximos días.'
        : diaSel >= 0 && horaSel === dias[diaSel].fin
          ? `Lluvia acumulada desde ahora hasta el final de ${fechaDia(dias[diaSel].fecha + 'T12:00')}: ${lluvia} mm (${nombreLluvia(lluvia).toLowerCase()})`
          : `Lluvia acumulada hasta ${fechaCorta(horas[horaSel].t)}: ${lluvia} mm`;

  if (oculto) {
    return (
      <button
        type="button"
        onClick={() => setOculto(false)}
        aria-expanded={false}
        className="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-navy-800/95 py-2 pl-3 pr-4 text-left text-xs shadow-xl backdrop-blur"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR_ESTADO[estadoGeneral] }} />
        <span className="truncate font-semibold text-white">Pronóstico · {titular.toLowerCase()}</span>
        <span className="shrink-0 font-bold text-cian">Mostrar ▲</span>
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800/95 p-3 shadow-xl backdrop-blur lg:p-4" aria-labelledby="pron-titulo">
      <div className="flex items-center gap-2">
        <h2 id="pron-titulo" className="whitespace-nowrap font-display text-[13px] font-bold text-white">
          {aviso ? '⚠️ Aviso SENAMHI' : '📡 Según el pronóstico'}
        </h2>
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-expanded={true}
          className="-my-1 ml-auto whitespace-nowrap rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-cian hover:bg-cian/10"
        >
          Ocultar ▼
        </button>
      </div>

      {/* Resultado en una frase */}
      <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
        <span className="h-3 w-3 shrink-0 rounded-full transition-colors" style={{ background: COLOR_ESTADO[estadoGeneral] }} />
        <p className="font-display text-base font-extrabold leading-tight text-white">{titular}</p>
      </div>
      <p className="ml-5 text-[11px] text-cian-300">{cuando}</p>
      {resumen.critico > 0 && resumen.moderado > 0 && <p className="ml-5 text-[11px] text-texto-sec">y {resumen.moderado} con riesgo de charcos (amarillo)</p>}
      {aviso && (
        <button type="button" onClick={onQuitarAviso} className="ml-5 mt-0.5 text-[11px] font-bold text-cian underline">
          Volver al pronóstico
        </button>
      )}

      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-navy-600" aria-hidden="true">
        <div className="transition-all duration-300" style={{ width: `${(resumen.bajo / total) * 100}%`, background: COLOR_ESTADO.bajo }} />
        <div className="transition-all duration-300" style={{ width: `${(resumen.moderado / total) * 100}%`, background: COLOR_ESTADO.moderado }} />
        <div className="transition-all duration-300" style={{ width: `${(resumen.critico / total) * 100}%`, background: COLOR_ESTADO.critico }} />
      </div>

      {/* Línea de tiempo del pronóstico */}
      {horas && hayLluvia && !aviso && (
        <div className="mt-2 rounded-xl bg-navy-700/70 px-2.5 py-2">
          <p className="text-[11px] text-texto-sec">📅 Elige hasta qué día ver</p>
          <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Día del pronóstico">
            {dias.map((d, k) => {
              const [pre, num, mes] = fechaDia(d.fecha + 'T12:00', true).split(' ');
              return (
                <button
                  key={d.fecha}
                  type="button"
                  role="radio"
                  aria-checked={k === diaSel}
                  onClick={() => { parar(); setHoraSel(d.fin); }}
                  className={`flex shrink-0 flex-col items-center rounded-lg px-2.5 py-1 text-[11px] font-bold leading-tight ${k === diaSel ? 'bg-cian text-navy-900' : 'bg-navy-800 text-white'}`}
                >
                  <span className="capitalize">{pre.slice(0, k > 1 ? 3 : 7)}</span>
                  <span className="text-[13px]">{num} {mes}</span>
                  <span className={`text-[9px] font-semibold ${k === diaSel ? 'text-navy-900/70' : 'text-texto-sec'}`}>🌧️ {Math.round(d.mm)} mm</span>
                </button>
              );
            })}
          </div>
          <label htmlFor="hora" className="mt-1.5 flex items-center justify-between text-[11px] text-texto-sec">
            <span>⏱️ Hora</span>
            <span className="font-semibold text-white">{fechaCorta(horas[Math.min(horaSel, ultima)].t)}</span>
          </label>
          <input
            id="hora"
            type="range"
            min={0}
            max={ultima}
            value={Math.min(horaSel, ultima)}
            onChange={(e) => { parar(); setHoraSel(Number(e.target.value)); }}
            className="ta-slider mt-1 w-full"
          />
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {horas && hayLluvia && (
          <button
            type="button"
            onClick={animar}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-cian/50 py-1.5 text-xs font-bold text-cian hover:bg-cian/10"
          >
            {animando ? '■ Detener' : '▶ Ver cómo avanza día a día'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDetalle(!detalle)}
          aria-expanded={detalle}
          className={`rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-texto-sec hover:text-white ${horas && hayLluvia ? '' : 'flex-1'}`}
        >
          {detalle ? 'Menos' : '📅 ¿Cuándo se inunda?'}
        </button>
      </div>

      {detalle && (
        <div className="mt-3 max-h-[28dvh] overflow-y-auto border-t border-white/10 pt-3 lg:max-h-[55vh]">
          {horas && hayLluvia ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-aviso-naranja">Cuándo se inundaría, según el pronóstico</p>
              {primeras.length ? (
                <ul className="mt-1 flex flex-col gap-1">
                  {primeras.map(([n, i]) => (
                    <li key={n} className="flex items-center justify-between gap-2 rounded-md bg-navy-700 px-2 py-1 text-[11px]">
                      <button type="button" className="truncate text-left text-white" onClick={() => { parar(); setHoraSel(i); }}>{n}</button>
                      <span className="shrink-0 font-semibold text-aviso-naranja">
                        {enCuanto(horas[i].t) === 'ya' ? 'ya en riesgo' : cuandoDia(horas[i].t, true)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] text-texto-sec">Con la lluvia pronosticada para los próximos días ninguna calle llega a inundarse.</p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-texto-sec">Cuando el pronóstico traiga lluvia, aquí verás qué día se inundaría cada calle.</p>
          )}
          <p className="mt-3 text-[10px] leading-snug text-texto-sec/80">
            Cálculo aproximado según la altura del terreno, la cercanía a ríos y quebradas y el pronóstico de lluvia. Es una guía para prevenir y no
            reemplaza a Defensa Civil. El agua puede llegar antes si se tapan los drenes o crece el río. Toca una calle del mapa para ver su detalle.
          </p>
        </div>
      )}
    </section>
  );
}
