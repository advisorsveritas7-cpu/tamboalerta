# TamboAlerta · PREVENIR ES PROTEGER VIDAS

Aplicación web progresiva (PWA) de monitoreo de lluvias, riesgo de inundación por calle y reporte ciudadano para el distrito de **Tambogrande, Piura**.

- **Mapa de riesgo por calle**: 406 calles reales del casco urbano de Tambogrande (OpenStreetMap) coloreadas en verde, amarillo o rojo según la lluvia acumulada.
- **Simulador de lluvia (0–150 mm)**: muestra qué calles se anegarían primero.
- **Pronóstico de 48 h** de Open-Meteo (temperatura, probabilidad y mm por hora). Un botón lo pasa al simulador.
- **Avisos SENAMHI – Piura**: tarjetas Amarillo, Naranja y Rojo. Los coordinadores publican el aviso vigente y el botón "Ver impacto en el mapa" aplica su acumulado.
- **Reportar Calle Inundada**: GPS o toque en el mapa, calle o sector, nivel del agua (tobillos, rodillas o cintura), foto comprimida en el teléfono (de 3–5 MB a ~150 KB) y una descripción corta. Cada reporte aparece como pin con foto, hora y botón de WhatsApp.
- **Liviana y sin señal**: unos 117 KB de JS en la primera carga. Supabase se carga solo si está configurado. El service worker guarda la app, los datos de calles y las teselas del mapa ya vistas.

## Probar ya (modo local, sin credenciales)

```bash
npm install
npm run dev        # http://localhost:3000
```

Sin variables de entorno la app funciona en **modo local**: los reportes y avisos se guardan en el navegador de ese teléfono y se sincronizan entre pestañas. Sirve para probar y hacer demostraciones. **Para que los vecinos vean los reportes de los demás hay que activar Supabase.**

## Activar el tiempo real con Supabase (unos 10 minutos)

1. Crea un proyecto gratuito en https://supabase.com.
2. En **SQL Editor**, pega y ejecuta `supabase/schema.sql`. Crea las tablas `reportes` y `avisos`, los permisos, el bucket `fotos` y el tiempo real.
3. En **Authentication > Users**, crea las cuentas de los coordinadores (por ejemplo Defensa Civil o la Municipalidad). En **Authentication > Providers > Email**, desactiva "Allow new users to sign up" para que solo ellos publiquen avisos.
4. Copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (están en Settings > API).
5. `npm run dev`. La etiqueta del encabezado cambia de "Modo local" a "En vivo".

Los ciudadanos reportan sin crear cuenta, para que sea rápido en plena emergencia. Los reportes se muestran durante 72 horas.

## Publicar en internet (gratis)

`npm run build` genera la carpeta `out/` con archivos estáticos.

- **Vercel**: importa el repositorio, agrega las dos variables de entorno y publica.
- **Netlify** o **Cloudflare Pages**: comando de build `npm run build`, carpeta de publicación `out`.

La URL resultante es la que se comparte por WhatsApp. La imagen de vista previa del enlace está en `public/icons/og.png`.

## Cómo se calcula el riesgo por calle

Archivo de datos: `public/data/tambogrande.json`. Se genera con `node scripts/construir-desde-osm.mjs` a partir de `scripts/osm/`:

- `vias.txt`: calles, Río Piura y quebradas (San Francisco, Carneros) de OpenStreetMap, extraídos el 27/11/2026.
- `lugares.txt`: caseríos y sectores (Cruceta, Malingas, Locuto, Pedregal y otros 100).
- `grilla-elevacion.json`: grilla de elevación de 100 m (Copernicus DEM GLO-90 vía Open-Meteo) sobre el casco urbano.

Para cada calle se calcula una **susceptibilidad** de 0 a 1 (`scripts/procesar.mjs`):

| Factor | Peso | Lectura |
|---|---|---|
| Altura sobre el cauce más cercano | 40 % | 0 m → máximo, 8 m o más → nada |
| Distancia a río, quebrada o dren | 25 % | 0 m → máximo, 400 m o más → nada |
| Zona baja o cuenca ciega (cota frente a su entorno de 300 m) | 25 % | 3 m o más por debajo → máximo |
| Calle sin pavimento | 10 % | |

Umbral de anegamiento: `T = 15 + 105·(1 − s)^1.3` mm. Una calle se pinta en rojo si la lluvia es mayor o igual a T, en amarillo desde el 60 % de T y en verde por debajo (`lib/riesgo.ts`).

> Es un modelo simplificado y **no está calibrado** con eventos reales. El DEM de 90 m no ve drenes, cunetas ni puentes. El siguiente paso es ajustar pesos y umbrales con los reportes ciudadanos y el registro de zonas críticas de Defensa Civil. Es una guía para prevenir y no reemplaza la evaluación oficial.

Para ampliar la zona (por ejemplo, las calles de Malingas o La Cruceta) ejecuta `npm run datos`. Descarga OpenStreetMap y elevaciones en vivo y necesita internet. Ajusta los recuadros en `scripts/generar-datos.mjs`.

## Estructura

```
app/            layout (PWA, fuentes, metadatos) y página principal
components/     MapaRiesgo (Leaflet), SimuladorLluvia, PanelClima, PanelAvisos,
                ModalReporte, ListaReportes, AccesoCoordinador, Encabezado, Logo
lib/            riesgo, clima (Open-Meteo), datos (Supabase o local), foto (compresión),
                formato (WhatsApp, horas en America/Lima), tipos, config
public/         manifest, service worker, íconos y datos de calles
scripts/        generación de datos (OSM + DEM) e íconos
supabase/       schema.sql
vista-previa/   empaquetado sin Next.js para la vista previa publicada
```

## Créditos de datos

- Calles, cauces y caseríos: © colaboradores de OpenStreetMap (licencia ODbL).
- Elevación: Copernicus DEM GLO-90 (© DLR, Airbus), servido por Open-Meteo.
- Pronóstico: Open-Meteo (CC BY 4.0).
- Mapa base oscuro: © CARTO.
- Los avisos oficiales son de SENAMHI (https://www.senamhi.gob.pe/?p=aviso-meteorologico). Los que trae el modo local están marcados como **EJEMPLO**.
