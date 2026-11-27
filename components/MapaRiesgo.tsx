'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Calle, DatosTerritorio, Reporte } from '@/lib/tipos';
import { COLOR_ESTADO, ETIQUETA_ESTADO, estadoCalle, umbralMm } from '@/lib/riesgo';
import { nombreLluvia } from '@/lib/lluvia';
import type { Hora } from '@/lib/clima';
import { acumulado, enCuanto, fechaCorta, horaQueLlega, minutosConAguacero, textoMinutos } from '@/lib/tiempo';
import { NIVELES, enlaceWhatsApp, horaCorta } from '@/lib/formato';

type Props = {
  datos: DatosTerritorio | null;
  lluvia: number;
  reportes: Reporte[];
  seleccionando: boolean;
  puntoElegido: [number, number] | null;
  onElegirPunto: (p: [number, number]) => void;
  enfocar: { id: string; n: number } | null;
  vista: { centro: [number, number]; zoom: number; nombre: string };
  destacar: { n: string; sub: string; p: [number, number]; s?: number; k: number } | null;
  horas: Hora[] | null;
};

const ESTILO_AGUA: Record<string, L.PolylineOptions> = {
  rio: { color: '#1E6FD9', weight: 7, opacity: 0.85 },
  quebrada: { color: '#38BDF8', weight: 3, opacity: 0.9, dashArray: '6 5' },
  canal: { color: '#0EA5E9', weight: 2.5, opacity: 0.8 },
  dren: { color: '#67E8F9', weight: 2, opacity: 0.8, dashArray: '2 4' },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function iconoReporte(r: Reporte) {
  const n = NIVELES[r.nivel];
  return L.divIcon({
    className: '',
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -32],
    html: `<div class="ta-pin" style="--c:${n.color}"><span>${n.corto}</span></div>`,
  });
}

function popupReporte(r: Reporte) {
  const n = NIVELES[r.nivel];
  return `<div class="ta-popup">
    ${r.video_url ? `<video src="${esc(r.video_url)}" controls playsinline preload="metadata" muted style="width:100%;max-height:200px;background:#000"></video>` : r.foto_url ? `<img src="${esc(r.foto_url)}" alt="Foto del reporte" loading="lazy"/>` : ''}
    <div class="ta-popup-body">
      <span class="ta-chip" style="background:${n.color}">${esc(n.etiqueta)}</span>
      <strong>${esc(r.lugar)}</strong>
      ${r.descripcion ? `<p>${esc(r.descripcion)}</p>` : ''}
      <small>Reportado ${esc(horaCorta(r.creado))}</small>
      <a class="ta-wa" href="${esc(enlaceWhatsApp(r))}" target="_blank" rel="noopener">Compartir por WhatsApp</a>
    </div></div>`;
}

// Cuándo llegaría el agua: según el pronóstico hora por hora y si cae un aguacero fuerte.
function bloqueTiempo(T: number, horas: Hora[] | null) {
  let pron = '';
  if (horas?.length) {
    const i = horaQueLlega(T, acumulado(horas));
    pron = i == null
      ? '<p>⏱️ Con el pronóstico de 48 h <b>no llegaría a inundarse</b>.</p>'
      : `<p>⏱️ Con el pronóstico se inundaría hacia el <b>${esc(fechaCorta(horas[i].t))}</b> (${esc(enCuanto(horas[i].t))}).</p>`;
  }
  return `${pron}<small>Si empieza un aguacero fuerte (20 mm por hora), habría unos <b>${esc(textoMinutos(minutosConAguacero(T)))}</b> para salir antes de que se inunde.</small>`;
}

function popupCalle(c: Calle, lluvia: number, horas: Hora[] | null) {
  const e = estadoCalle(c, lluvia);
  const T = Math.round(umbralMm(c.s));
  const frase = e === 'critico' ? 'El agua puede cubrir esta calle.' : e === 'moderado' ? 'Puede empozarse agua. Ten cuidado.' : 'No debería inundarse.';
  return `<div class="ta-popup" style="width:240px"><div class="ta-popup-body">
    <strong>${esc(c.n || 'Calle sin nombre')}</strong>
    <span class="ta-chip" style="background:${COLOR_ESTADO[e]};color:#0A192F">${ETIQUETA_ESTADO[e]}</span>
    <p>${esc(nombreLluvia(lluvia))} (${lluvia} mm): ${frase}</p>
    <small>Empieza a inundarse con ${esc(nombreLluvia(T).toLowerCase())} (desde ≈ ${T} mm).</small>
    ${bloqueTiempo(T, horas)}
    <small style="opacity:.7">Altura ${c.z} m · a ${c.d} m de río o quebrada${c.k <= -1 ? ' · zona baja' : ''}</small>
  </div></div>`;
}

