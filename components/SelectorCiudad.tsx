'use client';
import { CIUDADES, type Ciudad } from '@/lib/ciudades';

// Lista de ciudades de la región Piura agrupadas por provincia.
export function SelectorCiudad({ actual, onElegir, onCerrar }: { actual: string; onElegir: (c: Ciudad) => void; onCerrar: () => void }) {
  const provincias = [...new Set(CIUDADES.map((c) => c.provincia))];
  return (
    <div className="fixed inset-0 z-[3600] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sel-ciudad" onClick={onCerrar}>
      <div
        className="max-h-[85dvh] w-full max-w-md animate-[ta-sube_.25s_ease-out] overflow-y-auto rounded-t-3xl border border-white/10 bg-navy-800 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <h2 id="sel-ciudad" className="font-display text-lg font-extrabold text-white">¿Dónde estás?</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-navy-700 text-lg text-white">×</button>
        </div>
        <p className="text-xs text-texto-sec">Elige tu ciudad de la región Piura para ver sus calles en riesgo.</p>
        {provincias.map((prov) => (
          <div key={prov} className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cian-300">Provincia de {prov}</p>
            <ul className="mt-1 grid gap-1.5">
              {CIUDADES.filter((c) => c.provincia === prov).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onElegir(c)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${
                      c.id === actual ? 'border-cian bg-cian/15 text-white' : 'border-white/10 bg-navy-700 text-white hover:border-cian/60'
                    }`}
                  >
                    <span aria-hidden="true">📍</span>
                    {c.nombre}
                    {c.id === actual && <span className="ml-auto text-xs text-cian">Actual</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
