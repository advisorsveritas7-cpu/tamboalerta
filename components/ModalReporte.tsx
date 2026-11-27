'use client';
import { useEffect, useRef, useState } from 'react';
import type { NivelAgua, Reporte } from '@/lib/tipos';
import { NIVELES } from '@/lib/formato';
import { comprimirFoto } from '@/lib/foto';
import { prepararVideo } from '@/lib/video';
import { crearReporte } from '@/lib/datos';

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  punto: [number, number] | null;
  setPunto: (p: [number, number] | null) => void;
  onElegirEnMapa: () => void; // oculta el modal para tocar el mapa
  onCreado: (r: Reporte) => void;
};

const SUGERENCIAS = ['Dren colapsado', 'Pase bloqueado', 'Buzón rebalsado', 'Agua estancada', 'Corriente fuerte'];

export function ModalReporte({ abierto, onCerrar, punto, setPunto, onElegirEnMapa, onCreado }: Props) {
  const [lugar, setLugar] = useState('');
  const [nivel, setNivel] = useState<NivelAgua | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState<Blob | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [pesoOriginal, setPesoOriginal] = useState<number | null>(null);
  const [gps, setGps] = useState<'idle' | 'buscando' | 'error'>('idle');
  const [comprimiendo, setComprimiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputVideo = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<{ blob: Blob; tipo: string; segundos: number } | null>(null);
  const [vistaVideo, setVistaVideo] = useState<string | null>(null);
  const [avanceVideo, setAvanceVideo] = useState<number | null>(null);

  async function elegirVideo(f: File | undefined) {
    if (!f) return;
    setError(null);
    setAvanceVideo(0);
    try {
      const v = await prepararVideo(f, setAvanceVideo);
      setVideo(v);
      setVistaVideo(URL.createObjectURL(v.blob));
    } catch (e) {
      setError((e as Error).message || 'No se pudo usar ese video.');
    } finally {
      setAvanceVideo(null);
    }
  }

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  function usarGps() {
    if (!('geolocation' in navigator)) return setGps('error');
    setGps('buscando');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPunto([pos.coords.latitude, pos.coords.longitude]);
        setGps('idle');
      },
      () => setGps('error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function elegirFoto(f: File | undefined) {
    if (!f) return;
    setError(null);
    setComprimiendo(true);
    try {
      const b = await comprimirFoto(f);
      setFoto(b);
      setPesoOriginal(f.size);
      setVista(URL.createObjectURL(b));
    } catch {
      setError('No se pudo leer la foto. Intenta con otra.');
    } finally {
      setComprimiendo(false);
    }
  }

  function limpiar() {
    setLugar('');
    setNivel(null);
    setDescripcion('');
    setFoto(null);
    setVista(null);
    setVideo(null);
    setVistaVideo(null);
    setPesoOriginal(null);
    setPunto(null);
    setError(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!punto) return setError('Marca la ubicación con el GPS o tocando el mapa.');
    if (!nivel) return setError('Elige el nivel del agua.');
    setEnviando(true);
    setError(null);
    try {
      const r = await crearReporte(
        { lat: punto[0], lon: punto[1], lugar: lugar.trim(), nivel, descripcion: descripcion.trim() || null },
        foto,
        video,
      );
      onCreado(r);
      limpiar();
      onCerrar();
    } catch (err) {
      setError((err as Error).message || 'No se pudo enviar. Revisa tu señal e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) return null;
  const kb = (n: number) => `${Math.round(n / 1024)} KB`;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rep-titulo" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-navy-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-start justify-between">
          <div>
            <h2 id="rep-titulo" className="font-display text-lg font-extrabold text-white">Reportar calle inundada</h2>
            <p className="text-xs text-texto-sec">Solo el estado de la calle y si se puede pasar.</p>
          </div>
          <button type="button" onClick={onCerrar} className="-mr-2 -mt-1 rounded-full p-2 text-texto-sec hover:text-white" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* 1. Ubicación */}
        <fieldset className="mt-4">
          <legend className="ta-legend">1 · Ubicación</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={usarGps} className="ta-opcion">
              {gps === 'buscando' ? 'Buscando…' : '📍 Usar mi GPS'}
            </button>
            <button type="button" onClick={onElegirEnMapa} className="ta-opcion">
              🗺️ Tocar en el mapa
            </button>
          </div>
          <p className={`mt-1.5 text-[11px] ${punto ? 'text-cian-300' : gps === 'error' ? 'text-aviso-naranja' : 'text-texto-sec'}`}>
            {punto
              ? `Ubicación marcada: ${punto[0].toFixed(5)}, ${punto[1].toFixed(5)}`
              : gps === 'error'
                ? 'No se pudo usar el GPS. Toca el punto en el mapa.'
                : 'Aún no hay ubicación.'}
          </p>
          <input
            id="rep-lugar"
            required
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            placeholder="Calle, sector o caserío (ej. Av. Grau, AA.HH. Santa Cruz)"
            className="ta-input mt-2"
            maxLength={120}
          />
        </fieldset>

        {/* 2. Nivel del agua */}
        <fieldset className="mt-4">
          <legend className="ta-legend">2 · Nivel del agua</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(Object.keys(NIVELES) as NivelAgua[]).map((k) => {
              const n = NIVELES[k];
              const activo = nivel === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNivel(k)}
                  aria-pressed={activo}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2.5 text-center transition ${activo ? 'bg-white/5' : 'border-white/10 bg-navy-700'}`}
                  style={activo ? { borderColor: n.color } : undefined}
                >
                  <Silueta nivel={k} color={n.color} />
                  <span className="text-[11px] font-bold leading-tight text-white">{n.etiqueta}</span>
                </button>
              );
            })}
          </div>
          {nivel && <p className="mt-1 text-[11px] text-texto-sec">{NIVELES[nivel].detalle}</p>}
        </fieldset>

        {/* 3. Foto */}
        <fieldset className="mt-4">
          <legend className="ta-legend">3 · Foto o video (recomendado)</legend>
          <input ref={inputFoto} id="rep-foto" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => elegirFoto(e.target.files?.[0])} />
          {vista ? (
            <div className="relative mt-1.5 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={vista} alt="Vista previa" className="max-h-48 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-1.5 text-[11px] text-white">
                <span>
                  {pesoOriginal && foto ? `${kb(pesoOriginal)} → ${kb(foto.size)}` : ''} comprimida
                </span>
                <button type="button" onClick={() => inputFoto.current?.click()} className="font-semibold text-cian-300">
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => inputFoto.current?.click()} className="ta-opcion mt-1.5 w-full py-4">
              {comprimiendo ? 'Comprimiendo…' : '📷 Tomar o elegir foto'}
            </button>
          )}
          <input ref={inputVideo} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => elegirVideo(e.target.files?.[0])} />
          {vistaVideo ? (
            <div className="relative mt-2 overflow-hidden rounded-xl bg-black">
              <video src={vistaVideo} controls playsInline muted className="max-h-48 w-full" />
              <div className="flex items-center justify-between bg-black/60 px-3 py-1.5 text-[11px] text-white">
                <span>Video de {video?.segundos} s · {video ? kb(video.blob.size) : ''}</span>
                <button type="button" onClick={() => { setVideo(null); setVistaVideo(null); }} className="font-semibold text-cian-300">Quitar</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={avanceVideo != null} onClick={() => inputVideo.current?.click()} className="ta-opcion mt-2 w-full py-3">
              {avanceVideo != null ? `Achicando video… ${Math.round(avanceVideo * 100)}%` : '🎥 Grabar video corto (máx. 15 s)'}
            </button>
          )}
        </fieldset>

        {/* 4. Descripción */}
        <fieldset className="mt-4">
          <legend className="ta-legend">4 · Descripción (opcional)</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" onClick={() => setDescripcion(s)} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-texto-sec hover:border-cian hover:text-white">
                {s}
              </button>
            ))}
          </div>
          <input id="rep-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Dren colapsado" maxLength={140} className="ta-input mt-2" />
        </fieldset>

        {error && <p className="mt-3 rounded-lg bg-aviso-rojo/15 px-3 py-2 text-xs text-white">{error}</p>}

        <button
          disabled={enviando || comprimiendo}
          className="mt-4 w-full rounded-2xl bg-cian py-3.5 font-display text-base font-extrabold text-navy-900 shadow-lg shadow-cian/20 hover:bg-cian-300 disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : 'Enviar reporte'}
        </button>
      </form>
    </div>
  );
}

/** Silueta humana con el nivel del agua dibujado. */
function Silueta({ nivel, color }: { nivel: NivelAgua; color: string }) {
  const y = nivel === 'tobillos' ? 33 : nivel === 'rodillas' ? 26 : 17;
  return (
    <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true">
      <circle cx="15" cy="5" r="3.6" fill="#CBD5E1" />
      <path d="M10 10h10l1.5 11h-3l-.5 15h-3l-.2-9h-.6l-.2 9h-3l-.5-15h-3z" fill="#CBD5E1" />
      <rect x="0" y={y} width="30" height={38 - y} fill={color} opacity=".75" />
    </svg>
  );
}