function popupBuscado(d: NonNullable<Props['destacar']>, lluvia: number, reportes: Reporte[], horas: Hora[] | null) {
  const cerca = reportes.filter((r) => Math.hypot((r.lat - d.p[0]) * 111320, (r.lon - d.p[1]) * 111320 * Math.cos((d.p[0] * Math.PI) / 180)) <= 400);
  let riesgo = '';
  if (d.s != null) {
    const e = estadoCalle({ s: d.s } as Calle, lluvia);
    const T = Math.round(umbralMm(d.s));
    riesgo = `<span class="ta-chip" style="background:${COLOR_ESTADO[e]};color:#0A192F">${ETIQUETA_ESTADO[e]} con ${esc(nombreLluvia(lluvia).toLowerCase())}</span>
      <small>En su parte más baja empieza a inundarse desde ≈ ${T} mm (${esc(nombreLluvia(T).toLowerCase())}).</small>${bloqueTiempo(T, horas)}`;
  }
  const rep = cerca.length
    ? `<p><b>🚨 ${cerca.length} ${cerca.length === 1 ? 'reporte' : 'reportes'} de vecinos a menos de 400 m.</b> El último: ${esc(NIVELES[cerca[0].nivel].etiqueta)} en ${esc(cerca[0].lugar)}, ${esc(horaCorta(cerca[0].creado))}.</p>`
    : '<p>Sin reportes de vecinos cerca por ahora.</p>';
  return `<div class="ta-popup" style="width:240px"><div class="ta-popup-body">
    <strong>${esc(d.n)}</strong><small>${esc(d.sub)}</small>${riesgo}${rep}
    <small style="opacity:.75">Mira los colores de las calles alrededor del punto celeste.</small>
  </div></div>`;
}

