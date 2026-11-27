'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Reporte } from '@/lib/tipos';
import { ciudadPorId, nombreCorto } from '@/lib/ciudades';
import { umbralMm } from '@/lib/riesgo';
import { nombreLluvia } from '@/lib/lluvia';

export type Resultado = { n: string; t: 'calle' | 'lugar' | 'ciudad'; c: string; p: [number, number]; s?: number };

const normal = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const metros = (a: [number, number], b: [number, number]) =>
  Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180));

let indiceCache: Promise<(Resultado & { k: string })[]> | null = null;
function cargarIndice() {
  indiceCache ??= fetch('./data/indice.json')
    .then((r) => r.json())
    .then((xs: Resultado[]) => xs.map((x) => ({ ...x, k: normal(x.n) })))
    .catch((e) => {
      indiceCache = null;
      throw e;
    });
  return indiceCache;
}

const ICONO = { ciudad: '🏙️', lugar: '🏘️', calle: '🛣️' } as const;
const TIPO = { ciudad: 'Ciudad', lugar: 'Barrio o caserío', calle: 'Calle' } as const;

/** Reportes de vecinos a menos de 400 m de un punto. */
export function reportesCerca(p: [number, number], reportes: Reporte[]) {
  return reportes.filter((r) => metros(p, [r.lat, r.lon]) <= 400);
}

export function Buscador({ reportes, onElegir, onCerrar }: { reportes: Reporte[]; onElegir: (r: Resultado) => void; onCerrar: () => void }) {
  const [q, setQ] = useState('');
  const [indice, setIndice] = useState<(Resultado & { k: string })[] | null>(null);
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    cargarIndice().then(setIndice).catch(() => setError(true));
  }, []);

  const resultados = useMemo(() => {
    const t = normal(q);
    if (!indice || t.length < 2) return [];
    const palabras = t.split(' ');
    const orden = { ciudad: 0, lugar: 1, calle: 2 };
    return indice
      .filter((x) => palabras.every((w) => x.k.includes(w)))
      .map((x) => ({ x, puntaje: (x.k.startsWith(t) ? 0 : x.k.includes(' ' + palabras[0]) ? 1 : 2) * 3 + orden[x.t] }))
      .sort((a, b) => a.puntaje - b.puntaje || a.x.n.length - b.x.n.length)
      .slice(0, 40)
      .map((r) => r.x);
  }, [q, indice]);

  return (
    <div className="fixed inset-0 z-[3700] flex flex-col bg-navy-900" role="dialog" aria-modal="true" aria-label="Buscar calle o barrio">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-cian/60 bg-navy-800 px-4 py-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14B8D4" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Calle, barrio, caserío o ciudad"
            className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-texto-sec/60 focus:outline-none"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Buscar"
          />
          {q && (
            <button type="button" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="Borrar" className="text-texto-sec">
              ×
            </button>
          )}
        </div>
        <button type="button" onClick={onCerrar} className="px-1 text-sm font-semibold text-cian">
          Cerrar
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
        {error && <p className="mt-6 text-center text-sm text-texto-sec">No se pudo cargar el buscador. Revisa tu conexión.</p>}
        {!error && q.trim().length < 2 && (
          <div className="mx-auto mt-6 max-w-sm text-center text-sm text-texto-sec">
            <p className="text-3xl" aria-hidden="true">🔎</p>
            <p className="mt-2 font-semibold text-white">¿Tienes familia en otra zona?</p>
            <p className="mt-1">
              Escribe el nombre de su calle, barrio o caserío. Te mostramos si esa zona se inunda y si los vecinos reportaron agua cerca.
            </p>
            <p className="mt-3 text-xs">Ejemplos: Grau, Castilla, Malingas, Bellavista</p>
          </div>
        )}
        {!error && q.trim().length >= 2 && indice && resultados.length === 0 && (
          <p className="mt-6 text-center text-sm text-texto-sec">No encontramos “{q}”. Prueba con otra palabra del nombre.</p>
        )}
        {!indice && !error && q.trim().length >= 2 && <p className="mt-6 text-center text-sm text-texto-sec">Buscando…</p>}

        <ul className="mt-2 flex flex-col gap-1.5">
          {resultados.map((r) => {
            const ciudad = ciudadPorId(r.c);
            const cerca = r.t === 'ciudad' ? [] : reportesCerca(r.p, reportes);
            const T = r.s != null ? Math.round(umbralMm(r.s)) : null;
            return (
              <li key={`${r.t}-${r.c}-${r.n}`}>
                <button
                  type="button"
                  onClick={() => onElegir(r)}
                  className="flex w-full items-start gap-3 rounded-xl border border-white/10 bg-navy-800 px-3 py-2.5 text-left hover:border-cian/60"
                >
                  <span className="text-xl leading-none" aria-hidden="true">{ICONO[r.t]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">{r.n}</span>
                    <span className="block text-xs text-texto-sec">
                      {TIPO[r.t]}
                      {r.t !== 'ciudad' && ` · ${nombreCorto(ciudad)}`}
                    </span>
                    {T != null && (
                      <span className="mt-0.5 block text-xs" style={{ color: T < 30 ? '#F87171' : T < 60 ? '#FACC15' : '#4ADE80' }}>
                        {T < 30 ? 'Zona baja: ' : T < 60 ? 'Riesgo medio: ' : 'Zona alta: '}se inunda con {nombreLluvia(T).toLowerCase()} (≈{T} mm)
                      </span>
                    )}
                    {cerca.length > 0 && (
                      <span className="mt-0.5 block text-xs font-bold text-aviso-naranja">
                        🚨 {cerca.length} {cerca.length === 1 ? 'reporte de vecinos' : 'reportes de vecinos'} cerca
                      </span>
                    )}
                  </span>
                  <span className="self-center text-cian" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
