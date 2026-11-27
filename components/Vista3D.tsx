'use client';
import { useEffect, useRef, useState } from 'react';
import type { DatosTerritorio } from '@/lib/tipos';
import { COLOR_ESTADO, estadoCalle } from '@/lib/riesgo';
import { nombreLluvia } from '@/lib/lluvia';

// Vista 3D: relieve real (exagerado) con foto satelital y las calles coloreadas según la lluvia elegida.
// MapLibre se descarga solo al abrir esta ventana, para que la app siga liviana.
const VERSION = '4.7.1';
type ML = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function cargarMapLibre(): Promise<ML> {
  const w = window as unknown as { maplibregl?: ML };
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  return new Promise((ok, mal) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.css`;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = `https://unpkg.com/maplibre-gl@${VERSION}/dist/maplibre-gl.js`;
    s.onload = () => ok(w.maplibregl);
    s.onerror = () => mal(new Error('sin conexión'));
    document.head.appendChild(s);
  });
}

type Props = { datos: DatosTerritorio | null; lluvia: number; centro: [number, number]; nombre: string; onCerrar: () => void };

export function Vista3D({ datos, lluvia, centro, nombre, onCerrar }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<ML>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [relieve, setRelieve] = useState(4);

  const geo = () => ({
    type: 'FeatureCollection',
    features: (datos?.calles ?? []).map((c) => ({
      type: 'Feature',
      properties: { color: COLOR_ESTADO[estadoCalle(c, lluvia)], n: c.n ?? '' },
      geometry: { type: 'LineString', coordinates: c.c.map(([la, lo]) => [lo, la]) },
    })),
  });
  const geoAgua = () => ({
    type: 'FeatureCollection',
    features: (datos?.agua ?? []).map((w) => ({
      type: 'Feature',
      properties: { t: w.t },
      geometry: { type: 'LineString', coordinates: w.c.map(([la, lo]) => [lo, la]) },
    })),
  });

  useEffect(() => {
    let vivo = true;
    cargarMapLibre()
      .then((maplibregl) => {
        if (!vivo || !div.current) return;
        const m = new maplibregl.Map({
          container: div.current,
          center: [centro[1], centro[0]],
          zoom: 14.5,
          pitch: 62,
          bearing: -20,
          maxPitch: 80,
          attributionControl: { compact: true },
          style: {
            version: 8,
            sources: {
              sat: {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: 'Imágenes © Esri · Relieve: AWS Terrain Tiles',
              },
              dem: {
                type: 'raster-dem',
                tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                tileSize: 256,
                encoding: 'terrarium',
                maxzoom: 14,
              },
            },
            layers: [
              { id: 'sat', type: 'raster', source: 'sat' },
              { id: 'sombras', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#0A192F' } },
            ],
            terrain: { source: 'dem', exaggeration: 4 },
            sky: {},
          },
        });
        m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        m.on('load', () => {
          m.addSource('agua', { type: 'geojson', data: geoAgua() });
          m.addLayer({ id: 'agua', type: 'line', source: 'agua', paint: { 'line-color': '#38BDF8', 'line-width': ['match', ['get', 't'], 'rio', 8, 3], 'line-opacity': 0.9 } });
          m.addSource('calles', { type: 'geojson', data: geo() });
          m.addLayer({
            id: 'calles',
            type: 'line',
            source: 'calles',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 5], 'line-opacity': 0.95 },
          });
          setEstado('listo');
        });
        m.on('error', () => {});
        mapa.current = m;
      })
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La lluvia o los datos cambian: se repintan las calles.
  useEffect(() => {
    const src = mapa.current?.getSource?.('calles');
    if (src) src.setData(geo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lluvia, datos]);

  useEffect(() => {
    mapa.current?.setTerrain?.({ source: 'dem', exaggeration: relieve });
  }, [relieve]);

  return (
    <div className="fixed inset-0 z-[3500] flex flex-col bg-navy-900" role="dialog" aria-modal="true" aria-labelledby="v3d-titulo">
      <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h2 id="v3d-titulo" className="font-display text-base font-extrabold text-white">Vista 3D · {nombre}</h2>
          <p className="text-[11px] text-texto-sec">
            {nombreLluvia(lluvia)} ({lluvia} mm). Arrastra con dos dedos para inclinar y girar.
          </p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-700 text-lg text-white">
          ×
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={div} className="h-full w-full" />
        {estado === 'cargando' && <p className="absolute inset-0 grid place-items-center text-sm text-texto-sec">Cargando vista 3D…</p>}
        {estado === 'error' && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-texto-sec">No se pudo cargar la vista 3D. Revisa tu conexión.</p>
        )}
        <div className="absolute inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-2xl border border-white/10 bg-navy-800/95 p-3 text-xs text-texto-sec backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 rounded" style={{ background: COLOR_ESTADO.bajo }} />Sin peligro</span>
            <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 rounded" style={{ background: COLOR_ESTADO.moderado }} />Cuidado</span>
            <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 rounded" style={{ background: COLOR_ESTADO.critico }} />Se inunda</span>
            <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 rounded bg-[#38BDF8]" />Río / quebrada</span>
          </div>
          <label className="mt-2 flex items-center gap-2">
            <span className="shrink-0">Relieve ×{relieve}</span>
            <input type="range" min={1} max={8} value={relieve} onChange={(e) => setRelieve(Number(e.target.value))} className="ta-slider w-full" />
          </label>
          <p className="mt-1 text-[10px] text-texto-sec/70">El relieve está exagerado para que se noten las zonas bajas, donde se junta el agua.</p>
        </div>
      </div>
    </div>
  );
}