export default function MapaRiesgo({ datos, lluvia, reportes, seleccionando, puntoElegido, onElegirPunto, enfocar, vista, destacar, horas }: Props) {
  const horasRef = useRef(horas);
  horasRef.current = horas;
  const reportesRef = useRef(reportes);
  reportesRef.current = reportes;
  const marcaBuscada = useRef<L.Marker | null>(null);
  const vistaInicial = useRef(vista);
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaCalles = useRef<{ c: Calle; l: L.Polyline }[]>([]);
  const capaReportes = useRef<L.LayerGroup | null>(null);
  const marcadores = useRef<Map<string, L.Marker>>(new Map());
  const marcaElegida = useRef<L.CircleMarker | null>(null);
  const lluviaRef = useRef(lluvia);
  const onElegirRef = useRef(onElegirPunto);
  const seleccionandoRef = useRef(seleccionando);
  lluviaRef.current = lluvia;
  onElegirRef.current = onElegirPunto;
  seleccionandoRef.current = seleccionando;

  // Mapa base
  useEffect(() => {
    if (!div.current || mapa.current) return;
    const m = L.map(div.current, { center: vistaInicial.current.centro, zoom: vistaInicial.current.zoom, zoomControl: false, preferCanvas: true, attributionControl: true });
    L.control.zoom({ position: 'topright' }).addTo(m);
    const oscuro = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    });
    const satelite = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 18,
        attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
      }),
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, opacity: 0.9 }),
    ]);
    let enSatelite = false;
    try { enSatelite = localStorage.getItem('ta:satelite') === '1'; } catch {}
    (enSatelite ? satelite : oscuro).addTo(m);
    // Botón para cambiar entre mapa y vista satelital
    const Boton = L.Control.extend({
      onAdd() {
        const b = L.DomUtil.create('button', 'ta-capa');
        b.type = 'button';
        const pintarBoton = () => {
          b.innerHTML = enSatelite ? '🗺️<span>Mapa</span>' : '🛰️<span>Satélite</span>';
          b.setAttribute('aria-label', enSatelite ? 'Ver mapa' : 'Ver vista satelital');
        };
        pintarBoton();
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, 'click', () => {
          enSatelite = !enSatelite;
          if (enSatelite) { m.removeLayer(oscuro); satelite.addTo(m); } else { m.removeLayer(satelite); oscuro.addTo(m); }
          try { localStorage.setItem('ta:satelite', enSatelite ? '1' : '0'); } catch {}
          pintarBoton();
        });
        return b;
      },
    });
    new Boton({ position: 'topright' }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (seleccionandoRef.current) onElegirRef.current([e.latlng.lat, e.latlng.lng]);
    });
    capaReportes.current = L.layerGroup().addTo(m);
    // Mientras hay un globo de información abierto se ocultan los botones de la izquierda para que no lo tapen.
    // Con el mapa alejado solo se rotulan pueblos y distritos, no cada barrio.
    const rotulos = () => m.getContainer().classList.toggle('ta-zoom-lejos', m.getZoom() < 15);
    m.on('zoomend', rotulos);
    rotulos();
    m.on('popupopen', () => document.body.classList.add('ta-popup-abierto'));
    m.on('popupclose', () => document.body.classList.remove('ta-popup-abierto'));
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Al cambiar de ciudad, el mapa vuela hacia ella
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const c = m.getCenter();
    if (Math.abs(c.lat - vista.centro[0]) + Math.abs(c.lng - vista.centro[1]) > 0.05) m.flyTo(vista.centro, vista.zoom, { duration: 1.2 });
  }, [vista.centro, vista.zoom]);

  // Lugar encontrado con la lupa: el mapa vuela hacia él y muestra su riesgo y los reportes cercanos
  useEffect(() => {
    const m = mapa.current;
    if (!m || !destacar) return;
    marcaBuscada.current?.remove();
    const mk = L.marker(destacar.p, {
      zIndexOffset: 2000,
      icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -10], html: '<div class="ta-buscado"></div>' }),
    }).addTo(m);
    mk.bindPopup(() => {
      // Si es un barrio o caserío, se usa la calle más cercana para estimar su riesgo.
      let d = destacar;
      if (d.s == null && capaCalles.current.length) {
        let mejor = Infinity, s = 0;
        for (const { c } of capaCalles.current)
          for (const q of c.c) {
            const dd = (q[0] - d.p[0]) ** 2 + (q[1] - d.p[1]) ** 2;
            if (dd < mejor) { mejor = dd; s = c.s; }
          }
        if (mejor < 0.004 ** 2) d = { ...d, s };
      }
      return popupBuscado(d, lluviaRef.current, reportesRef.current, horasRef.current);
    }, { maxWidth: 280, minWidth: 240 });
    marcaBuscada.current = mk;
    m.flyTo(destacar.p, 17, { duration: 1.4 });
    m.once('moveend', () => mk.openPopup());
  }, [destacar]);

  // Calles, cauces y caseríos
  useEffect(() => {
    const m = mapa.current;
    if (!m || !datos) return;
    const renderer = L.canvas({ padding: 0.3, tolerance: 6 });
    const grupo = L.layerGroup().addTo(m);
    for (const w of datos.agua) {
      const l = L.polyline(w.c, { ...ESTILO_AGUA[w.t], renderer, interactive: !!w.n }).addTo(grupo);
      if (w.n) l.bindTooltip(w.n, { sticky: true, className: 'ta-tip' });
    }
    capaCalles.current = datos.calles.map((c) => {
      const principal = ['primary', 'secondary', 'trunk', 'tertiary'].includes(c.t);
      const l = L.polyline(c.c, { renderer, weight: principal ? 5 : 3.5, opacity: 0.9, lineCap: 'round' }).addTo(grupo);
      l.bindPopup(() => popupCalle(c, lluviaRef.current, horasRef.current), { maxWidth: 270 });
      return { c, l };
    });
    for (const p of datos.lugares) {
      if (!['city', 'village', 'hamlet', 'town', 'suburb', 'neighbourhood', 'isolated_dwelling', 'locality'].includes(p.t)) continue;
      const grande = p.t === 'city' || p.t === 'town' || p.t === 'village';
      L.marker(p.p, {
        interactive: false,
        icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="ta-lugar ${grande ? 'grande' : ''}">${esc(p.n)}</div>` }),
      }).addTo(grupo);
    }
    pintar(lluviaRef.current);
    return () => {
      grupo.remove();
      capaCalles.current = [];
    };
  }, [datos]);

  function pintar(mm: number) {
    for (const { c, l } of capaCalles.current) l.setStyle({ color: COLOR_ESTADO[estadoCalle(c, mm)] });
  }
  useEffect(() => pintar(lluvia), [lluvia]);

  // Reportes ciudadanos
  useEffect(() => {
    const g = capaReportes.current;
    if (!g) return;
    const vistos = new Set<string>();
    for (const r of reportes) {
      vistos.add(r.id);
      if (marcadores.current.has(r.id)) continue;
      const mk = L.marker([r.lat, r.lon], { icon: iconoReporte(r), zIndexOffset: 1000 }).bindPopup(popupReporte(r), { maxWidth: 280, minWidth: 220 });
      mk.addTo(g);
      marcadores.current.set(r.id, mk);
    }
    for (const [id, mk] of marcadores.current) if (!vistos.has(id)) { mk.remove(); marcadores.current.delete(id); }
  }, [reportes]);

  useEffect(() => {
    if (!enfocar) return;
    const mk = marcadores.current.get(enfocar.id);
    if (mk && mapa.current) {
      mapa.current.setView(mk.getLatLng(), Math.max(mapa.current.getZoom(), 17));
      mk.openPopup();
    }
  }, [enfocar, reportes]);

  // Punto elegido para un nuevo reporte
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    marcaElegida.current?.remove();
    marcaElegida.current = null;
    if (puntoElegido) {
      marcaElegida.current = L.circleMarker(puntoElegido, { radius: 10, color: '#FFFFFF', weight: 3, fillColor: '#14B8D4', fillOpacity: 1 }).addTo(m);
      if (!m.getBounds().contains(puntoElegido)) m.panTo(puntoElegido);
    }
  }, [puntoElegido]);

  useEffect(() => {
    div.current?.classList.toggle('ta-seleccionando', seleccionando);
  }, [seleccionando]);

  return <div ref={div} className="h-full w-full" role="application" aria-label={`Mapa de riesgo de inundación de ${vista.nombre}`} />;
}
