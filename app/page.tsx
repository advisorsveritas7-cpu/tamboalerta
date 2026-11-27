'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { SimuladorLluvia } from '@/components/SimuladorLluvia';
import { PanelClima } from '@/components/PanelClima';
import { PanelAvisos } from '@/components/PanelAvisos';
import { ModalReporte } from '@/components/ModalReporte';
import { ListaReportes } from '@/components/ListaReportes';
import { AccesoCoordinador } from '@/components/AccesoCoordinador';
import { Bienvenida } from '@/components/Bienvenida';
import { VentanaSimulacion } from '@/components/VentanaSimulacion';
import { Vista3D } from '@/components/Vista3D';
import { SelectorCiudad } from '@/components/SelectorCiudad';
import { Buscador, type Resultado } from '@/components/Buscador';
import { CIUDAD_INICIAL, ciudadPorId, nombreCorto } from '@/lib/ciudades';
import type { Aviso, DatosTerritorio, Reporte } from '@/lib/tipos';
import { obtenerPronostico, type Pronostico } from '@/lib/clima';
import { escucharAvisos, escucharReportes, listarAvisos, listarReportes, publicarAviso, retirarAviso } from '@/lib/datos';
import { COLOR_ESTADO } from '@/lib/riesgo';
import { MODO_SUPABASE } from '@/lib/config';
import { supabase } from '@/lib/supabase';

const MapaRiesgo = dynamic(() => import('@/components/MapaRiesgo'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-texto-sec">Cargando mapa…</div>,
});

type Pestana = 'mapa' | 'clima' | 'avisos' | 'reportes';

