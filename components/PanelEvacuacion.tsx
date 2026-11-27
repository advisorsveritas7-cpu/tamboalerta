'use client';
import { useState } from 'react';
import { enlaceGoogleMaps, textoDistancia, type Modo, type ResultadoRuta } from '@/lib/evacuacion';
import { COLOR_ESTADO } from '@/lib/riesgo';
import { nombreLluvia } from '@/lib/lluvia';

// Hoja inferior de la ruta de evacuación: a pie o en vehículo, desde tu ubicación o un punto del mapa.
type Props = {
  modo: Modo;
  setModo: (m: Modo) => void;
  resultado: ResultadoRuta | null;
  tieneOrigen: boolean;
  buscandoGps: boolean;
  sinDatos: boolean;
  lluvia: number;
  onGps: () => void;
  onTocarMapa: () => void;
  onCerrar: () => void;
};

export function PanelEvacuacion({ modo, setModo, resultado, tieneOrigen, buscandoGps, sinDatos, lluvia, onGps, onTocarMapa, onCerrar }: Props) {
  const [verPasos, setVerPasos] = useState(false);
  const r = resultado?.ok ? resultado.ruta : null;

  return (
    <div className="pointer-events-auto max-h-[46dvh] overflow-y-auto rounded-2xl border border-white/10 bg-navy-800/95 p-3 shadow-2xl backdrop-blur animate-[ta-sube_.25s_ease-out]" role="region" aria-label="Ruta de evacuación">
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-extrabold text-white">🏃 Ruta de evacuación</h2>
          <p className="text-[10px] leading-tight text-texto-sec">A zona alta, evitando calles que se inundan con {nombreLluvia(lluvia).toLowerCase()} ({lluvia} mm).</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Quitar ruta" className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-700 text-lg text-white">
          ×
        </button>
      </div>

      {/* ¿Cómo sales? */}
      <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-full bg-navy-900 p-1" role="radiogroup" aria-label="Cómo vas a salir">
        {(
          [
            ['pie', '🚶 A pie'],
            ['vehiculo', '🚗 En vehículo'],
          ] as [Modo, string][]
        ).map(([m, t]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            onClick={() => setModo(m)}
            className={`rounded-full py-1 text-[13px] font-extrabold ${modo === m ? 'bg-cian text-navy-900' : 'text-texto-sec'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ¿Desde dónde? */}
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={onGps} disabled={buscandoGps} className="flex-1 rounded-xl bg-white py-1.5 text-xs font-extrabold text-navy-900 disabled:opacity-60">
          {buscandoGps ? 'Buscando…' : '📍 Desde donde estoy'}
        </button>
        <button type="button" onClick={onTocarMapa} className="flex-1 rounded-xl border border-white/25 py-1.5 text-xs font-extrabold text-white">
          👆 Tocar en el mapa
        </button>
      </div>

      {sinDatos && <p className="mt-3 text-sm text-texto-sec">Todavía no tenemos el mapa de calles de esta ciudad.</p>}

      {!tieneOrigen && !sinDatos && (
        <p className="mt-2 text-xs text-texto-sec">Elige desde dónde sales: tu ubicación del celular o toca tu casa en el mapa.</p>
      )}

      {resultado && !resultado.ok && (
        <p className="mt-3 rounded-xl bg-navy-700 p-3 text-sm text-white">
          {resultado.motivo === 'seguro' && (
            <>✅ <b>Estás en una zona alta</b> ({Math.round(resultado.alturaOrigen ?? 0)} m de altura). Con esta lluvia no hace falta moverte: quédate en un lugar techado y atento a los avisos.</>
          )}
          {resultado.motivo === 'lejos' && <>Ese punto está lejos de las calles de esta ciudad. Cambia de ciudad con el botón 📍 o toca un punto dentro del pueblo.</>}
          {resultado.motivo === 'sin-ruta' && (
            <>No encontramos un camino seguro desde ese punto{modo === 'vehiculo' ? ' en vehículo. Prueba “A pie”' : ''}. Sube al segundo piso o al techo y llama al <b>116</b> (bomberos) o al <b>105</b> (policía).</>
          )}
        </p>
      )}

      {r && (
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-xl font-extrabold text-white">{textoDistancia(r.metros)}</p>
            <p className="text-xs text-texto-sec">
              unos <b className="text-white">{r.minutos} min</b> {r.modo === 'pie' ? 'caminando' : 'manejando'}
            </p>
          </div>
          <p className="text-[11px] text-texto-sec">
            🏁 Llegas a una zona alta de <b className="text-white">{r.alturaDestino} m</b>
            {r.alturaDestino - r.alturaOrigen >= 1 ? ` (${r.alturaDestino - r.alturaOrigen} m más arriba)` : ''}. Sigue la línea morada.
          </p>

          {r.metrosInundados > 0 ? (
            <p className="mt-2 rounded-lg bg-aviso-rojo/20 px-2.5 py-1.5 text-xs text-white">
              ⚠️ <b>{textoDistancia(r.metrosInundados)}</b> del camino pasan por calles que se inundan (es la salida más corta).{' '}
              {r.modo === 'vehiculo'
                ? 'No cruces si el agua pasa la mitad de la llanta o corre con fuerza.'
                : 'No cruces si el agua pasa la rodilla o corre con fuerza; tantea con un palo.'}
            </p>
          ) : r.metrosCuidado >= 20 ? (
            <p className="mt-2 rounded-lg bg-aviso-amarillo/15 px-2.5 py-1.5 text-xs text-white">
              Pasa {textoDistancia(r.metrosCuidado)} por calles amarillas: puede haber charcos, ve con cuidado.
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-[#22C55E]/15 px-2.5 py-1.5 text-xs text-white">✅ Todo el camino va por calles sin peligro con esta lluvia.</p>
          )}
          {r.pasaPorReportes && (
            <p className="mt-1.5 rounded-lg bg-aviso-naranja/20 px-2.5 py-1.5 text-xs text-white">🚨 Pasa cerca de un reporte de vecinos con agua. Mira la foto antes de salir.</p>
          )}

          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => setVerPasos(!verPasos)} className="flex-1 rounded-xl border border-cian/60 py-2 text-xs font-extrabold text-cian" aria-expanded={verPasos}>
              {verPasos ? 'Ocultar calles' : `Ver calles (${r.pasos.length})`}
            </button>
            <a href={enlaceGoogleMaps(r)} target="_blank" rel="noopener" className="flex-[1.4] rounded-xl bg-cian py-2 text-center text-xs font-extrabold text-navy-900">
              Seguir con Google Maps
            </a>
          </div>
          {verPasos && (
            <ol className="mt-2 flex flex-col gap-1 text-xs text-texto-sec">
              {r.pasos.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy-700 text-[10px] font-bold text-white">{i + 1}</span>
                  <i className="inline-block h-1 w-3 shrink-0 rounded" style={{ background: COLOR_ESTADO[p.estado] }} />
                  <span className="min-w-0 flex-1 truncate">
                    {i === 0 ? 'Sal por' : 'Sigue por'} <b className="text-white">{p.nombre}</b>
                  </span>
                  <span className="shrink-0">{textoDistancia(p.metros)}</span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cian text-[10px] text-navy-900">🏁</span>
                <span className="text-white">Zona alta segura</span>
              </li>
            </ol>
          )}

          <p className="mt-1.5 text-[10px] leading-snug text-texto-sec/80">
            Calculada con el mapa de riesgo (aún no calibrado) y los reportes de vecinos. Si ves agua o una calle cerrada, toma otro camino y sigue a Defensa Civil.
          </p>
        </div>
      )}
    </div>
  );
}
