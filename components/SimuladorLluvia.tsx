'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Calle } from '@/lib/tipos';
import { estadoCalle, COLOR_ESTADO } from '@/lib/riesgo';
import { NIVELES_LLUVIA, nombreLluvia } from '@/lib/lluvia';

type Props = {
  lluvia: number;
  setLluvia: (n: number, origen?: string | null) => void;
  calles: Calle[];
  origen: string | null; // de dónde viene el valor (pronóstico, aviso, manual)
  pronostico48: number | null; // lluvia prevista en 48 h (Open-Meteo)
};

const MAX_ANIM = 120;

export function SimuladorLluvia({ lluvia, setLluvia, calles, origen, pronostico48 }: Props) {
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
  const [detalle, setDetalle] = useState(false);
  const [oculto, setOculto] = useState(false);

  // Animación "ver cómo sube el agua": recorre de 0 a 120 mm y vuelve al valor elegido.
  const [animando, setAnimando] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const previo = useRef<{ mm: number; origen: string | null }>({ mm: lluvia, origen });
  const detener = (volver = true) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setAnimando(false);
    if (volver) setLluvia(previo.current.mm, previo.current.origen);
  };
  const animar = () => {
    if (animando) return detener();
    previo.current = { mm: lluvia, origen };
    setAnimando(true);
    let mm = 0;
    setLluvia(0, null);
    timer.current = setInterval(() => {
      mm += 5;
      if (mm > MAX_ANIM) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setTimeout(() => detener(), 1600);
        return;
      }
      setLluvia(mm, null);
    }, 180);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const opciones = [
    ...(pronostico48 != null
      ? [{ id: 'pron', nombre: 'Pronóstico', mm: Math.round(pronostico48), icono: '📡', origen: `Lluvia prevista para las próximas 48 h: ${pronostico48} mm` }]
      : []),
    ...NIVELES_LLUVIA.map((n) => ({ ...n, origen: `${n.nombre}: ${n.ejemplo.toLowerCase()}` })),
  ];
  const activa = animando ? null : opciones.find((o) => o.mm === lluvia && (o.id !== 'pron' || origen?.startsWith('Lluvia prevista')))?.id;

  const estadoGeneral = resumen.critico > 0 ? 'critico' : resumen.moderado > 0 ? 'moderado' : 'bajo';
  const titular =
    resumen.critico > 0
      ? `${resumen.critico} ${resumen.critico === 1 ? 'calle se inundaría' : 'calles se inundarían'}`
      : resumen.moderado > 0
        ? 'Ninguna calle se inunda, pero hay charcos'
        : 'Ninguna calle en peligro';

  // Versión mínima: una píldora que deja ver todo el mapa.
  if (oculto) {
    return (
      <button
        type="button"
        onClick={() => setOculto(false)}
        aria-expanded={false}
        className="flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-navy-800/95 py-2 pl-3 pr-4 text-left text-xs shadow-xl backdrop-blur"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR_ESTADO[estadoGeneral] }} />
        <span className="truncate font-semibold text-white">
          {nombreLluvia(lluvia)} · {resumen.critico} {resumen.critico === 1 ? 'calle se inunda' : 'calles se inundan'}
        </span>
        <span className="shrink-0 font-bold text-cian">Mostrar ▲</span>
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800/95 p-3 shadow-xl backdrop-blur lg:p-4" aria-labelledby="sim-titulo">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sim-titulo" className="font-display text-[13px] font-bold text-white">
          ¿Qué pasa si llueve?
        </h2>
        <p className="ml-auto text-[11px] text-texto-sec">
          {nombreLluvia(lluvia)} · <b className="tabular-nums text-white">{lluvia} mm</b>
        </p>
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-expanded={true}
          className="-my-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-bold text-cian hover:bg-cian/10"
        >
          Ocultar ▼
        </button>
      </div>

      {/* Opciones de lluvia en palabras */}
      <div className={`mt-2 grid gap-1 ${opciones.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`} role="radiogroup" aria-label="Cantidad de lluvia">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={activa === o.id}
            onClick={() => { if (animando) detener(false); setLluvia(o.mm, o.origen); }}
            className={`flex min-w-0 flex-col items-center rounded-xl border px-0.5 py-1.5 text-[10.5px] font-semibold leading-tight transition ${
              activa === o.id ? 'border-cian bg-cian text-navy-900' : 'border-white/10 bg-navy-700 text-white hover:border-cian/60'
            }`}
          >
            <span className="text-base leading-none" aria-hidden="true">{o.icono}</span>
            <span className="mt-0.5 max-w-full truncate">{o.nombre}</span>
            <span className={`text-[10px] font-normal tabular-nums ${activa === o.id ? 'text-navy-900/70' : 'text-texto-sec'}`}>{o.mm} mm</span>
          </button>
        ))}
      </div>

      {/* Resultado en una frase */}
      <div className="mt-2 flex items-center gap-2" aria-live="polite">
        <span className="h-3 w-3 shrink-0 rounded-full transition-colors" style={{ background: COLOR_ESTADO[estadoGeneral] }} />
        <p className="font-display text-base font-extrabold leading-tight text-white">{titular}</p>
      </div>
      {resumen.critico > 0 && resumen.moderado > 0 && (
        <p className="ml-5 text-[11px] text-texto-sec">y {resumen.moderado} con riesgo de charcos (amarillo)</p>
      )}
      {origen && !animando && <p className="ml-5 text-[11px] text-cian-300">{origen}</p>}

      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-navy-600" aria-hidden="true">
        <div className="transition-all duration-300" style={{ width: `${(resumen.bajo / total) * 100}%`, background: COLOR_ESTADO.bajo }} />
        <div className="transition-all duration-300" style={{ width: `${(resumen.moderado / total) * 100}%`, background: COLOR_ESTADO.moderado }} />
        <div className="transition-all duration-300" style={{ width: `${(resumen.critico / total) * 100}%`, background: COLOR_ESTADO.critico }} />
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={animar}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-cian/50 py-1.5 text-xs font-bold text-cian hover:bg-cian/10"
        >
          {animando ? '■ Detener' : '▶ Ver cómo sube el agua'}
        </button>
        <button
          type="button"
          onClick={() => setDetalle(!detalle)}
          aria-expanded={detalle}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-texto-sec hover:text-white"
        >
          {detalle ? 'Menos' : 'Más'}
        </button>
      </div>

      {detalle && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <label htmlFor="lluvia" className="text-[11px] text-texto-sec">Ajuste fino (milímetros de lluvia acumulada)</label>
          <input
            id="lluvia"
            type="range"
            min={0}
            max={150}
            step={5}
            value={lluvia}
            onChange={(e) => { if (animando) detener(false); setLluvia(Number(e.target.value), null); }}
            className="ta-slider mt-2 w-full"
          />
          {resumen.top.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-aviso-rojo">Las que se inundan primero</p>
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
            Cálculo aproximado según la altura del terreno y la cercanía a ríos y quebradas. Es una guía para prevenir y no reemplaza a Defensa
            Civil. Toca una calle del mapa para ver su detalle.
          </p>
        </div>
      )}
    </section>
  );
}
