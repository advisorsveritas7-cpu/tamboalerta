'use client';
import { useState } from 'react';
import type { Aviso, NivelAviso } from '@/lib/tipos';
import { fechaAviso } from '@/lib/formato';
import { URL_AVISOS_SENAMHI } from '@/lib/config';

const NIVEL: Record<NivelAviso, { nombre: string; bg: string; borde: string; texto: string }> = {
  amarillo: { nombre: 'Nivel Amarillo', bg: 'bg-aviso-amarillo', borde: 'border-aviso-amarillo/60', texto: 'text-navy-900' },
  naranja: { nombre: 'Nivel Naranja', bg: 'bg-aviso-naranja', borde: 'border-aviso-naranja/60', texto: 'text-navy-900' },
  rojo: { nombre: 'Nivel Rojo', bg: 'bg-aviso-rojo', borde: 'border-aviso-rojo/70', texto: 'text-white' },
};

type Props = {
  avisos: Aviso[];
  onImpacto: (a: Aviso) => void;
  onPublicar: (a: Omit<Aviso, 'id'>) => Promise<void>;
  onRetirar: (id: string) => Promise<void>;
  puedePublicar: boolean;
  onIngresar: () => void;
};

export function PanelAvisos({ avisos, onImpacto, onPublicar, onRetirar, puedePublicar, onIngresar }: Props) {
  const [formAbierto, setFormAbierto] = useState(false);
  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800 p-4" aria-labelledby="avisos-titulo">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="avisos-titulo" className="font-display text-base font-extrabold text-white">
            Avisos Meteorológicos Oficiales
          </h2>
          <p className="text-[11px] font-semibold tracking-wider text-cian-300">SENAMHI · PIURA</p>
        </div>
        <a href={URL_AVISOS_SENAMHI} target="_blank" rel="noopener" className="shrink-0 text-[11px] text-texto-sec underline decoration-cian/50 underline-offset-2">
          Ver en senamhi.gob.pe
        </a>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {avisos.length === 0 && <li className="rounded-xl bg-navy-700 p-3 text-sm text-texto-sec">No hay avisos vigentes publicados.</li>}
        {avisos.map((a) => {
          const n = NIVEL[a.nivel];
          const vigente = new Date(a.inicio) <= new Date();
          return (
            <li key={a.id} className={`overflow-hidden rounded-xl border ${n.borde} bg-navy-700`}>
              <div className={`flex items-center justify-between px-3 py-1.5 ${n.bg} ${n.texto}`}>
                <span className="text-xs font-extrabold uppercase tracking-wider">{n.nombre}</span>
                <span className="text-[11px] font-semibold">
                  {a.ejemplo ? 'EJEMPLO' : a.numero ? `Aviso N.º ${a.numero}` : ''} {vigente ? '· VIGENTE' : '· PRÓXIMO'}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold leading-snug text-white">{a.titulo}</p>
                <p className="mt-1 text-[11px] text-texto-sec">
                  {fechaAviso(a.inicio)} → {fechaAviso(a.fin)}
                </p>
                {a.detalle && <p className="mt-1.5 text-xs text-texto-sec">{a.detalle}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onImpacto(a)}
                    className="flex-1 rounded-lg bg-cian px-3 py-2 text-xs font-bold text-navy-900 hover:bg-cian-300"
                  >
                    Ver impacto en el mapa ({a.lluvia_mm} mm)
                  </button>
                  {puedePublicar && (
                    <button type="button" onClick={() => onRetirar(a.id)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-texto-sec hover:text-white">
                      Retirar
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {puedePublicar ? (
        formAbierto ? (
          <FormAviso
            onCancelar={() => setFormAbierto(false)}
            onGuardar={async (a) => {
              await onPublicar(a);
              setFormAbierto(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setFormAbierto(true)} className="mt-3 w-full rounded-xl border border-dashed border-cian/50 py-2 text-sm font-semibold text-cian hover:bg-cian/10">
            + Publicar aviso vigente
          </button>
        )
      ) : (
        <button type="button" onClick={onIngresar} className="mt-3 w-full text-center text-[11px] text-texto-sec underline underline-offset-2">
          ¿Eres coordinador? Ingresa para publicar avisos
        </button>
      )}
    </section>
  );
}

function FormAviso({ onGuardar, onCancelar }: { onGuardar: (a: Omit<Aviso, 'id'>) => Promise<void>; onCancelar: () => void }) {
  const ahora = new Date();
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [nivel, setNivel] = useState<NivelAviso>('naranja');
  const [titulo, setTitulo] = useState('');
  const [numero, setNumero] = useState('');
  const [inicio, setInicio] = useState(local(ahora));
  const [fin, setFin] = useState(local(new Date(ahora.getTime() + 48 * 3600_000)));
  const [mm, setMm] = useState(40);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-xl bg-navy-700 p-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setEnviando(true);
        try {
          await onGuardar({
            nivel,
            titulo: titulo.trim(),
            numero: numero.trim() || null,
            inicio: new Date(inicio).toISOString(),
            fin: new Date(fin).toISOString(),
            lluvia_mm: mm,
            detalle: detalle.trim() || null,
          });
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setEnviando(false);
        }
      }}
    >
      <div className="grid grid-cols-3 gap-1.5">
        {(['amarillo', 'naranja', 'rojo'] as NivelAviso[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNivel(n)}
            className={`rounded-lg py-1.5 text-xs font-bold capitalize ${nivel === n ? `${NIVEL[n].bg} ${NIVEL[n].texto}` : 'bg-navy-600 text-texto-sec'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <input id="aviso-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del aviso (como figura en SENAMHI)" className="ta-input" />
      <input id="aviso-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N.º de aviso (opcional)" className="ta-input" />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-texto-sec">
          Desde
          <input id="aviso-inicio" type="datetime-local" required value={inicio} onChange={(e) => setInicio(e.target.value)} className="ta-input mt-0.5" />
        </label>
        <label className="text-[11px] text-texto-sec">
          Hasta
          <input id="aviso-fin" type="datetime-local" required value={fin} onChange={(e) => setFin(e.target.value)} className="ta-input mt-0.5" />
        </label>
      </div>
      <label className="text-[11px] text-texto-sec">
        Acumulado de lluvia esperado: <b className="text-white">{mm} mm</b>
        <input id="aviso-mm" type="range" min={5} max={150} step={5} value={mm} onChange={(e) => setMm(Number(e.target.value))} className="ta-slider mt-1 w-full" />
      </label>
      <textarea id="aviso-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2} placeholder="Detalle (opcional)" className="ta-input" />
      {error && <p className="text-xs text-aviso-rojo">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-lg border border-white/15 py-2 text-xs text-texto-sec">
          Cancelar
        </button>
        <button disabled={enviando} className="flex-1 rounded-lg bg-cian py-2 text-xs font-bold text-navy-900 disabled:opacity-60">
          {enviando ? 'Publicando…' : 'Publicar aviso'}
        </button>
      </div>
    </form>
  );
}
