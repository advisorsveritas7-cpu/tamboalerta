# Publicar TamboAlerta en Play Store y App Store

La app de las tiendas abre el sitio publicado (`capacitor.config.ts` → `server.url`).
**Cada cambio que se publica en la web llega a todos los teléfonos al instante**, sin volver a subir la app.
Solo hay que subir una nueva versión a las tiendas si cambian permisos, íconos o el nombre.

Los proyectos nativos ya están listos en `android/` y `ios/`, con íconos, pantalla de inicio y permisos de GPS y cámara.

## Android · Google Play

Necesitas: una cuenta de desarrollador de Google Play (pago único de 25 USD) y Android Studio (Windows, Mac o Linux).

1. `npm install` y luego `npm run build && npx cap sync android`
2. `npm run movil:android` abre el proyecto en Android Studio.
3. **Build > Generate Signed App Bundle** → crea tu llave de firma (guárdala bien: sin ella no podrás actualizar la app) → genera el `.aab`.
4. En https://play.google.com/console crea la app "TamboAlerta", sube el `.aab`, completa la ficha (descripción, capturas, política de privacidad) y envíala a revisión.

Mientras tanto, cualquier Android puede instalarla desde Chrome: menú ⋮ → **Instalar app**.

## iPhone · App Store

Necesitas: una Mac con Xcode y una cuenta de Apple Developer (99 USD al año).

1. `npm install`, `npm run build && npx cap sync ios`
2. `npm run movil:ios` abre el proyecto en Xcode.
3. En **Signing & Capabilities** elige tu equipo de Apple Developer.
4. **Product > Archive** → **Distribute App** → App Store Connect.
5. En https://appstoreconnect.apple.com completa la ficha y envíala a revisión.

Mientras tanto, en iPhone se instala desde Safari: botón Compartir → **Agregar a pantalla de inicio**.

## Lo que revisan las tiendas

- Apple (regla 4.2) y Google rechazan apps que solo "envuelven" una página web. TamboAlerta usa GPS, cámara y funciona sin conexión, lo que ayuda, pero la aprobación no está garantizada. Si Apple la rechaza, el siguiente paso es agregar notificaciones push de alertas (plugin `@capacitor/push-notifications`).
- Ambas tiendas piden una **política de privacidad** pública: la app recoge ubicación y fotos de los reportes.
- Usa capturas reales del teléfono (Play: mínimo 2; App Store: 6,7" y 5,5").
