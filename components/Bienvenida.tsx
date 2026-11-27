'use client';
import { useState } from 'react';
import { Logo } from './Logo';

// Guía rápida de 4 pasos. Se muestra la primera vez y desde el botón "?" del encabezado.
const PASOS = [
  {
    icono: '🗺️',
    titulo: 'Mira tu calle en el mapa',
    texto: 'Primero elige tu ciudad con el botón blanco 📍 arriba a la izquierda. Cada calle tiene un color: verde no hay peligro, amarillo cuidado con charcos y rojo se inunda. Toca una calle para ver su detalle.',
    muestra: true,
  },
  {
    icono: '🌧️',
    titulo: 'Elige cuánta lluvia',
    texto: 'Abajo del mapa toca Leve, Moderada, Fuerte o Extrema y el mapa cambia al instante. "Pronóstico" usa la lluvia esperada de verdad para las próximas 48 horas.',
  },
  {
    icono: '🏃',
    titulo: '¿Tienes que salir? Ruta de evacuación',
    texto: 'Toca el botón rojo "Ruta de evacuación", elige si vas a pie o en vehículo y desde dónde sales. Te marcamos en morado el camino más corto a una zona alta, evitando las calles que se inundan y las que reportaron los vecinos.',
  },
  {
    icono: '📸',
    titulo: '¿Tu calle se inundó? Avisa',
    texto: 'Toca el botón celeste "Reportar Calle Inundada", marca el lugar, cuánto sube el agua y toma una foto. Tus vecinos lo verán en el mapa y lo puedes compartir por WhatsApp.',
  },
];

export function Bienvenida({ onCerrar }: { onCerrar: () => void }) {
  const [i, setI] = useState(0);
  const p = PASOS[i];
  const ultimo = i === PASOS.length - 1;
  return (
    <div className="fixed inset-0 z-[4000] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="bienv-titulo">
      <div className="w-full max-w-sm animate-[ta-sube_.25s_ease-out] rounded-3xl border border-white/10 bg-navy-800 p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <p className="text-[11px] font-semibold tracking-[0.16em] text-texto-sec">CÓMO USAR TAMBOALERTA</p>
          <button type="button" onClick={onCerrar} className="ml-auto text-xs text-texto-sec underline">Saltar</button>
        </div>

        <div key={i} className="mt-4 animate-[ta-aparece_.25s_ease-out]">
          <p className="text-4xl" aria-hidden="true">{p.icono}</p>
          <h2 id="bienv-titulo" className="mt-2 font-display text-xl font-extrabold text-white">{p.titulo}</h2>
          <p className="mt-2 text-sm leading-relaxed text-texto-sec">{p.texto}</p>
          {p.muestra && (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {[
                ['#22C55E', 'Verde', 'Sin peligro'],
                ['#FACC15', 'Amarillo', 'Cuidado, puede haber charcos'],
                ['#EF4444', 'Rojo', 'Se inunda'],
              ].map(([c, n, t]) => (
                <li key={n} className="flex items-center gap-2">
                  <i className="inline-block h-1.5 w-7 rounded" style={{ background: c }} />
                  <b className="text-white">{n}</b>
                  <span className="text-texto-sec">{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {PASOS.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-cian' : 'w-1.5 bg-white/25'}`} />
            ))}
          </div>
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} className="ml-auto text-sm font-semibold text-texto-sec">Atrás</button>
          )}
          <button
            type="button"
            onClick={() => (ultimo ? onCerrar() : setI(i + 1))}
            className={`${i > 0 ? '' : 'ml-auto'} rounded-full bg-cian px-5 py-2.5 font-display text-sm font-extrabold text-navy-900`}
          >
            {ultimo ? 'Empezar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