export default function Inicio() {
  const [datos, setDatos] = useState<DatosTerritorio | null>(null);
  const [lluvia, setLluvia] = useState(25);
  const [origenLluvia, setOrigenLluvia] = useState<string | null>('Moderada: lluvia de varias horas');
  const lluviaTocada = useRef(false);
  const [guia, setGuia] = useState(false);
  const [animacion, setAnimacion] = useState(false);
  const [idCiudad, setIdCiudad] = useState<string | null>(null);
  const [selector, setSelector] = useState(false);
  const [sinDatos, setSinDatos] = useState(false);
  const [buscador, setBuscador] = useState(false);
  const [vista3d, setVista3d] = useState(false);
  const [destacar, setDestacar] = useState<{ n: string; sub: string; p: [number, number]; s?: number; k: number } | null>(null);
  const ciudad = ciudadPorId(idCiudad ?? CIUDAD_INICIAL);
  const [clima, setClima] = useState<Pronostico | null>(null);
  const [errorClima, setErrorClima] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [modal, setModal] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [punto, setPunto] = useState<[number, number] | null>(null);
  const [enfocar, setEnfocar] = useState<{ id: string; n: number } | null>(null);
  const [pestana, setPestana] = useState<Pestana>('mapa');
  const [enLinea, setEnLinea] = useState(true);
  const [coordinador, setCoordinador] = useState(!MODO_SUPABASE);
  const [loginAbierto, setLoginAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const notificar = useCallback((t: string) => {
    setAviso(t);
    setTimeout(() => setAviso(null), 3500);
  }, []);

  // Ciudad elegida: ?c= en el enlace, o la última usada en este teléfono
  useEffect(() => {
    let id: string | null = new URLSearchParams(location.search).get('c');
    try { id = id || localStorage.getItem('ta:ciudad'); } catch {}
    setIdCiudad(ciudadPorId(id).id);
  }, []);
  const cambiarCiudad = (id: string) => {
    setSelector(false);
    if (id === idCiudad) return;
    lluviaTocada.current = false;
    setClima(null);
    setIdCiudad(id);
    try { localStorage.setItem('ta:ciudad', id); } catch {}
    const u = new URL(location.href);
    u.searchParams.set('c', id);
    history.replaceState(null, '', u);
  };

  // Datos territoriales de la ciudad (estáticos, cacheados por el service worker)
  useEffect(() => {
    if (!idCiudad) return;
    let vivo = true;
    setDatos(null);
    setSinDatos(false);
    fetch(`./data/${idCiudad}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => vivo && setDatos(d))
      .catch(() => vivo && setSinDatos(true));
    return () => { vivo = false; };
  }, [idCiudad]);

  // Pronóstico de la ciudad
  useEffect(() => {
    if (!idCiudad) return;
    let vivo = true;
    const cargar = () =>
      obtenerPronostico(ciudadPorId(idCiudad).centro, idCiudad)
        .then((p) => {
          if (!vivo) return;
          setClima(p);
          setErrorClima(false);
          // Al abrir, el mapa muestra la lluvia esperada de verdad (si el vecino aún no eligió otra).
          if (!lluviaTocada.current) {
            setLluvia(Math.min(150, Math.round(p.total48)));
            setOrigenLluvia(`Lluvia prevista para las próximas 48 h: ${p.total48} mm`);
          }
        })
        .catch(() => vivo && setErrorClima(true));
    cargar();
    const t = setInterval(cargar, 30 * 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [idCiudad]);

  // Avisos y reportes + tiempo real
  const recargarAvisos = useCallback(() => listarAvisos().then(setAvisos).catch(() => {}), []);
  useEffect(() => {
    recargarAvisos();
    return escucharAvisos(recargarAvisos);
  }, [recargarAvisos]);

  useEffect(() => {
    listarReportes()
      .then((rs) => {
        setReportes(rs);
        const id = new URLSearchParams(location.search).get('r');
        if (id) setEnfocar({ id, n: Date.now() });
      })
      .catch(() => notificar('No se pudieron cargar los reportes.'));
    return escucharReportes((r) => {
      setReportes((prev) => (prev.some((x) => x.id === r.id) ? prev : [r, ...prev]));
    });
  }, [notificar]);

  // Guía de bienvenida la primera vez
  useEffect(() => {
    try {
      if (!localStorage.getItem('ta:guia')) setGuia(true);
    } catch {}
  }, []);
  const cerrarGuia = () => {
    setGuia(false);
    try { localStorage.setItem('ta:guia', '1'); } catch {}
  };

  // Conectividad
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    setEnLinea(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Sesión de coordinador (solo en modo Supabase)
  useEffect(() => {
    const psb = supabase();
    if (!psb) return;
    let fin = () => {};
    psb.then((sb) => {
      sb.auth.getSession().then(({ data }) => setCoordinador(!!data.session));
      const { data } = sb.auth.onAuthStateChange((_e, s) => setCoordinador(!!s));
      fin = () => data.subscription.unsubscribe();
    });
    return () => fin();
  }, []);

  const calles = useMemo(() => datos?.calles ?? [], [datos]);
  // En las ciudades nuevas solo se rotulan los lugares cercanos, para no saturar el mapa.
  const datosMapa = useMemo(() => {
    if (!datos || !(datos.meta as { ciudad?: string }).ciudad) return datos;
    const [la, lo] = ciudad.centro;
    const lim = ciudad.radioKm + 2;
    const km = ([a, b]: [number, number]) => Math.hypot((a - la) * 111.3, (b - lo) * 111.3 * Math.cos((la * Math.PI) / 180));
    return { ...datos, lugares: datos.lugares.filter((l) => km(l.p) <= lim) };
  }, [datos, ciudad]);

  const simular = (mm: number, origen: string) => {
    lluviaTocada.current = true;
    setLluvia(Math.max(0, Math.min(150, mm)));
    setOrigenLluvia(origen);
    setPestana('mapa');
  };

  const elegirPunto = (p: [number, number]) => {
    setPunto(p);
    setSeleccionando(false);
    setModal(true);
  };

  const verReporte = (r: Reporte) => {
    setPestana('mapa');
    setEnfocar({ id: r.id, n: Date.now() });
  };

  const panelLateral = (
    <>
      <PanelAvisos
        avisos={avisos}
        onImpacto={(a) => simular(a.lluvia_mm, `Aviso ${a.nivel.toUpperCase()} SENAMHI: ${a.lluvia_mm} mm`)}
        onPublicar={async (a) => {
          await publicarAviso(a);
          await recargarAvisos();
          notificar('Aviso publicado');
        }}
        onRetirar={async (id) => {
          await retirarAviso(id);
          await recargarAvisos();
        }}
        puedePublicar={coordinador}
        onIngresar={() => setLoginAbierto(true)}
      />
      <PanelClima ciudad={nombreCorto(ciudad)} onAnimacion={() => setAnimacion(true)} p={clima} error={errorClima} onSimular={(mm) => simular(mm, `Lluvia prevista para las próximas 48 h: ${clima?.total48 ?? mm} mm`)} />
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col">
      <Encabezado enLinea={enLinea} onAyuda={() => setGuia(true)} onBuscar={() => setBuscador(true)} />

      {/* Banda de aviso vigente más alto */}
      {avisos[0] && (
        <button
          type="button"
          onClick={() => setPestana('avisos')}
          className={`flex items-center gap-2 px-4 py-1.5 text-left text-xs font-semibold lg:hidden ${
            avisos.some((a) => a.nivel === 'rojo') ? 'bg-aviso-rojo text-white' : avisos.some((a) => a.nivel === 'naranja') ? 'bg-aviso-naranja text-navy-900' : 'bg-aviso-amarillo text-navy-900'
          }`}
        >
          <span className="font-extrabold">AVISO SENAMHI</span>
          <span className="truncate">{avisos[0].titulo}</span>
        </button>
      )}

      <main className="relative flex min-h-0 flex-1 pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">
        {/* Mapa (siempre montado) */}
        <div className={`relative min-w-0 flex-1 ${pestana === 'mapa' ? '' : 'hidden lg:block'}`}>
          {idCiudad && <MapaRiesgo
            datos={datosMapa}
            lluvia={lluvia}
            reportes={reportes}
            seleccionando={seleccionando}
            puntoElegido={punto}
            onElegirPunto={elegirPunto}
            enfocar={enfocar}
            vista={{ centro: ciudad.centro, zoom: ciudad.zoom, nombre: nombreCorto(ciudad) }}
            destacar={destacar}
            horas={clima ? clima.horas : null}
          />}

          {/* Simulador sobre el mapa */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1001] p-3 pb-[4.5rem] lg:left-auto lg:right-12 lg:top-0 lg:w-[410px] lg:pb-3">
            <div className="pointer-events-auto">
              <SimuladorLluvia
                lluvia={lluvia}
                setLluvia={(n, o) => { lluviaTocada.current = true; setLluvia(n); setOrigenLluvia(o ?? null); }}
                calles={calles}
                origen={origenLluvia}
                pronostico48={clima ? clima.total48 : null}
                horas={clima ? clima.horas : null}
              />
            </div>
          </div>

          {/* Ciudad, leyenda y simulación (columna superior izquierda) */}
          <div className="ta-col-izq absolute left-3 top-3 z-[500] flex max-w-[60%] flex-col items-start gap-2 transition-opacity">
            <button
              type="button"
              onClick={() => setSelector(true)}
              className="flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-navy-900 shadow-lg"
              aria-label={`Ciudad: ${ciudad.nombre}. Cambiar ciudad`}
            >
              <span aria-hidden="true">📍</span>
              <span className="truncate">{nombreCorto(ciudad)}</span>
              <span className="text-[10px] text-navy-900/60" aria-hidden="true">▼</span>
            </button>
            <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-navy-900/85 px-3 py-2 text-[10px] text-texto-sec backdrop-blur">
              {(
                [
                  ['bajo', 'Sin peligro'],
                  ['moderado', 'Cuidado'],
                  ['critico', 'Se inunda'],
                ] as const
              ).map(([k, t]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <i className="inline-block h-1 w-4 rounded" style={{ background: COLOR_ESTADO[k] }} />
                  {t}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-1 w-4 rounded bg-[#1E6FD9]" />
                Río / quebrada
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAnimacion(true)}
              className="flex items-center gap-1.5 rounded-full bg-cian px-3 py-1.5 text-[11px] font-extrabold text-navy-900 shadow-lg"
            >
              ▶ Pronóstico de lluvia
            </button>
            <button
              type="button"
              onClick={() => setVista3d(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-navy-900/90 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-lg"
            >
              🏔️ Vista 3D
            </button>
          </div>

          {sinDatos && (
            <div className="absolute inset-x-3 top-[34%] z-[500] mx-auto max-w-sm rounded-2xl border border-white/10 bg-navy-800/95 p-4 text-center text-sm text-texto-sec shadow-xl">
              <p className="font-display font-bold text-white">Preparando el mapa de calles de {nombreCorto(ciudad)}</p>
              <p className="mt-1">Mientras tanto puedes ver el pronóstico, los avisos y el pronóstico animado, y reportar calles inundadas.</p>
            </div>
          )}

          {seleccionando && (
            <div className="absolute inset-x-3 top-3 z-[600] rounded-xl bg-cian px-4 py-3 text-center text-sm font-bold text-navy-900 shadow-xl">
              Toca la calle inundada en el mapa
              <button type="button" onClick={() => { setSeleccionando(false); setModal(true); }} className="ml-3 underline">
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Paneles: pestañas en móvil, barra lateral en escritorio */}
        <aside
          className={`min-h-0 w-full overflow-y-auto bg-navy-900 lg:block lg:w-[380px] lg:border-l lg:border-white/10 ${pestana === 'mapa' ? 'hidden' : ''}`}
        >
          <div className="flex flex-col gap-3 p-3 pb-24 lg:pb-6">
            <div className={pestana === 'reportes' ? '' : 'contents'}>
              {pestana !== 'reportes' && panelLateral}
            </div>
            <div className={pestana === 'reportes' ? '' : 'hidden lg:block'}>
              <ListaReportes reportes={reportes} onVer={verReporte} />
            </div>
          </div>
        </aside>
      </main>

      {/* Botón flotante */}
      {!modal && !seleccionando && (
        <button
          type="button"
          onClick={() => setModal(true)}
          className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-4 z-[1500] flex items-center gap-2 rounded-full bg-cian px-5 py-3.5 font-display text-sm font-extrabold text-navy-900 shadow-2xl shadow-cian/30 hover:bg-cian-300 lg:bottom-6 lg:right-[400px]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Reportar Calle Inundada
        </button>
      )}

      {/* Navegación inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-[1400] grid grid-cols-4 border-t border-white/10 bg-navy-800/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Secciones">
        {(
          [
            ['mapa', 'Mapa', 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14'],
            ['avisos', 'Avisos', 'M12 3 2 20h20L12 3Zm0 6v5m0 3v.5'],
            ['clima', 'Clima', 'M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7Zm1 3 1-2m3 2 1-2m3 2 1-2'],
            ['reportes', `En vivo${reportes.length ? ` (${reportes.length})` : ''}`, 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
          ] as [Pestana, string, string][]
        ).map(([k, t, d]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPestana(k)}
            aria-current={pestana === k ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${pestana === k ? 'text-cian' : 'text-texto-sec'}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={d} />
            </svg>
            {t}
          </button>
        ))}
      </nav>

      <ModalReporte
        abierto={modal}
        onCerrar={() => setModal(false)}
        punto={punto}
        setPunto={setPunto}
        onElegirEnMapa={() => {
          setModal(false);
          setPestana('mapa');
          setSeleccionando(true);
        }}
        onCreado={(r) => {
          setReportes((prev) => (prev.some((x) => x.id === r.id) ? prev : [r, ...prev]));
          setPestana('mapa');
          setEnfocar({ id: r.id, n: Date.now() });
          notificar('Reporte enviado. ¡Gracias por avisar!');
        }}
      />

      {animacion && <VentanaSimulacion centro={ciudad.centro} nombre={nombreCorto(ciudad)} onCerrar={() => setAnimacion(false)} />}

      {vista3d && (
        <Vista3D datos={datos} lluvia={lluvia} centro={ciudad.centro} nombre={nombreCorto(ciudad)} onCerrar={() => setVista3d(false)} />
      )}

      {buscador && (
        <Buscador
          reportes={reportes}
          onCerrar={() => setBuscador(false)}
          onElegir={(r: Resultado) => {
            setBuscador(false);
            setPestana('mapa');
            cambiarCiudad(r.c);
            if (r.t !== 'ciudad') {
              const c = ciudadPorId(r.c);
              setDestacar({ n: r.n, sub: `${r.t === 'calle' ? 'Calle' : 'Barrio o caserío'} · ${nombreCorto(c)}`, p: r.p, s: r.s, k: Date.now() });
            }
          }}
        />
      )}

      {selector && <SelectorCiudad actual={ciudad.id} onElegir={(c) => cambiarCiudad(c.id)} onCerrar={() => setSelector(false)} />}

      {guia && <Bienvenida onCerrar={cerrarGuia} />}

      {loginAbierto && <AccesoCoordinador onCerrar={() => setLoginAbierto(false)} />}

      {aviso && (
        <div role="status" className="fixed left-1/2 top-20 z-[3000] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-xl">
          {aviso}
        </div>
      )}
    </div>
  );
}
