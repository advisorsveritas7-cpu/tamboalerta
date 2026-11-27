'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Calle } from '@/lib/tipos';
import { estadoCalle, COLOR_ESTADO } from '@/lib/riesgo';

type Props = {
  lluvia: number;
  setLluvia: (n: number) => void;
  calles: Calle[];
  origen: string | null; // de dónde viene el valor (pronóstico, aviso, manual)
};

const MARCAS = [0, 25, 50, 75, 100, 150];

export function SimuladorLluvia({ lluvia, setLluvia, calles, origen }: Props) {
  const resumen = useMemo(() => {
    const r = { bajo: 0, moderado: 0, critico: 0 };
    const nombres = new Map<string, number>();
    for (const c of calles) {
      const e = estadoCalle(c, lluvia);
      r[e]++;
      if (e === 'critico' && c.n) nombres.set(c.n, Math.max(nombres.get(c.n) ?? 0, c.s));
    }
    const top = [...nombres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
    return { ...r, top };
  }, [calles, lluvia]);
  const total = calles.length || 1;
  const [abierto, setAbierto] = useState(false);
  useEffect(() => setAbierto(window.matchMedia('(min-width: 1024px)').matches), []);

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800/95 p-3 shadow-xl backdrop-blur lg:p-4" aria-labelledby="sim-titulo">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="sim-titulo" className="font-display text-sm font-bold uppercase tracking-wider text-texto-sec">
          Simulador de lluvia
        </h2>
        <p className="font-display text-2xl font-extrabold tabular-nums text-white">
          {lluvia}
          <span className="ml-1 text-sm font-semibold text-texto-sec">mm</span>
        </p>
      </div>
      {origen && <p className="text-[11px] text-cian-300">{origen}</p>}
      <input
        id="lluvia"
        type="range"
        min={0}
        max={150}
        step={5}
        value={lluvia}
        onChange={(e) => setLluvia(Number(e.target.value))}
        className="ta-slider mt-3 w-full"
        aria-label="Lluvia acumulada en milímetros"
      />
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-texto-sec">
        {MARCAS.map((m) => (
          <button key={m} type="button" onClick={() => setLluvia(m)} className="px-1 hover:text-cian">
            {m}
          </button>
        ))}
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-navy-600" aria-hidden="true">
        <div style={{ width: `${(resumen.bajo / total) * 100}%`, background: COLOR_ESTADO.bajo }} />
        <div style={{ width: `${(resumen.moderado / total) * 100}%`, background: COLOR_ESTADO.moderado }} />
        <div style={{ width: `${(resumen.critico / total) * 100}%`, background: COLOR_ESTADO.critico }} />
      </div>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="mt-2 flex w-full items-center justify-between text-[11px] text-texto-sec"
      >
        <span>
          <b className="text-aviso-rojo">{resumen.critico}</b> inundables · <b className="text-aviso-amarillo">{resumen.moderado}</b> en precaución · de {calles.length} calles
        </span>
        <span className="font-semibold text-cian">{abierto ? 'Ocultar' : 'Detalle'}</span>
      </button>
      {abierto && (
      <>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
        {(
          [
            ['bajo', 'Bajo'],
            ['moderado', 'Moderado'],
            ['critico', 'Crítico'],
          ] as const
        ).map(([k, t]) => (
          <div key={k} className="rounded-lg bg-navy-700 py-1.5">
            <dt className="flex items-center justify-center gap-1 text-texto-sec">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_ESTADO[k] }} />
              {t}
            </dt>
            <dd className="font-display text-base font-bold tabular-nums text-white">{resumen[k]}</dd>
          </div>
        ))}
      </dl>
      {resumen.top.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-aviso-rojo">Calles que se inundarían primero</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {resumen.top.map((n) => (
              <li key={n} className="rounded-md border border-aviso-rojo/40 bg-aviso-rojo/10 px-2 py-0.5 text-[11px] text-white">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[10px] leading-snug text-texto-sec/80">
        Modelo simplificado por topografía (cota, cercanía a río, quebradas y drenes, zonas bajas). Es una guía para prevenir, no reemplaza la
        evaluación de Defensa Civil.
      </p>
      </>
      )}
    </section>
  );
}
