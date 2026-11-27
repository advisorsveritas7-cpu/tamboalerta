'use client';
import { Logo } from './Logo';
import { MODO_SUPABASE } from '@/lib/config';

export function Encabezado({ enLinea, onAyuda, onBuscar }: { enLinea: boolean; onAyuda: () => void; onBuscar: () => void }) {
  return (
    <header className="sticky top-0 z-[1000] border-b border-white/10 bg-navy-900/95 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-3 sm:gap-3 sm:px-4 py-2.5">
        <Logo size={32} />
        <div className="min-w-0 leading-tight">
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            <span className="text-white">Tambo</span>
            <span className="text-cian">Alerta</span>
          </h1>
          <p className="whitespace-nowrap text-[9px] font-semibold tracking-[0.12em] text-texto-sec sm:text-[10px] sm:tracking-[0.18em]">PREVENIR ES PROTEGER VIDAS</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 ${enLinea ? 'border-cian/40 text-cian-300' : 'border-aviso-naranja/50 text-aviso-naranja'}`}
            title={MODO_SUPABASE ? 'Reportes compartidos en tiempo real' : 'Modo local: los reportes se guardan en este teléfono'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${enLinea ? 'bg-cian animate-pulse' : 'bg-aviso-naranja'}`} />
            {!enLinea ? 'Sin señal' : MODO_SUPABASE ? 'En vivo' : 'Modo local'}
          </span>
          <button
            type="button"
            onClick={onBuscar}
            aria-label="Buscar calle, barrio o caserío"
            className="grid h-9 w-9 place-items-center rounded-full bg-cian text-navy-900 shadow-lg shadow-cian/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onAyuda}
            aria-label="Cómo usar la app"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/20 font-display text-sm font-bold text-white hover:border-cian hover:text-cian"
          >
            ?
          </button>
        </div>
      </div>
    </header>
  );
}
