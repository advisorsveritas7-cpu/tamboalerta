'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Acceso por enlace mágico de correo para coordinadores (solo en modo Supabase). */
export function AccesoCoordinador({ onCerrar }: { onCerrar: () => void }) {
  const [correo, setCorreo] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          const sb = await supabase();
          if (!sb) return;
          setEstado('enviando');
          const { error } = await sb.auth.signInWithOtp({ email: correo, options: { emailRedirectTo: location.href, shouldCreateUser: false } });
          if (error) {
            setEstado('error');
            setMsg('Ese correo no está registrado como coordinador.');
          } else setEstado('enviado');
        }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy-800 p-5"
      >
        <h2 className="font-display text-lg font-extrabold">Acceso de coordinadores</h2>
        <p className="mt-1 text-xs text-texto-sec">Para publicar avisos oficiales. Te enviaremos un enlace de acceso a tu correo.</p>
        {estado === 'enviado' ? (
          <p className="mt-4 rounded-lg bg-cian/15 p-3 text-sm">Revisa tu correo y abre el enlace desde este mismo teléfono.</p>
        ) : (
          <>
            <input id="coord-correo" type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@municipalidad.gob.pe" className="ta-input mt-4" />
            {estado === 'error' && <p className="mt-2 text-xs text-aviso-rojo">{msg}</p>}
            <button disabled={estado === 'enviando'} className="mt-3 w-full rounded-xl bg-cian py-2.5 text-sm font-bold text-navy-900 disabled:opacity-60">
              {estado === 'enviando' ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </>
        )}
        <button type="button" onClick={onCerrar} className="mt-2 w-full py-2 text-xs text-texto-sec">
          Cerrar
        </button>
      </form>
    </div>
  );
}
