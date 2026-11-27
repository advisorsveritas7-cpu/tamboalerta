'use client';
import { useState } from 'react';
import { TAMBOGRANDE } from '@/lib/config';

// Ventana con la simulación animada del pronóstico de lluvia (modelo ECMWF vía Windy).
// El iframe solo se carga al abrir la ventana, para que la app siga liviana.
const VISTAS = [
  { id: 'rain', nombre: 'Lluvia' },
  { id: 'rainAccu', nombre: 'Acumulado' },
  { id: 'clouds', nombre: 'Nubes' },
  { id: 'wind', nombre: 'Viento' },
] as const;

export function VentanaSimulacion({ onCerrar }: { onCerrar: () => void }) {
  const [capa, setCapa] = useState<(typeof VISTAS)[number]['id']>('rain');
  const [cargando, setCargando] = useState(true);
  const [lat, lon] = TAMBOGRANDE;
  const url =
    'https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh' +
    `&zoom=7&overlay=${capa}&product=ecmwf&level=surface&lat=${(lat - 0.6).toFixed(3)}&lon=${lon.toFixed(3)}` +
    `&detailLat=${lat}&detailLon=${lon}&marker=true&message=true`;

  return (
    <div className="fixed inset-0 z-[3500] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sim-anim-titulo">
      <div className="flex h-[92dvh] w-full max-w-4xl animate-[ta-sube_.25s_ease-out] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-navy-800 shadow-2xl sm:h-[85vh] sm:rounded-3xl">
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0">
            <h2 id="sim-anim-titulo" className="font-display text-base font-extrabold text-white">Simulación de lluvia · próximos días</h2>
            <p className="text-[11px] text-texto-sec">Presiona ▶ abajo para ver cómo se mueven las lluvias sobre Piura.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-700 text-lg text-white">
            ×
          </button>
        </div>
        <div className="flex gap-1.5 px-4 pb-2" role="radiogroup" aria-label="Qué mostrar">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={capa === v.id}
              onClick={() => { setCapa(v.id); setCargando(true); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${capa === v.id ? 'bg-cian text-navy-900' : 'bg-navy-700 text-texto-sec'}`}
            >
              {v.nombre}
            </button>
          ))}
        </div>
        <div className="relative min-h-0 flex-1 bg-navy-900">
          {cargando && <p className="absolute inset-0 grid place-items-center text-sm text-texto-sec">Cargando simulación…</p>}
          <iframe
            key={capa}
            src={url}
            title="Simulación animada del pronóstico de lluvia"
            className="relative h-full w-full border-0"
            onLoad={() => setCargando(false)}
            allow="fullscreen"
          />
        </div>
        <p className="px-4 py-2 text-[10px] text-texto-sec/80">
          Pronóstico del modelo europeo ECMWF mostrado por Windy.com. Es una ayuda visual: los avisos oficiales son los de SENAMHI.
        </p>
      </div>
    </div>
  );
}
