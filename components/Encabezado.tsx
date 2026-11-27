'use client';
import { Logo } from './Logo';
import { MODO_SUPABASE } from '@/lib/config';

export function Encabezado({ enLinea }: { enLinea: boolean }) {
  return (
    <header className="sticky top-0 z-[1000] border-b border-white/10 bg-navy-900/95 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <Logo size={34} />
        <div className="min-w-0 leading-tight">
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            <span className="text-white">Tambo</span>
            <span className="text-cian">Alerta</span>
          </h1>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-texto-sec">PREVENIR ES PROTEGER VIDAS</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${enLinea ? 'border-cian/40 text-cian-300' : 'border-aviso-naranja/50 text-aviso-naranja'}`}
            title={MODO_SUPABASE ? 'Reportes compartidos en tiempo real' : 'Modo local: los reportes se guardan en este teléfono'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${enLinea ? 'bg-cian animate-pulse' : 'bg-aviso-naranja'}`} />
            {!enLinea ? 'Sin señal' : MODO_SUPABASE ? 'En vivo' : 'Modo local'}
          </span>
        </div>
      </div>
    </header>
  );
}
